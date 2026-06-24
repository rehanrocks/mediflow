from datetime import date, timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from organizations.models import Organization, Feature, OrganizationFeature
from users.models import User, DoctorAttendance
from appointments.models import Patient, Appointment
from staff.models import StaffMember


class RBACTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(
            slug='test-clinic', name='Test Clinic', is_active=True,
        )
        for key in ('appointments', 'patients', 'doctors', 'staff'):
            feat, _ = Feature.objects.get_or_create(key=key, defaults={'label': key})
            OrganizationFeature.objects.update_or_create(
                organization=cls.org, feature=feat, defaults={'is_enabled': True},
            )

        cls.admin = User.objects.create_user(
            username='rbac_admin', password='pass', first_name='Admin', last_name='Test',
            role='admin', organization=cls.org,
        )
        cls.receptionist = User.objects.create_user(
            username='rbac_rec', password='pass', first_name='Rec', last_name='Test',
            role='receptionist', organization=cls.org,
        )
        cls.doctor = User.objects.create_user(
            username='rbac_doc', password='pass', first_name='Dr.', last_name='Test',
            role='doctor', organization=cls.org, join_date=date(2020, 1, 1),
            shift_start='09:00', shift_end='17:00',
        )

        cls.patient_a = Patient.objects.create(
            organization=cls.org, full_name='Patient A', phone='+923001111001',
        )
        cls.patient_b = Patient.objects.create(
            organization=cls.org, full_name='Patient B', phone='+923001111002',
        )

        today = timezone.now()
        Appointment.objects.create(
            organization=cls.org, patient=cls.patient_a, doctor=cls.doctor,
            booked_by=cls.admin, appointment_dt=today + timedelta(hours=1),
            reason='Checkup', status='scheduled',
        )
        Appointment.objects.create(
            organization=cls.org, patient=cls.patient_a, doctor=cls.doctor,
            booked_by=cls.admin, appointment_dt=today + timedelta(hours=3),
            reason='Follow-up', status='scheduled',
        )

        DoctorAttendance.objects.create(
            doctor=cls.doctor, organization=cls.org, date=timezone.localdate(),
            checkin_time='09:00',
        )

        cls.staff = StaffMember.objects.create(
            organization=cls.org, full_name='Staff One', age=30,
            phone='+923009999999', role='Nurse', status='active',
            joining_date=date(2024, 1, 1),
        )

    def _client(self, user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    # ─── Login / Token ───

    def test_login_response_has_role(self):
        c = APIClient()
        resp = c.post('/api/auth/login/', {'username': 'rbac_admin', 'password': 'pass'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['role'], 'admin')

    def test_login_role_from_db_not_body(self):
        c = APIClient()
        resp = c.post('/api/auth/login/', {
            'username': 'rbac_doc', 'password': 'pass', 'role': 'admin',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['role'], 'doctor')

    def test_token_refresh_re_reads_role_from_db(self):
        c = APIClient()
        login_resp = c.post('/api/auth/login/', {
            'username': 'rbac_rec', 'password': 'pass',
        }, format='json')
        refresh_token = login_resp.data['refresh']

        self.receptionist.role = 'admin'
        self.receptionist.save(update_fields=['role'])

        refresh_resp = c.post('/api/auth/refresh/', {'refresh': refresh_token}, format='json')
        self.assertEqual(refresh_resp.status_code, 200)
        self.assertEqual(refresh_resp.data.get('role'), 'admin')

        self.receptionist.role = 'receptionist'
        self.receptionist.save(update_fields=['role'])

    # ─── Patient Scoping ───

    def test_patient_list_doctor_sees_only_own(self):
        resp = self._client(self.doctor).get('/api/patients/')
        self.assertEqual(resp.status_code, 200)
        results = resp.data['results']
        names = [r['full_name'] for r in results]
        self.assertIn('Patient A', names)
        self.assertNotIn('Patient B', names)

    def test_patient_list_admin_sees_all(self):
        resp = self._client(self.admin).get('/api/patients/')
        self.assertEqual(resp.status_code, 200)
        results = resp.data['results']
        self.assertGreaterEqual(len(results), 2)

    def test_patient_detail_doctor_own_patient(self):
        resp = self._client(self.doctor).get(f'/api/patients/{self.patient_a.id}/')
        self.assertEqual(resp.status_code, 200)

    def test_patient_detail_doctor_other_patient_404(self):
        resp = self._client(self.doctor).get(f'/api/patients/{self.patient_b.id}/')
        self.assertEqual(resp.status_code, 404)

    def test_patient_create_doctor_403(self):
        resp = self._client(self.doctor).post('/api/patients/', {
            'full_name': 'New', 'phone': '+923001111003',
        }, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_patient_create_receptionist_201(self):
        resp = self._client(self.receptionist).post('/api/patients/', {
            'full_name': 'New Patient', 'phone': '+923001111003',
        }, format='json')
        self.assertEqual(resp.status_code, 201)

    def test_patient_delete_receptionist_403(self):
        resp = self._client(self.receptionist).delete(f'/api/patients/{self.patient_a.id}/')
        self.assertEqual(resp.status_code, 403)

    def test_patient_delete_admin_204(self):
        patient = Patient.objects.create(
            organization=self.org, full_name='To Delete', phone='+923001111099',
        )
        resp = self._client(self.admin).delete(f'/api/patients/{patient.id}/')
        self.assertEqual(resp.status_code, 204)

    # ─── Doctor Write Permissions ───

    def test_doctor_create_receptionist_201(self):
        resp = self._client(self.receptionist).post('/api/doctors/', {
            'first_name': 'New', 'last_name': 'Doctor', 'email': 'newdoc@test.com',
            'phone': '+923001111010', 'qualification': 'MBBS',
            'specializations': ['General'], 'experience_years': 5,
            'shift_start': '08:00', 'shift_end': '16:00',
            'status': 'active', 'join_date': '2024-06-01',
        }, format='json')
        self.assertEqual(resp.status_code, 201)

    def test_doctor_create_doctor_403(self):
        resp = self._client(self.doctor).post('/api/doctors/', {
            'first_name': 'New', 'last_name': 'Doctor', 'email': 'newdoc2@test.com',
            'phone': '+923001111011', 'qualification': 'MBBS',
            'specializations': ['General'], 'experience_years': 5,
            'shift_start': '08:00', 'shift_end': '16:00',
            'status': 'active', 'join_date': '2024-06-01',
        }, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_doctor_edit_receptionist_403(self):
        doc_user = User.objects.create_user(
            username='edit_doc', password='pass', first_name='Edit', last_name='Doc',
            role='doctor', organization=self.org, email='editdoc@test.com',
            phone='+923001111012', qualification='MBBS',
        )
        resp = self._client(self.receptionist).patch(
            f'/api/doctors/{doc_user.id}/',
            {'first_name': 'Changed'}, format='json',
        )
        self.assertEqual(resp.status_code, 403)

    def test_doctor_delete_receptionist_403(self):
        doc_user = User.objects.create_user(
            username='del_doc', password='pass', first_name='Del', last_name='Doc',
            role='doctor', organization=self.org, email='deldoc@test.com',
            phone='+923001111013', qualification='MBBS',
        )
        resp = self._client(self.receptionist).delete(f'/api/doctors/{doc_user.id}/')
        self.assertEqual(resp.status_code, 403)

    def test_doctor_delete_admin_204(self):
        doc_user = User.objects.create_user(
            username='del_doc2', password='pass', first_name='Del2', last_name='Doc',
            role='doctor', organization=self.org, email='deldoc2@test.com',
            phone='+923001111014', qualification='MBBS',
        )
        resp = self._client(self.admin).delete(f'/api/doctors/{doc_user.id}/')
        self.assertEqual(resp.status_code, 204)

    # ─── Appointment Write Permissions ───

    def test_appointment_create_doctor_403(self):
        resp = self._client(self.doctor).post('/api/appointments/', {
            'patient': self.patient_a.id,
            'doctor': self.doctor.id,
            'appointment_dt': (timezone.now() + timedelta(days=1)).isoformat(),
            'reason': 'Test',
        }, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_appointment_create_receptionist_201(self):
        resp = self._client(self.receptionist).post('/api/appointments/', {
            'patient': self.patient_a.id,
            'doctor': self.doctor.id,
            'appointment_dt': (timezone.now() + timedelta(days=1)).isoformat(),
            'reason': 'Test',
        }, format='json')
        self.assertEqual(resp.status_code, 201)

    def test_appointment_delete_receptionist_403(self):
        appt = Appointment.objects.first()
        resp = self._client(self.receptionist).delete(f'/api/appointments/{appt.id}/')
        self.assertEqual(resp.status_code, 403)

    def test_appointment_delete_admin_204(self):
        appt = Appointment.objects.create(
            organization=self.org, patient=self.patient_a, doctor=self.doctor,
            booked_by=self.admin, appointment_dt=timezone.now() + timedelta(days=2),
            reason='To delete', status='scheduled',
        )
        resp = self._client(self.admin).delete(f'/api/appointments/{appt.id}/')
        self.assertEqual(resp.status_code, 204)

    # ─── Staff Access ───

    def test_staff_list_receptionist_403(self):
        resp = self._client(self.receptionist).get('/api/staff/')
        self.assertEqual(resp.status_code, 403)
        self.assertIn('Only administrators can access', str(resp.data))

    def test_staff_list_admin_200(self):
        resp = self._client(self.admin).get('/api/staff/')
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(resp.data['count'], 1)

    def test_staff_list_doctor_403(self):
        resp = self._client(self.doctor).get('/api/staff/')
        self.assertEqual(resp.status_code, 403)

    # ─── Dashboard Stats ───

    def test_dashboard_stats_admin_shape(self):
        resp = self._client(self.admin).get('/api/dashboard/stats/')
        self.assertEqual(resp.status_code, 200)
        expected_keys = [
            'appointments_today', 'appointments_scheduled', 'appointments_completed',
            'total_patients', 'patients_this_month', 'active_doctors', 'total_doctors',
            'active_staff', 'unique_staff_roles',
        ]
        for key in expected_keys:
            self.assertIn(key, resp.data)
            self.assertGreaterEqual(resp.data[key], 0)

    def test_dashboard_stats_receptionist_shape(self):
        resp = self._client(self.receptionist).get('/api/dashboard/stats/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('appointments_today', resp.data)

    def test_dashboard_stats_doctor_shape(self):
        resp = self._client(self.doctor).get('/api/dashboard/stats/')
        self.assertEqual(resp.status_code, 200)
        expected_keys = [
            'cases_today', 'cases_this_week', 'cases_this_month',
            'avg_cases_per_day', 'my_patients_total', 'today_checkin',
            'shift_start', 'shift_end',
        ]
        for key in expected_keys:
            self.assertIn(key, resp.data)

    def test_dashboard_stats_doctor_no_crash_zero(self):
        new_doc = User.objects.create_user(
            username='zero_doc', password='pass', first_name='Zero', last_name='Doc',
            role='doctor', organization=self.org,
        )
        resp = self._client(new_doc).get('/api/dashboard/stats/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['cases_today'], 0)
        self.assertEqual(resp.data['my_patients_total'], 0)

    def test_dashboard_stats_no_token_401(self):
        c = APIClient()
        resp = c.get('/api/dashboard/stats/')
        self.assertEqual(resp.status_code, 401)

    # ─── Doctors On Duty ───

    def test_on_duty_admin_200(self):
        resp = self._client(self.admin).get('/api/doctors/on-duty/')
        self.assertEqual(resp.status_code, 200)
        results = resp.data['results']
        self.assertGreaterEqual(len(results), 1)
        self.assertIn('full_name', results[0])
        self.assertIn('today_checkin', results[0])
        self.assertIn('cases_today', results[0])

    def test_on_duty_receptionist_200(self):
        resp = self._client(self.receptionist).get('/api/doctors/on-duty/')
        self.assertEqual(resp.status_code, 200)

    def test_on_duty_doctor_403(self):
        resp = self._client(self.doctor).get('/api/doctors/on-duty/')
        self.assertEqual(resp.status_code, 403)

    def test_on_duty_paginated(self):
        resp = self._client(self.admin).get('/api/doctors/on-duty/')
        self.assertIn('count', resp.data)
        self.assertIn('results', resp.data)
