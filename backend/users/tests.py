from datetime import date, time, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from organizations.models import Organization, Feature, OrganizationFeature
from users.models import User, DoctorAttendance
from appointments.models import Patient, Appointment


class DoctorAPITests(APITestCase):
    def setUp(self):
        self.org1 = Organization.objects.create(name='Clinic A', slug='clinic-a')
        self.org2 = Organization.objects.create(name='Clinic B', slug='clinic-b')
        self.org3 = Organization.objects.create(name='Clinic C', slug='clinic-c')

        self.feat_doctors, _ = Feature.objects.get_or_create(key='doctors', defaults={'label': 'Doctors Module'})
        OrganizationFeature.objects.get_or_create(organization=self.org1, feature=self.feat_doctors, defaults={'is_enabled': True})
        OrganizationFeature.objects.get_or_create(organization=self.org2, feature=self.feat_doctors, defaults={'is_enabled': False})
        OrganizationFeature.objects.get_or_create(organization=self.org3, feature=self.feat_doctors, defaults={'is_enabled': True})

        self.admin1 = User.objects.create_user(username='admin1', password='pass', role='admin', organization=self.org1)
        self.receptionist1 = User.objects.create_user(username='rec1', password='pass', role='receptionist', organization=self.org1)
        self.doctor1 = User.objects.create_user(
            username='doc1', password='pass', role='doctor', organization=self.org1,
            first_name='John', last_name='Doe', phone='+1111111111',
            qualification='MBBS', specializations=['Cardiology'],
            experience_years=5, shift_start=time(9, 0), shift_end=time(17, 0),
            join_date=date(2023, 1, 1), status='active',
        )
        self.doctor2 = User.objects.create_user(
            username='doc2', password='pass', role='doctor', organization=self.org1,
            first_name='Jane', last_name='Smith', phone='+2222222222',
            qualification='MD', specializations=['Pediatrics'],
            experience_years=3, shift_start=time(10, 0), shift_end=time(18, 0),
            join_date=date(2024, 1, 1), status='active',
        )
        self.admin2 = User.objects.create_user(username='admin2', password='pass', role='admin', organization=self.org2)
        self.admin3 = User.objects.create_user(username='admin3', password='pass', role='admin', organization=self.org3)
        self.doctor_org2 = User.objects.create_user(username='doc_org2', password='pass', role='doctor', organization=self.org2)

        self.patient = Patient.objects.create(
            organization=self.org1, full_name='Test Patient', phone='555-0001',
            date_of_birth=date(1985, 3, 15), pre_existing_conditions=['Asthma'],
        )

        today = timezone.localdate()
        yesterday = today - timedelta(days=1)
        DoctorAttendance.objects.create(
            doctor=self.doctor1, organization=self.org1, date=yesterday,
            checkin_time=time(9, 5), checkout_time=time(17, 0),
        )
        DoctorAttendance.objects.create(
            doctor=self.doctor1, organization=self.org1, date=today,
            checkin_time=time(9, 0), checkout_time=time(17, 0),
        )

        now = timezone.now()
        Appointment.objects.create(
            organization=self.org1, patient=self.patient, doctor=self.doctor1,
            appointment_dt=now + timedelta(hours=2), reason='Chest Pain',
            status='scheduled',
        )
        past_appt = Appointment(
            organization=self.org1, patient=self.patient, doctor=self.doctor1,
            appointment_dt=now - timedelta(days=1), reason='Fever', status='completed',
            diagnosis='Viral Fever',
        )
        Appointment.objects.bulk_create([past_appt])

        self.client = APIClient()

    def _login(self, username):
        self.client.force_authenticate(user=User.objects.get(username=username))

    def _list_results(self, resp):
        if isinstance(resp.data, dict):
            return resp.data.get('results', resp.data)
        return resp.data

    # --- 1. List doctors - staff sees org-only ---
    def test_list_doctors_staff_org_scoped(self):
        self._login('admin1')
        resp = self.client.get('/api/doctors/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        doctor_ids = [d['id'] for d in self._list_results(resp)]
        self.assertIn(self.doctor1.id, doctor_ids)
        self.assertIn(self.doctor2.id, doctor_ids)
        self.assertNotIn(self.doctor_org2.id, doctor_ids)

    # --- 2. List doctors - doctor role can list ---
    def test_list_doctors_doctor_role(self):
        self._login('doc1')
        resp = self.client.get('/api/doctors/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    # --- 3. Detail - admin gets full response with computed fields ---
    def test_retrieve_admin_full_response(self):
        self._login('admin1')
        resp = self.client.get(f'/api/doctors/{self.doctor1.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['full_name'], 'John Doe')
        self.assertIsNotNone(resp.data['cases_today'])
        self.assertIn('today_checkin', resp.data)
        self.assertIn('avg_cases_per_day', resp.data)

    # --- 4. Detail - doctor requesting another doctor gets 200 (limited) ---
    def test_retrieve_doctor_other_doctor(self):
        self._login('doc2')
        resp = self.client.get(f'/api/doctors/{self.doctor1.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('full_name', resp.data)

    # --- 5. POST - admin creates, receptionist gets 403, doctor gets 403 ---
    def test_create_admin(self):
        self._login('admin1')
        resp = self.client.post('/api/doctors/', {
            'first_name': 'New', 'last_name': 'Doc',
            'email': 'new@clinic-a.com', 'phone': '+3333333333',
            'qualification': 'MBBS', 'specializations': ['Surgery'],
            'experience_years': 4, 'shift_start': '08:00', 'shift_end': '16:00',
            'status': 'active', 'join_date': '2025-01-01',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_create_receptionist_allowed(self):
        self._login('rec1')
        resp = self.client.post('/api/doctors/', {
            'first_name': 'New', 'last_name': 'Doc',
            'email': 'recdoc@test.com', 'phone': '+4444444444',
            'qualification': 'MBBS', 'specializations': ['Surgery'],
            'experience_years': 3, 'shift_start': '09:00', 'shift_end': '17:00',
            'status': 'active', 'join_date': '2025-01-01',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_create_doctor_forbidden(self):
        self._login('doc1')
        resp = self.client.post('/api/doctors/', {
            'first_name': 'New', 'last_name': 'Doc',
            'specializations': ['Surgery'],
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    # --- 6. POST - shift_end before shift_start returns 400 ---
    def test_create_shift_end_before_start(self):
        self._login('admin1')
        resp = self.client.post('/api/doctors/', {
            'first_name': 'Bad', 'last_name': 'Shift',
            'email': 'badshift@test.com',
            'specializations': ['General'],
            'shift_start': '17:00', 'shift_end': '08:00',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # --- 7. POST - empty specializations returns 400 ---
    def test_create_empty_specializations(self):
        self._login('admin1')
        resp = self.client.post('/api/doctors/', {
            'first_name': 'No', 'last_name': 'Spec',
            'email': 'nospec@test.com',
            'specializations': [],
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # --- 8. POST - duplicate phone same org = 400, diff org = 201 ---
    def test_create_duplicate_phone_same_org(self):
        self._login('admin1')
        resp = self.client.post('/api/doctors/', {
            'first_name': 'Dup', 'last_name': 'Phone',
            'email': 'dupphone@test.com',
            'phone': '+1111111111',
            'specializations': ['General'],
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicate_phone_diff_org(self):
        self._login('admin3')
        resp = self.client.post('/api/doctors/', {
            'first_name': 'Other', 'last_name': 'Org',
            'email': 'otherorg@test.com',
            'phone': '+1111111111',
            'specializations': ['General'],
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    # --- 9. DELETE - soft delete, is_active=False, FK intact ---
    def test_destroy_soft_delete(self):
        self._login('admin1')
        resp = self.client.delete(f'/api/doctors/{self.doctor2.id}/')
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

        self.doctor2.refresh_from_db()
        self.assertFalse(self.doctor2.is_active)

        resp = self.client.get('/api/doctors/')
        ids = [d['id'] for d in self._list_results(resp)]
        self.assertNotIn(self.doctor2.id, ids)

    # --- 10. Stats - receptionist gets 200 with correct shape ---
    def test_stats_shape(self):
        self._login('rec1')
        resp = self.client.get(f'/api/doctors/{self.doctor1.id}/stats/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('daily_cases', resp.data)
        self.assertIn('case_types', resp.data)
        self.assertIn('monthly_summary', resp.data)
        self.assertIn('attendance', resp.data)
        self.assertIn('top_conditions', resp.data)
        self.assertEqual(len(resp.data['daily_cases']), 30)
        self.assertEqual(len(resp.data['monthly_summary']), 12)

    # --- 11. Stats - doctor requesting another doctor gets 403 ---
    def test_stats_doctor_other_doctor(self):
        self._login('doc2')
        resp = self.client.get(f'/api/doctors/{self.doctor1.id}/stats/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    # --- 12. Appointments - only that doctor's appointments ---
    def test_appointments_only_own(self):
        self._login('admin1')
        resp = self.client.get(f'/api/doctors/{self.doctor1.id}/appointments/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for a in self._list_results(resp):
            self.assertEqual(a['patient_name'], 'Test Patient')

    # --- 13. Appointments - status filter works ---
    def test_appointments_status_filter(self):
        self._login('admin1')
        resp = self.client.get(f'/api/doctors/{self.doctor1.id}/appointments/?status=completed')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for a in self._list_results(resp):
            self.assertEqual(a['status'], 'completed')

    # --- 14. Checkin - creates attendance, second checkin = 400 ---
    def test_checkin_creates_attendance(self):
        self._login('rec1')
        resp = self.client.post(
            f'/api/doctors/{self.doctor2.id}/checkin/',
            {'checkin_time': '10:05'}, format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['on_time'])

        resp2 = self.client.post(
            f'/api/doctors/{self.doctor2.id}/checkin/',
            {'checkin_time': '10:10'}, format='json',
        )
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)

    # --- 15. Checkout - requires checkin, checkout before checkin = 400 ---
    def test_checkout_requires_checkin(self):
        new_doc = User.objects.create_user(
            username='no_checkin', password='pass', role='doctor',
            organization=self.org1, specializations=['X'],
            shift_start=time(9, 0), shift_end=time(17, 0),
        )
        self._login('rec1')
        resp = self.client.post(
            f'/api/doctors/{new_doc.id}/checkout/',
            {'checkout_time': '17:00'}, format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_checkout_before_checkin(self):
        self._login('rec1')
        resp = self.client.post(
            f'/api/doctors/{self.doctor1.id}/checkout/',
            {'checkout_time': '09:00'}, format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # --- 16. Stats - different org user gets 404 ---
    def test_stats_cross_org_returns_404(self):
        self._login('admin3')
        resp = self.client.get(f'/api/doctors/{self.doctor1.id}/stats/')
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    # --- 17. HasFeature("doctors") blocks disabled org ---
    def test_has_feature_blocks_disabled_org(self):
        self._login('admin2')
        resp = self.client.get('/api/doctors/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
