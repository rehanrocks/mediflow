from datetime import date
from django.test import TestCase
from rest_framework.test import APIClient

from organizations.models import Organization, Feature, OrganizationFeature
from users.models import User
from staff.models import StaffMember


class StaffAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.downtown = Organization.objects.create(
            slug='downtown-clinic',
            name='Downtown Clinic',
            is_active=True,
        )
        cls.riverside = Organization.objects.create(
            slug='riverside-medical',
            name='Riverside Medical',
            is_active=True,
        )

        staff_feature, _ = Feature.objects.get_or_create(
            key='staff',
            defaults={'label': 'Staff Module', 'description': 'Manage staff'},
        )
        OrganizationFeature.objects.update_or_create(
            organization=cls.downtown,
            feature=staff_feature,
            defaults={'is_enabled': True},
        )
        OrganizationFeature.objects.update_or_create(
            organization=cls.riverside,
            feature=staff_feature,
            defaults={'is_enabled': False},
        )

        cls.admin_downtown = User.objects.create_user(
            username='admin_downtown',
            password='password123',
            first_name='Admin',
            last_name='Downtown',
            role='admin',
            organization=cls.downtown,
        )
        cls.receptionist_downtown = User.objects.create_user(
            username='rec_downtown',
            password='password123',
            first_name='Rec',
            last_name='Downtown',
            role='receptionist',
            organization=cls.downtown,
        )
        cls.doctor_downtown = User.objects.create_user(
            username='doc_downtown',
            password='password123',
            first_name='Doc',
            last_name='Downtown',
            role='doctor',
            organization=cls.downtown,
        )
        cls.admin_riverside = User.objects.create_user(
            username='admin_riverside',
            password='password123',
            first_name='Admin',
            last_name='Riverside',
            role='admin',
            organization=cls.riverside,
        )

        entries = [
            {'full_name': 'Rashid Ali', 'email': 'staff1@downtown.com', 'age': 34, 'phone': '+923011111001',
             'role': 'Ward Boy', 'status': 'active', 'joining_date': date(2020, 6, 1),
             'address': 'House 5, Block A, Lahore'},
            {'full_name': 'Nazia Bibi', 'email': 'staff2@downtown.com', 'age': 28, 'phone': '+923011111002',
             'role': 'Nurse', 'status': 'active', 'joining_date': date(2022, 3, 15),
             'address': 'Flat 3, DHA Phase 4, Lahore', 'notes': 'Night shift preference'},
            {'full_name': 'Tariq Mehmood', 'email': 'staff3@downtown.com', 'age': 45, 'phone': '+923011111003',
             'role': 'Security Guard', 'status': 'active', 'joining_date': date(2018, 1, 10)},
            {'full_name': 'Shabana Kausar', 'email': 'staff4@downtown.com', 'age': 31, 'phone': '+923011111004',
             'role': 'Sweeper', 'status': 'inactive', 'joining_date': date(2021, 8, 20),
             'notes': 'On extended leave'},
            {'full_name': 'Imran Hassan', 'email': 'staff5@downtown.com', 'age': 26, 'phone': '+923011111005',
             'role': 'Nurse', 'status': 'active', 'joining_date': date(2023, 11, 5),
             'address': 'Johar Town, Lahore'},
        ]
        for entry in entries:
            StaffMember.objects.create(
                organization=cls.downtown,
                full_name=entry['full_name'],
                email=entry['email'],
                age=entry['age'],
                phone=entry['phone'],
                address=entry.get('address', ''),
                role=entry['role'],
                status=entry['status'],
                joining_date=entry['joining_date'],
                notes=entry.get('notes'),
            )

        cls.riverside_staff = StaffMember.objects.create(
            organization=cls.riverside,
            full_name='Riverside Staffer',
            email='riverside@riverside.com',
            age=30,
            phone='+923019999999',
            role='Nurse',
            status='active',
            joining_date=date(2024, 1, 1),
        )

    def _client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_01_list_as_admin_downtown(self):
        response = self._client(self.admin_downtown).get('/api/staff/')
        self.assertEqual(response.status_code, 200)
        results = response.data['results']
        self.assertEqual(len(results), 5)
        names = [r['full_name'] for r in results]
        self.assertIn('Rashid Ali', names)

    def test_02_list_as_receptionist_denied(self):
        response = self._client(self.receptionist_downtown).get('/api/staff/')
        self.assertEqual(response.status_code, 403)

    def test_03_list_as_doctor_denied(self):
        response = self._client(self.doctor_downtown).get('/api/staff/')
        self.assertEqual(response.status_code, 403)
        self.assertIn('permission', str(response.data).lower())

    def test_04_list_riverside_feature_disabled(self):
        response = self._client(self.admin_riverside).get('/api/staff/')
        self.assertEqual(response.status_code, 403)

    def test_05_cross_org_isolation(self):
        response = self._client(self.admin_downtown).get('/api/staff/')
        results = response.data['results']
        phone_list = [r['phone'] for r in results]
        self.assertNotIn('+923019999999', phone_list)

    def test_06_retrieve_cross_org_404(self):
        response = self._client(self.admin_downtown).get(
            f'/api/staff/{self.riverside_staff.id}/'
        )
        self.assertEqual(response.status_code, 404)

    def test_07_create_as_receptionist_denied(self):
        response = self._client(self.receptionist_downtown).post('/api/staff/', {
            'full_name': 'Test Staff',
            'email': 'teststaff@downtown.com',
            'age': 25,
            'phone': '+923011111006',
            'role': 'Nurse',
            'status': 'active',
            'joining_date': '2024-06-01',
        })
        self.assertEqual(response.status_code, 403)

    def test_08_create_valid(self):
        response = self._client(self.admin_downtown).post('/api/staff/', {
            'full_name': 'New Staff Member',
            'email': 'newstaff@downtown.com',
            'age': 30,
            'phone': '+923011111010',
            'address': 'Test Address',
            'role': 'Technician',
            'status': 'active',
            'joining_date': '2024-06-01',
            'notes': 'Test notes',
        })
        self.assertEqual(response.status_code, 201)
        data = response.data
        self.assertEqual(data['full_name'], 'New Staff Member')
        self.assertEqual(data['age'], 30)
        self.assertEqual(data['phone'], '+923011111010')
        self.assertEqual(data['address'], 'Test Address')
        self.assertEqual(data['role'], 'Technician')
        self.assertEqual(data['status'], 'active')
        self.assertEqual(data['joining_date'], '2024-06-01')
        self.assertEqual(data['notes'], 'Test notes')
        self.assertIsNotNone(data['id'])
        self.assertIsNotNone(data['created_at'])

    def test_09_create_age_zero(self):
        response = self._client(self.admin_downtown).post('/api/staff/', {
            'full_name': 'Zero Age',
            'email': 'zeroage@downtown.com',
            'age': 0,
            'phone': '+923011111011',
            'role': 'Nurse',
            'status': 'active',
            'joining_date': '2024-06-01',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('age', response.data)

    def test_10_create_age_101(self):
        response = self._client(self.admin_downtown).post('/api/staff/', {
            'full_name': 'Old Age',
            'email': 'oldage@downtown.com',
            'age': 101,
            'phone': '+923011111012',
            'role': 'Nurse',
            'status': 'active',
            'joining_date': '2024-06-01',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('age', response.data)

    def test_11_create_future_joining_date(self):
        from datetime import date, timedelta
        tomorrow = date.today() + timedelta(days=1)
        response = self._client(self.admin_downtown).post('/api/staff/', {
            'full_name': 'Future Joiner',
            'email': 'future@downtown.com',
            'age': 25,
            'phone': '+923011111013',
            'role': 'Nurse',
            'status': 'active',
            'joining_date': tomorrow.isoformat(),
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('joining_date', response.data)

    def test_12_create_empty_role(self):
        response = self._client(self.admin_downtown).post('/api/staff/', {
            'full_name': 'No Role',
            'email': 'norole@downtown.com',
            'age': 25,
            'phone': '+923011111014',
            'role': '',
            'status': 'active',
            'joining_date': '2024-06-01',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('role', response.data)

    def test_13_create_whitespace_role(self):
        response = self._client(self.admin_downtown).post('/api/staff/', {
            'full_name': 'Whitespace Role',
            'email': 'wsrole@downtown.com',
            'age': 25,
            'phone': '+923011111015',
            'role': '   ',
            'status': 'active',
            'joining_date': '2024-06-01',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('role', response.data)

    def test_14_create_padded_role(self):
        response = self._client(self.admin_downtown).post('/api/staff/', {
            'full_name': 'Padded Role',
            'email': 'paddedrole@downtown.com',
            'age': 25,
            'phone': '+923011111016',
            'role': '  Nurse  ',
            'status': 'active',
            'joining_date': '2024-06-01',
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['role'], 'Nurse')

    def test_15_phone_duplicate_same_org(self):
        response = self._client(self.admin_downtown).post('/api/staff/', {
            'full_name': 'Duplicate Phone',
            'email': 'dupphone@downtown.com',
            'age': 25,
            'phone': '+923011111002',
            'role': 'Nurse',
            'status': 'active',
            'joining_date': '2024-06-01',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('phone', response.data)

    def test_16_phone_duplicate_different_org(self):
        Response = self._client(self.admin_downtown).post('/api/staff/', {
            'full_name': 'Cross Org Phone',
            'email': 'crossorg@downtown.com',
            'age': 25,
            'phone': '+923019999999',
            'role': 'Nurse',
            'status': 'active',
            'joining_date': '2024-06-01',
        })
        self.assertEqual(Response.status_code, 201)

    def test_17_invalid_phone_format(self):
        response = self._client(self.admin_downtown).post('/api/staff/', {
            'full_name': 'Bad Phone',
            'email': 'badphone@downtown.com',
            'age': 25,
            'phone': '03001234567',
            'role': 'Nurse',
            'status': 'active',
            'joining_date': '2024-06-01',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('phone', response.data)

    def test_18_delete_hard(self):
        staff_id = StaffMember.objects.filter(
            organization=self.downtown,
            full_name='Imran Hassan',
        ).first().id
        response = self._client(self.admin_downtown).delete(f'/api/staff/{staff_id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(StaffMember.objects.filter(pk=staff_id).exists())

    def test_19_filter_by_status(self):
        response = self._client(self.admin_downtown).get('/api/staff/?status=inactive')
        self.assertEqual(response.status_code, 200)
        results = response.data['results']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['full_name'], 'Shabana Kausar')

    def test_20_search_nurse(self):
        response = self._client(self.admin_downtown).get('/api/staff/?search=nurse')
        self.assertEqual(response.status_code, 200)
        results = response.data['results']
        self.assertEqual(len(results), 2)

    def test_21_filter_by_phone(self):
        response = self._client(self.admin_downtown).get('/api/staff/?phone=%2B923011111001')
        self.assertEqual(response.status_code, 200)
        results = response.data['results']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['full_name'], 'Rashid Ali')
