from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient

from organizations.models import Organization, Feature, OrganizationFeature
from users.models import User
from appointments.models import Patient, Appointment


class AuthLoginTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Downtown Clinic', slug='downtown-clinic')
        self.appointments_feat = Feature.objects.create(key='appointments', label='Appointments')
        self.patients_feat = Feature.objects.create(key='patients', label='Patients')
        OrganizationFeature.objects.create(organization=self.org, feature=self.appointments_feat, is_enabled=True)
        OrganizationFeature.objects.create(organization=self.org, feature=self.patients_feat, is_enabled=True)

        self.user = User.objects.create_user(
            username='rec1', password='password123',
            first_name='Alice', last_name='Johnson',
            role=User.Role.RECEPTIONIST, organization=self.org,
        )
        self.client = APIClient()

    def test_login_returns_full_response(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'rec1', 'password': 'password123',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['role'], 'receptionist')
        self.assertEqual(response.data['first_name'], 'Alice')
        self.assertEqual(response.data['last_name'], 'Johnson')
        self.assertEqual(response.data['organization_id'], self.org.id)
        self.assertEqual(response.data['organization_name'], 'Downtown Clinic')
        self.assertIn('appointments', response.data['enabled_features'])
        self.assertIn('patients', response.data['enabled_features'])

    def test_login_wrong_password_returns_401(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'rec1', 'password': 'wrong',
        }, format='json')
        self.assertEqual(response.status_code, 401)


class AppointmentAccessTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Downtown Clinic', slug='downtown-clinic')
        self.appointments_feat = Feature.objects.create(key='appointments', label='Appointments')
        self.patients_feat = Feature.objects.create(key='patients', label='Patients')
        OrganizationFeature.objects.create(organization=self.org, feature=self.appointments_feat, is_enabled=True)
        OrganizationFeature.objects.create(organization=self.org, feature=self.patients_feat, is_enabled=True)

        self.receptionist = User.objects.create_user(
            username='rec1', password='password123', role=User.Role.RECEPTIONIST, organization=self.org,
        )
        self.doctor = User.objects.create_user(
            username='doc1', password='password123', role=User.Role.DOCTOR, organization=self.org,
        )
        self.patient = Patient.objects.create(
            organization=self.org, full_name='John Doe', phone='555-0001', age=35, condition='Test',
        )
        self.client = APIClient()
        future = timezone.now() + timedelta(days=1)
        self.appointment = Appointment.objects.create(
            organization=self.org, patient=self.patient, doctor=self.doctor,
            appointment_dt=future, reason='Checkup',
        )

    def test_receptionist_can_create_appointment(self):
        self.client.force_authenticate(user=self.receptionist)
        future = timezone.now() + timedelta(days=2)
        response = self.client.post('/api/appointments/', {
            'patient': self.patient.id,
            'doctor': self.doctor.id,
            'appointment_dt': future.isoformat(),
            'reason': 'Follow-up',
        }, format='json')
        self.assertEqual(response.status_code, 201)

    def test_doctor_cannot_create_appointment(self):
        self.client.force_authenticate(user=self.doctor)
        future = timezone.now() + timedelta(days=2)
        response = self.client.post('/api/appointments/', {
            'patient': self.patient.id,
            'doctor': self.doctor.id,
            'appointment_dt': future.isoformat(),
            'reason': 'Follow-up',
        }, format='json')
        self.assertEqual(response.status_code, 403)

    def test_doctor_sees_only_own_appointments(self):
        doc2 = User.objects.create_user(
            username='doc2', password='password123',
            role=User.Role.DOCTOR, organization=self.org,
        )
        future = timezone.now() + timedelta(days=2)
        Appointment.objects.create(
            organization=self.org, patient=self.patient, doctor=doc2,
            appointment_dt=future, reason='Other doc',
        )
        self.client.force_authenticate(user=self.doctor)
        response = self.client.get('/api/appointments/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_receptionist_sees_all_in_own_org(self):
        self.client.force_authenticate(user=self.receptionist)
        response = self.client.get('/api/appointments/')
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)

    def test_past_appointment_returns_400(self):
        self.client.force_authenticate(user=self.receptionist)
        past = timezone.now() - timedelta(days=1)
        response = self.client.post('/api/appointments/', {
            'patient': self.patient.id,
            'doctor': self.doctor.id,
            'appointment_dt': past.isoformat(),
            'reason': 'Old',
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_update_status_staff_can_patch(self):
        self.client.force_authenticate(user=self.receptionist)
        response = self.client.patch(
            f'/api/appointments/{self.appointment.id}/update_status/',
            {'status': 'completed'}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'completed')

    def test_update_status_doctor_gets_403(self):
        self.client.force_authenticate(user=self.doctor)
        response = self.client.patch(
            f'/api/appointments/{self.appointment.id}/update_status/',
            {'status': 'completed'}, format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_gets_401(self):
        response = self.client.get('/api/appointments/')
        self.assertEqual(response.status_code, 401)


class PatientSearchTests(TestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name='Org A', slug='org-a')
        self.org_b = Organization.objects.create(name='Org B', slug='org-b')
        self.patients_feat = Feature.objects.create(key='patients', label='Patients')
        OrganizationFeature.objects.create(organization=self.org_a, feature=self.patients_feat, is_enabled=True)
        OrganizationFeature.objects.create(organization=self.org_b, feature=self.patients_feat, is_enabled=True)

        self.client = APIClient()
        self.staff_a = User.objects.create_user(
            username='staff_a', password='password123', role=User.Role.RECEPTIONIST, organization=self.org_a,
        )
        Patient.objects.create(organization=self.org_a, full_name='Alice Smith', phone='555-0001', age=30)
        Patient.objects.create(organization=self.org_b, full_name='Alice Jones', phone='555-0002', age=40)

    def test_search_only_returns_own_org_patients(self):
        self.client.force_authenticate(user=self.staff_a)
        response = self.client.get('/api/patients/?search=Alice')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['full_name'], 'Alice Smith')


class FeatureGatingTests(TestCase):
    def setUp(self):
        self.downtown = Organization.objects.create(name='Downtown Clinic', slug='downtown-clinic')
        self.riverside = Organization.objects.create(name='Riverside Medical', slug='riverside-medical')
        self.appointments_feat = Feature.objects.create(key='appointments', label='Appointments')
        self.patients_feat = Feature.objects.create(key='patients', label='Patients')
        OrganizationFeature.objects.create(organization=self.downtown, feature=self.appointments_feat, is_enabled=True)
        OrganizationFeature.objects.create(organization=self.downtown, feature=self.patients_feat, is_enabled=True)
        OrganizationFeature.objects.create(organization=self.riverside, feature=self.patients_feat, is_enabled=True)
        OrganizationFeature.objects.create(organization=self.riverside, feature=self.appointments_feat, is_enabled=False)

        self.client = APIClient()
        self.riverside_admin = User.objects.create_user(
            username='admin_riverside', password='password123',
            role=User.Role.ADMIN, organization=self.riverside,
        )
        self.riverside_staff = User.objects.create_user(
            username='rec_riverside', password='password123',
            role=User.Role.RECEPTIONIST, organization=self.riverside,
        )

    def test_disabled_feature_blocks_access_even_for_admin(self):
        self.client.force_authenticate(user=self.riverside_admin)
        response = self.client.get('/api/appointments/')
        self.assertEqual(response.status_code, 403)
        self.assertIn('not included', response.data['detail'])

    def test_disabled_feature_blocks_write_even_for_staff(self):
        self.client.force_authenticate(user=self.riverside_staff)
        patient = Patient.objects.create(organization=self.riverside, full_name='Test', phone='555', age=25)
        future = timezone.now() + timedelta(days=1)
        response = self.client.post('/api/appointments/', {
            'patient': patient.id,
            'appointment_dt': future.isoformat(),
        }, format='json')
        self.assertEqual(response.status_code, 403)

    def test_toggling_feature_live_changes_behavior(self):
        self.client.force_authenticate(user=self.riverside_staff)
        response = self.client.get('/api/appointments/')
        self.assertEqual(response.status_code, 403)

        org_feat = OrganizationFeature.objects.get(
            organization=self.riverside, feature=self.appointments_feat,
        )
        org_feat.is_enabled = True
        org_feat.save()

        response = self.client.get('/api/appointments/')
        self.assertEqual(response.status_code, 200)


class CrossOrgIsolationTests(TestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name='Org A', slug='org-a')
        self.org_b = Organization.objects.create(name='Org B', slug='org-b')
        self.appointments_feat = Feature.objects.create(key='appointments', label='Appointments')
        self.patients_feat = Feature.objects.create(key='patients', label='Patients')
        OrganizationFeature.objects.create(organization=self.org_a, feature=self.appointments_feat, is_enabled=True)
        OrganizationFeature.objects.create(organization=self.org_a, feature=self.patients_feat, is_enabled=True)
        OrganizationFeature.objects.create(organization=self.org_b, feature=self.appointments_feat, is_enabled=True)
        OrganizationFeature.objects.create(organization=self.org_b, feature=self.patients_feat, is_enabled=True)

        self.client = APIClient()
        self.staff_a = User.objects.create_user(
            username='staff_a', password='password123', role=User.Role.RECEPTIONIST, organization=self.org_a,
        )
        self.staff_b = User.objects.create_user(
            username='staff_b', password='password123', role=User.Role.RECEPTIONIST, organization=self.org_b,
        )
        patient_a = Patient.objects.create(organization=self.org_a, full_name='Alice', phone='555', age=30)
        self.appt_a = Appointment.objects.create(
            organization=self.org_a, patient=patient_a,
            appointment_dt=timezone.now() + timedelta(days=1), reason='Test',
        )

    def test_cross_org_appointment_returns_404(self):
        self.client.force_authenticate(user=self.staff_b)
        response = self.client.get(f'/api/appointments/{self.appt_a.id}/')
        self.assertEqual(response.status_code, 404)

    def test_own_org_appointment_accessible(self):
        self.client.force_authenticate(user=self.staff_a)
        response = self.client.get(f'/api/appointments/{self.appt_a.id}/')
        self.assertEqual(response.status_code, 200)


class OrgScopedDoctorListTests(TestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name='Org A', slug='org-a')
        self.org_b = Organization.objects.create(name='Org B', slug='org-b')

        self.client = APIClient()
        self.doc_a = User.objects.create_user(
            username='doc_a', password='password123', role=User.Role.DOCTOR, organization=self.org_a,
        )
        self.doc_b = User.objects.create_user(
            username='doc_b', password='password123', role=User.Role.DOCTOR, organization=self.org_b,
        )

    def test_doctor_list_only_returns_own_org_doctors(self):
        self.client.force_authenticate(user=self.doc_a)
        response = self.client.get('/api/doctors/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], self.doc_a.id)
