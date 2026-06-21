from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from organizations.models import Organization, Feature, OrganizationFeature
from users.models import User
from appointments.models import Patient, Appointment


class Command(BaseCommand):
    help = 'Seed demo data — idempotent, org-aware'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding demo data...\n')

        orgs = self._create_organizations()
        self._create_features()
        self._create_org_features(orgs)
        credentials = self._create_users(orgs)
        self._create_patients_and_appointments(orgs)

        self.stdout.write('\n=== Demo Credentials ===')
        for cred in credentials:
            self.stdout.write(cred)

    def _create_organizations(self):
        downtown, _ = Organization.objects.get_or_create(
            slug='downtown-clinic',
            defaults={'name': 'Downtown Clinic', 'is_active': True},
        )
        riverside, _ = Organization.objects.get_or_create(
            slug='riverside-medical',
            defaults={'name': 'Riverside Medical', 'is_active': True},
        )
        self.stdout.write(f'  Organizations: {downtown.name}, {riverside.name}')
        return {'downtown': downtown, 'riverside': riverside}

    def _create_features(self):
        appointments, _ = Feature.objects.get_or_create(
            key='appointments',
            defaults={'label': 'Appointments', 'description': 'Appointment booking and management'},
        )
        patients, _ = Feature.objects.get_or_create(
            key='patients',
            defaults={'label': 'Patients', 'description': 'Patient record management'},
        )
        self.stdout.write(f'  Features: {appointments.key}, {patients.key}')

    def _create_org_features(self, orgs):
        appointments_feat = Feature.objects.get(key='appointments')
        patients_feat = Feature.objects.get(key='patients')

        OrganizationFeature.objects.get_or_create(
            organization=orgs['downtown'],
            feature=appointments_feat,
            defaults={'is_enabled': True},
        )
        OrganizationFeature.objects.get_or_create(
            organization=orgs['downtown'],
            feature=patients_feat,
            defaults={'is_enabled': True},
        )
        OrganizationFeature.objects.get_or_create(
            organization=orgs['riverside'],
            feature=patients_feat,
            defaults={'is_enabled': True},
        )
        org_feat, _ = OrganizationFeature.objects.get_or_create(
            organization=orgs['riverside'],
            feature=appointments_feat,
            defaults={'is_enabled': False},
        )
        self.stdout.write(f'  Downtown Clinic: appointments=On, patients=On')
        self.stdout.write(f'  Riverside Medical: appointments=Off, patients=On')

    def _create_users(self, orgs):
        credentials = []
        password = 'password123'

        for org_key, org in orgs.items():
            if User.objects.filter(username=f'admin_{org.slug}').exists():
                continue

            admin = User.objects.create_user(
                username=f'admin_{org.slug}',
                password=password,
                first_name='Admin',
                last_name=org.name.split()[0],
                role=User.Role.ADMIN,
                organization=org,
            )
            rec1 = User.objects.create_user(
                username=f'rec1_{org.slug}',
                password=password,
                first_name='Alice',
                last_name='Johnson',
                role=User.Role.RECEPTIONIST,
                organization=org,
            )
            rec2 = User.objects.create_user(
                username=f'rec2_{org.slug}',
                password=password,
                first_name='Bob',
                last_name='Williams',
                role=User.Role.RECEPTIONIST,
                organization=org,
            )
            doc1 = User.objects.create_user(
                username=f'doc1_{org.slug}',
                password=password,
                first_name='Dr. Sarah',
                last_name='Chen',
                role=User.Role.DOCTOR,
                organization=org,
            )
            doc2 = User.objects.create_user(
                username=f'doc2_{org.slug}',
                password=password,
                first_name='Dr. Michael',
                last_name='Patel',
                role=User.Role.DOCTOR,
                organization=org,
            )
            self.stdout.write(f'  Created users for {org.name}')

        credentials.append(f'\n--- All passwords: {password} ---')
        credentials.append(f'\nDowntown Clinic:')
        credentials.append(f'  admin_downtown-clinic (admin)')
        credentials.append(f'  rec1_downtown-clinic (receptionist)')
        credentials.append(f'  rec2_downtown-clinic (receptionist)')
        credentials.append(f'  doc1_downtown-clinic (doctor)')
        credentials.append(f'  doc2_downtown-clinic (doctor)')
        credentials.append(f'\nRiverside Medical:')
        credentials.append(f'  admin_riverside-medical (admin)')
        credentials.append(f'  rec1_riverside-medical (receptionist)')
        credentials.append(f'  rec2_riverside-medical (receptionist)')
        credentials.append(f'  doc1_riverside-medical (doctor)')
        credentials.append(f'  doc2_riverside-medical (doctor)')

        return credentials

    def _create_patients_and_appointments(self, orgs):
        downtown = orgs['downtown']
        riverside = orgs['riverside']

        for org in [downtown, riverside]:
            if Patient.objects.filter(organization=org).exists():
                self.stdout.write(f'  Patients for {org.name} already exist, skipping')
                continue

            p1 = Patient.objects.create(
                organization=org,
                full_name='John Martinez',
                phone='555-0101',
                age=45,
                condition='Hypertension',
            )
            p2 = Patient.objects.create(
                organization=org,
                full_name='Emily Davis',
                phone='555-0102',
                age=32,
                condition='Migraine',
            )
            p3 = Patient.objects.create(
                organization=org,
                full_name='Robert Kim',
                phone='555-0103',
                age=58,
                condition='Type 2 Diabetes',
            )
            self.stdout.write(f'  Created 3 patients for {org.name}')

        if not Appointment.objects.filter(organization=downtown).exists():
            p1 = Patient.objects.filter(organization=downtown)[0]
            p2 = Patient.objects.filter(organization=downtown)[1]
            p3 = Patient.objects.filter(organization=downtown)[2]
            doc1 = User.objects.get(username='doc1_downtown-clinic')
            doc2 = User.objects.get(username='doc2_downtown-clinic')
            rec = User.objects.get(username='rec1_downtown-clinic')
            now = timezone.now()
            future = now + timedelta(hours=2)

            Appointment.objects.create(
                organization=downtown,
                patient=p1,
                doctor=doc1,
                booked_by=rec,
                appointment_dt=future,
                reason='Blood pressure checkup',
                status=Appointment.Status.SCHEDULED,
            )
            Appointment.objects.create(
                organization=downtown,
                patient=p2,
                doctor=doc2,
                booked_by=rec,
                appointment_dt=future + timedelta(hours=2),
                reason='Migraine follow-up',
                status=Appointment.Status.IN_PROGRESS,
            )
            Appointment.objects.create(
                organization=downtown,
                patient=p3,
                doctor=doc1,
                booked_by=rec,
                appointment_dt=future + timedelta(days=1),
                reason='Diabetes management',
                status=Appointment.Status.SCHEDULED,
            )
            Appointment.objects.create(
                organization=downtown,
                patient=p1,
                doctor=doc2,
                booked_by=rec,
                appointment_dt=future + timedelta(days=1, hours=4),
                reason='General checkup',
                status=Appointment.Status.CANCELLED,
            )
            self.stdout.write(f'  Created 4 appointments for Downtown Clinic')

        self.stdout.write('  Skipped appointments for Riverside Medical (appointments feature disabled)')
