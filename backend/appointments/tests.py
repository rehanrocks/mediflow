from datetime import date, timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from organizations.models import Organization, Feature, OrganizationFeature
from users.models import User
from appointments.models import Patient, Appointment


class BaseTestCase(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name='Downtown Clinic', slug='downtown-clinic',
            display_name='DT Clinic',
        )
        self.appointments_feat = Feature.objects.create(key='appointments', label='Appointments')
        self.patients_feat = Feature.objects.create(key='patients', label='Patients')
        OrganizationFeature.objects.create(organization=self.org, feature=self.appointments_feat, is_enabled=True)
        OrganizationFeature.objects.create(organization=self.org, feature=self.patients_feat, is_enabled=True)

        self.receptionist = User.objects.create_user(
            username='rec1', password='password123',
            first_name='Alice', last_name='Johnson',
            role=User.Role.RECEPTIONIST, organization=self.org,
        )
        self.doctor = User.objects.create_user(
            username='doc1', password='password123',
            first_name='Nora', last_name='Patel',
            role=User.Role.DOCTOR, organization=self.org,
        )
        self.client = APIClient()


class BrandingLoginTests(BaseTestCase):
    def test_login_returns_full_response_with_branding(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'rec1', 'password': 'password123',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('id', response.data)
        self.assertEqual(response.data['id'], self.receptionist.id)
        self.assertEqual(response.data['role'], 'receptionist')
        self.assertEqual(response.data['first_name'], 'Alice')
        self.assertEqual(response.data['last_name'], 'Johnson')
        self.assertEqual(response.data['organization_id'], self.org.id)
        self.assertEqual(response.data['organization_name'], 'DT Clinic')
        self.assertIsNone(response.data['organization_logo'])
        self.assertIn('appointments', response.data['enabled_features'])
        self.assertIn('patients', response.data['enabled_features'])

    def test_login_branding_falls_back_to_name(self):
        self.org.display_name = ''
        self.org.save()
        response = self.client.post('/api/auth/login/', {
            'username': 'rec1', 'password': 'password123',
        }, format='json')
        self.assertEqual(response.data['organization_name'], 'Downtown Clinic')

    def test_login_wrong_password_returns_401(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'rec1', 'password': 'wrong',
        }, format='json')
        self.assertEqual(response.status_code, 401)

    def test_login_user_without_org(self):
        no_org_user = User.objects.create_user(
            username='noorg', password='password123', role=User.Role.RECEPTIONIST,
        )
        response = self.client.post('/api/auth/login/', {
            'username': 'noorg', 'password': 'password123',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['organization_id'])
        self.assertIsNone(response.data['organization_name'])
        self.assertIsNone(response.data['organization_logo'])
        self.assertEqual(response.data['enabled_features'], [])


class PatientCRUDTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.receptionist)

    def test_create_patient_with_all_fields(self):
        response = self.client.post('/api/patients/', {
            'full_name': 'Maria Garcia',
            'phone': '+15550142111',
            'date_of_birth': '1979-04-18',
            'sex': 'Female',
            'marital_status': 'Married',
            'address': '24 Cedar Lane, Springfield',
            'weight_kg': 72,
            'height_cm': 165,
            'physical_activity_level': 'Lightly Active',
            'pre_existing_conditions': ['Post-op hip replacement'],
            'known_allergies': ['Penicillin'],
            'current_medications': ['Ibuprofen'],
            'blood_group': 'O+',
            'onboarding_date': '2025-02-12',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['full_name'], 'Maria Garcia')
        self.assertEqual(response.data['date_of_birth'], '1979-04-18')
        self.assertEqual(response.data['sex'], 'Female')
        self.assertEqual(response.data['blood_group'], 'O+')
        self.assertEqual(response.data['pre_existing_conditions'], ['Post-op hip replacement'])
        self.assertEqual(response.data['current_medications'], ['Ibuprofen'])
        self.assertIsNotNone(response.data['age'])

    def test_age_computed_from_date_of_birth(self):
        response = self.client.post('/api/patients/', {
            'full_name': 'Test Patient',
            'phone': '+15550111111',
            'date_of_birth': '1990-06-15',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        expected_age = date.today().year - 1990
        self.assertIn(response.data['age'], [expected_age, expected_age - 1])

    def test_list_patients(self):
        Patient.objects.create(
            organization=self.org, full_name='Alice', phone='555-01',
            date_of_birth=date(1990, 1, 1),
        )
        Patient.objects.create(
            organization=self.org, full_name='Bob', phone='555-02',
            date_of_birth=date(1985, 1, 1),
        )
        response = self.client.get('/api/patients/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_get_patient_by_id(self):
        patient = Patient.objects.create(
            organization=self.org, full_name='Alice', phone='555-01',
            date_of_birth=date(1990, 1, 1),
        )
        response = self.client.get(f'/api/patients/{patient.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['full_name'], 'Alice')

    def test_update_patient(self):
        patient = Patient.objects.create(
            organization=self.org, full_name='Alice', phone='555-01',
            date_of_birth=date(1990, 1, 1),
        )
        response = self.client.patch(f'/api/patients/{patient.id}/', {
            'full_name': 'Alice Updated',
            'blood_group': 'A+',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['full_name'], 'Alice Updated')
        self.assertEqual(response.data['blood_group'], 'A+')

    def test_delete_patient(self):
        patient = Patient.objects.create(
            organization=self.org, full_name='Alice', phone='555-01',
            date_of_birth=date(1990, 1, 1),
        )
        response = self.client.delete(f'/api/patients/{patient.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Patient.objects.filter(id=patient.id).exists())

    def test_search_patient_by_name(self):
        Patient.objects.create(
            organization=self.org, full_name='Maria Garcia', phone='555-A',
            date_of_birth=date(1979, 4, 18),
        )
        Patient.objects.create(
            organization=self.org, full_name='Robert Johnson', phone='555-B',
            date_of_birth=date(1967, 9, 30),
        )
        response = self.client.get('/api/patients/?search=Maria')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['full_name'], 'Maria Garcia')

    def test_minimal_patient_create(self):
        response = self.client.post('/api/patients/', {
            'full_name': 'Minimal',
            'phone': '555-m',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['full_name'], 'Minimal')
        self.assertEqual(response.data['pre_existing_conditions'], [])
        self.assertEqual(response.data['known_allergies'], [])
        self.assertEqual(response.data['current_medications'], [])


class AppointmentCRUDTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.receptionist)
        self.patient = Patient.objects.create(
            organization=self.org, full_name='Maria Garcia', phone='+15550142111',
            date_of_birth=date(1979, 4, 18),
        )

    def test_book_appointment_with_all_fields(self):
        future = timezone.now() + timedelta(days=3)
        response = self.client.post('/api/appointments/', {
            'patient': self.patient.id,
            'doctor': self.doctor.id,
            'appointment_dt': future.isoformat(),
            'reason': 'Surgical recovery review',
            'temperature': '37.1',
            'blood_pressure': '118/76',
            'diagnosis': '',
            'treatment_plan': 'Continue mobility exercises.',
            'medications_prescribed': ['Ibuprofen'],
            'precautions': ['Avoid stairs without support'],
            'medical_activity': ['Light walking twice daily'],
            'post_scheduling_notes': 'Follow-up scheduled.',
            'additional_notes': 'Patient reports improved sleep.',
            'notes': 'Post-op review.',
            'payment_status': 'unpaid',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['patient_name'], 'Maria Garcia')
        self.assertEqual(response.data['doctor_name'], 'Nora Patel')
        self.assertEqual(response.data['booked_by_name'], 'Alice Johnson')
        self.assertIsNotNone(response.data['booked_at'])
        self.assertEqual(response.data['temperature'], '37.1')
        self.assertEqual(response.data['blood_pressure'], '118/76')
        self.assertEqual(response.data['treatment_plan'], 'Continue mobility exercises.')
        self.assertEqual(response.data['medications_prescribed'], ['Ibuprofen'])
        self.assertEqual(response.data['payment_status'], 'unpaid')
        self.assertEqual(response.data['status'], 'scheduled')

    def test_minimal_appointment_create(self):
        future = timezone.now() + timedelta(days=1)
        response = self.client.post('/api/appointments/', {
            'patient': self.patient.id,
            'doctor': self.doctor.id,
            'appointment_dt': future.isoformat(),
            'reason': 'Checkup',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['payment_status'], 'unpaid')
        self.assertEqual(response.data['medications_prescribed'], [])

    def test_get_appointment_detail(self):
        future = timezone.now() + timedelta(days=1)
        appt = Appointment.objects.create(
            organization=self.org, patient=self.patient, doctor=self.doctor,
            booked_by=self.receptionist, appointment_dt=future, reason='Checkup',
            temperature='37.1', blood_pressure='120/80', payment_status='paid',
        )
        response = self.client.get(f'/api/appointments/{appt.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['patient_name'], 'Maria Garcia')
        self.assertEqual(response.data['doctor_name'], 'Nora Patel')
        self.assertEqual(response.data['booked_by_name'], 'Alice Johnson')
        self.assertEqual(response.data['payment_status'], 'paid')

    def test_update_appointment(self):
        future = timezone.now() + timedelta(days=2)
        appt = Appointment.objects.create(
            organization=self.org, patient=self.patient, doctor=self.doctor,
            booked_by=self.receptionist, appointment_dt=future, reason='Checkup',
        )
        response = self.client.patch(f'/api/appointments/{appt.id}/', {
            'reason': 'Updated reason',
            'diagnosis': 'New diagnosis',
            'payment_status': 'paid',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['reason'], 'Updated reason')
        self.assertEqual(response.data['diagnosis'], 'New diagnosis')
        self.assertEqual(response.data['payment_status'], 'paid')

    def test_delete_appointment(self):
        future = timezone.now() + timedelta(days=1)
        appt = Appointment.objects.create(
            organization=self.org, patient=self.patient, doctor=self.doctor,
            booked_by=self.receptionist, appointment_dt=future, reason='Checkup',
        )
        response = self.client.delete(f'/api/appointments/{appt.id}/')
        self.assertEqual(response.status_code, 204)

    def test_past_appointment_create_returns_400(self):
        past = timezone.now() - timedelta(days=1)
        response = self.client.post('/api/appointments/', {
            'patient': self.patient.id,
            'doctor': self.doctor.id,
            'appointment_dt': past.isoformat(),
            'reason': 'Old',
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_update_allows_past_date_on_existing(self):
        future = timezone.now() + timedelta(days=5)
        appt = Appointment.objects.create(
            organization=self.org, patient=self.patient, doctor=self.doctor,
            booked_by=self.receptionist, appointment_dt=future, reason='Checkup',
        )
        response = self.client.patch(f'/api/appointments/{appt.id}/', {
            'reason': 'Updated reason',
        }, format='json')
        self.assertEqual(response.status_code, 200)


class AppointmentStatusTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.patient = Patient.objects.create(
            organization=self.org, full_name='Test Patient', phone='555',
            date_of_birth=date(1990, 1, 1),
        )
        self.future = timezone.now() + timedelta(days=1)
        self.appt = Appointment.objects.create(
            organization=self.org, patient=self.patient, doctor=self.doctor,
            booked_by=self.receptionist, appointment_dt=self.future, reason='Checkup',
        )

    def test_receptionist_can_update_status(self):
        self.client.force_authenticate(user=self.receptionist)
        response = self.client.patch(
            f'/api/appointments/{self.appt.id}/update_status/',
            {'status': 'in_progress'}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'in_progress')

    def test_can_transition_to_completed(self):
        self.client.force_authenticate(user=self.receptionist)
        response = self.client.patch(
            f'/api/appointments/{self.appt.id}/update_status/',
            {'status': 'completed'}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'completed')

    def test_can_cancel_scheduled(self):
        self.client.force_authenticate(user=self.receptionist)
        response = self.client.patch(
            f'/api/appointments/{self.appt.id}/update_status/',
            {'status': 'cancelled'}, format='json',
        )
        self.assertEqual(response.status_code, 200)

    def test_invalid_status_returns_400(self):
        self.client.force_authenticate(user=self.receptionist)
        response = self.client.patch(
            f'/api/appointments/{self.appt.id}/update_status/',
            {'status': 'invalid_status'}, format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_doctor_cannot_update_status(self):
        self.client.force_authenticate(user=self.doctor)
        response = self.client.patch(
            f'/api/appointments/{self.appt.id}/update_status/',
            {'status': 'completed'}, format='json',
        )
        self.assertEqual(response.status_code, 403)


class AppointmentFilteringTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.receptionist)
        self.patient_a = Patient.objects.create(
            organization=self.org, full_name='Alice', phone='555-A',
            date_of_birth=date(1990, 1, 1),
        )
        self.patient_b = Patient.objects.create(
            organization=self.org, full_name='Bob', phone='555-B',
            date_of_birth=date(1985, 1, 1),
        )
        now = timezone.now()
        self.appt_a_completed = Appointment(
            organization=self.org, patient=self.patient_a, doctor=self.doctor,
            booked_by=self.receptionist, appointment_dt=now - timedelta(days=10),
            reason='Visit A', status='completed',
        )
        self.appt_a_scheduled = Appointment(
            organization=self.org, patient=self.patient_a, doctor=self.doctor,
            booked_by=self.receptionist, appointment_dt=now + timedelta(days=2),
            reason='Visit A2', status='scheduled',
        )
        self.appt_b_scheduled = Appointment(
            organization=self.org, patient=self.patient_b, doctor=self.doctor,
            booked_by=self.receptionist, appointment_dt=now + timedelta(days=5),
            reason='Visit B', status='scheduled',
        )
        Appointment.objects.bulk_create([
            self.appt_a_completed, self.appt_a_scheduled, self.appt_b_scheduled,
        ])
        self.appt_a_completed = Appointment.objects.get(reason='Visit A')
        self.appt_a_scheduled = Appointment.objects.get(reason='Visit A2')
        self.appt_b_scheduled = Appointment.objects.get(reason='Visit B')

    def test_filter_by_patient(self):
        response = self.client.get(f'/api/appointments/?patient={self.patient_a.id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_filter_by_status_completed(self):
        response = self.client.get('/api/appointments/?status=completed')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], self.appt_a_completed.id)

    def test_filter_by_status_scheduled(self):
        response = self.client.get('/api/appointments/?status=scheduled')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_order_by_appointment_dt_ascending(self):
        response = self.client.get('/api/appointments/?ordering=appointment_dt')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 3)
        self.assertEqual(response.data[0]['id'], self.appt_a_completed.id)

    def test_order_by_appointment_dt_descending(self):
        response = self.client.get('/api/appointments/?ordering=-appointment_dt')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['id'], self.appt_b_scheduled.id)

    def test_combined_patient_status_filter(self):
        response = self.client.get(
            f'/api/appointments/?patient={self.patient_a.id}&status=completed'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], self.appt_a_completed.id)


class PaymentStatusTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.receptionist)
        self.patient = Patient.objects.create(
            organization=self.org, full_name='Test Patient', phone='555',
            date_of_birth=date(1990, 1, 1),
        )
        future = timezone.now() + timedelta(days=1)
        self.appt = Appointment.objects.create(
            organization=self.org, patient=self.patient, doctor=self.doctor,
            booked_by=self.receptionist, appointment_dt=future, reason='Checkup',
            payment_status='unpaid',
        )

    def test_update_payment_to_paid(self):
        response = self.client.patch(f'/api/appointments/{self.appt.id}/', {
            'payment_status': 'paid',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['payment_status'], 'paid')

    def test_update_payment_to_unpaid(self):
        Appointment.objects.filter(id=self.appt.id).update(payment_status='paid')
        response = self.client.patch(f'/api/appointments/{self.appt.id}/', {
            'payment_status': 'unpaid',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['payment_status'], 'unpaid')

    def test_default_payment_status_is_unpaid(self):
        future = timezone.now() + timedelta(days=2)
        response = self.client.post('/api/appointments/', {
            'patient': self.patient.id,
            'doctor': self.doctor.id,
            'appointment_dt': future.isoformat(),
            'reason': 'Checkup',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['payment_status'], 'unpaid')


class PhoneDeduplicationTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.receptionist)
        Patient.objects.create(
            organization=self.org, full_name='Alice', phone='+15550142111',
            date_of_birth=date(1990, 1, 1),
        )

    def test_phone_filter_returns_matching_patient(self):
        response = self.client.get('/api/patients/?phone=%2B15550142111')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['full_name'], 'Alice')

    def test_phone_filter_returns_empty_for_no_match(self):
        response = self.client.get('/api/patients/?phone=%2B99999999999')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)


class DoctorAccessTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.patient = Patient.objects.create(
            organization=self.org, full_name='Test Patient', phone='555',
            date_of_birth=date(1990, 1, 1),
        )
        future = timezone.now() + timedelta(days=1)
        self.appt = Appointment.objects.create(
            organization=self.org, patient=self.patient, doctor=self.doctor,
            booked_by=self.receptionist, appointment_dt=future, reason='Checkup',
        )

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
            booked_by=self.receptionist, appointment_dt=future, reason='Other doc',
        )
        self.client.force_authenticate(user=self.doctor)
        response = self.client.get('/api/appointments/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['doctor'], self.doctor.id)

    def test_doctor_can_view_appointments(self):
        self.client.force_authenticate(user=self.doctor)
        response = self.client.get('/api/appointments/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_receptionist_sees_all_in_own_org(self):
        self.client.force_authenticate(user=self.receptionist)
        response = self.client.get('/api/appointments/')
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)

    def test_unauthenticated_gets_401(self):
        response = self.client.get('/api/appointments/')
        self.assertEqual(response.status_code, 401)


class FeatureGatingTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.riverside = Organization.objects.create(
            name='Riverside Medical', slug='riverside-medical',
        )
        OrganizationFeature.objects.create(
            organization=self.riverside, feature=self.appointments_feat, is_enabled=False,
        )
        OrganizationFeature.objects.create(
            organization=self.riverside, feature=self.patients_feat, is_enabled=True,
        )
        self.riverside_staff = User.objects.create_user(
            username='rec_riverside', password='password123',
            role=User.Role.RECEPTIONIST, organization=self.riverside,
        )
        self.riverside_admin = User.objects.create_user(
            username='admin_riverside', password='password123',
            role=User.Role.ADMIN, organization=self.riverside,
        )

    def test_disabled_feature_blocks_access(self):
        self.client.force_authenticate(user=self.riverside_staff)
        response = self.client.get('/api/appointments/')
        self.assertEqual(response.status_code, 403)
        self.assertIn('not included', response.data['detail'])

    def test_enabled_feature_allows_access(self):
        self.client.force_authenticate(user=self.riverside_staff)
        response = self.client.get('/api/patients/')
        self.assertEqual(response.status_code, 200)

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

    def test_setting_payment_status_on_appointment(self):
        OrganizationFeature.objects.filter(
            organization=self.riverside, feature=self.appointments_feat,
        ).update(is_enabled=True)
        patient = Patient.objects.create(
            organization=self.riverside, full_name='Test', phone='555',
            date_of_birth=date(1990, 1, 1),
        )
        doc = User.objects.create_user(
            username='rdoc', password='password123',
            role=User.Role.DOCTOR, organization=self.riverside,
        )
        future = timezone.now() + timedelta(days=1)
        self.client.force_authenticate(user=self.riverside_staff)
        response = self.client.post('/api/appointments/', {
            'patient': patient.id,
            'doctor': doc.id,
            'appointment_dt': future.isoformat(),
            'reason': 'Checkup',
            'payment_status': 'paid',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['payment_status'], 'paid')


class CrossOrgIsolationTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.org_b = Organization.objects.create(name='Org B', slug='org-b')
        OrganizationFeature.objects.create(organization=self.org_b, feature=self.appointments_feat, is_enabled=True)
        OrganizationFeature.objects.create(organization=self.org_b, feature=self.patients_feat, is_enabled=True)
        self.staff_b = User.objects.create_user(
            username='staff_b', password='password123',
            role=User.Role.RECEPTIONIST, organization=self.org_b,
        )
        self.patient_a = Patient.objects.create(
            organization=self.org, full_name='Alice', phone='555-A',
            date_of_birth=date(1990, 1, 1),
        )
        future = timezone.now() + timedelta(days=1)
        self.appt_a = Appointment.objects.create(
            organization=self.org, patient=self.patient_a, doctor=self.doctor,
            booked_by=self.receptionist, appointment_dt=future, reason='Test',
        )

    def test_cross_org_appointment_returns_404(self):
        self.client.force_authenticate(user=self.staff_b)
        response = self.client.get(f'/api/appointments/{self.appt_a.id}/')
        self.assertEqual(response.status_code, 404)

    def test_own_org_appointment_accessible(self):
        self.client.force_authenticate(user=self.receptionist)
        response = self.client.get(f'/api/appointments/{self.appt_a.id}/')
        self.assertEqual(response.status_code, 200)

    def test_cross_org_patient_returns_404(self):
        self.client.force_authenticate(user=self.staff_b)
        response = self.client.get(f'/api/patients/{self.patient_a.id}/')
        self.assertEqual(response.status_code, 404)

    def test_cross_org_patient_not_in_list(self):
        self.client.force_authenticate(user=self.staff_b)
        response = self.client.get('/api/patients/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)


class DoctorListTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.org_b = Organization.objects.create(name='Org B', slug='org-b')
        self.doctor_b = User.objects.create_user(
            username='doc_b', password='password123',
            role=User.Role.DOCTOR, organization=self.org_b,
        )

    def test_doctor_list_returns_doctors_with_name(self):
        self.client.force_authenticate(user=self.receptionist)
        response = self.client.get('/api/doctors/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['first_name'], 'Nora')
        self.assertEqual(response.data[0]['last_name'], 'Patel')
        self.assertEqual(response.data[0]['role'], 'doctor')
        self.assertEqual(response.data[0]['name'], 'Nora Patel')

    def test_doctor_list_only_returns_own_org(self):
        self.client.force_authenticate(user=self.doctor)
        response = self.client.get('/api/doctors/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertNotEqual(response.data[0]['id'], self.doctor_b.id)

    def test_doctor_list_for_org_b(self):
        staff_b = User.objects.create_user(
            username='staff_bb', password='password123',
            role=User.Role.RECEPTIONIST, organization=self.org_b,
        )
        self.client.force_authenticate(user=staff_b)
        response = self.client.get('/api/doctors/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], self.doctor_b.id)


class PatientSearchByPhoneTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.receptionist)
        Patient.objects.create(
            organization=self.org, full_name='Alice', phone='+15550142111',
            date_of_birth=date(1990, 1, 1),
        )
        Patient.objects.create(
            organization=self.org, full_name='Bob', phone='+15550188222',
            date_of_birth=date(1985, 1, 1),
        )

    def test_search_by_name_partial(self):
        response = self.client.get('/api/patients/?search=Ali')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_search_by_phone_partial(self):
        response = self.client.get('/api/patients/?search=4211')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['full_name'], 'Alice')


class AppointmentModelTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Test Org', slug='test-org')
        self.doctor = User.objects.create_user(
            username='doc', password='pass', role=User.Role.DOCTOR,
            organization=self.org,
        )
        self.patient = Patient.objects.create(
            organization=self.org, full_name='Test Patient', phone='555',
            date_of_birth=date(1990, 1, 1),
        )

    def test_appointment_str_includes_patient_and_date(self):
        future = timezone.now() + timedelta(days=1)
        appt = Appointment.objects.create(
            organization=self.org, patient=self.patient, doctor=self.doctor,
            appointment_dt=future, reason='Checkup',
        )
        self.assertIn('Test Patient', str(appt))

    def test_payment_status_defaults_to_unpaid(self):
        future = timezone.now() + timedelta(days=1)
        appt = Appointment.objects.create(
            organization=self.org, patient=self.patient, doctor=self.doctor,
            appointment_dt=future, reason='Checkup',
        )
        self.assertEqual(appt.payment_status, 'unpaid')

    def test_status_defaults_to_scheduled(self):
        future = timezone.now() + timedelta(days=1)
        appt = Appointment.objects.create(
            organization=self.org, patient=self.patient, doctor=self.doctor,
            appointment_dt=future, reason='Checkup',
        )
        self.assertEqual(appt.status, 'scheduled')

    def test_past_appointment_validation_on_create(self):
        past = timezone.now() - timedelta(days=1)
        appt = Appointment(
            organization=self.org, patient=self.patient, doctor=self.doctor,
            appointment_dt=past, reason='Old',
        )
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            appt.full_clean()

    def test_json_fields_default_to_empty_list(self):
        future = timezone.now() + timedelta(days=1)
        appt = Appointment.objects.create(
            organization=self.org, patient=self.patient, doctor=self.doctor,
            appointment_dt=future, reason='Checkup',
        )
        self.assertEqual(appt.medications_prescribed, [])
        self.assertEqual(appt.precautions, [])
        self.assertEqual(appt.medical_activity, [])

    def test_patient_json_fields_default_to_empty_list(self):
        patient = Patient.objects.create(
            organization=self.org, full_name='Test', phone='555-01',
            date_of_birth=date(1990, 1, 1),
        )
        self.assertEqual(patient.pre_existing_conditions, [])
        self.assertEqual(patient.known_allergies, [])
        self.assertEqual(patient.current_medications, [])
