from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, datetime, timedelta
from organizations.models import Organization, Feature, OrganizationFeature
from users.models import User
from appointments.models import Patient, Appointment


class Command(BaseCommand):
    help = 'Seed database with deterministic test data'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database...')

        org, _ = Organization.objects.get_or_create(
            slug='mediclinic',
            defaults={'name': 'MediClinic', 'is_active': True},
        )

        feat_patients, _ = Feature.objects.get_or_create(
            key='patients',
            defaults={'label': 'Patients', 'description': 'Manage patient records'},
        )
        feat_appointments, _ = Feature.objects.get_or_create(
            key='appointments',
            defaults={'label': 'Appointments', 'description': 'Schedule and manage appointments'},
        )

        for feat in [feat_patients, feat_appointments]:
            OrganizationFeature.objects.get_or_create(
                organization=org, feature=feat,
                defaults={'is_enabled': True},
            )

        admin = User.objects.filter(username='admin').first()
        if not admin:
            admin = User.objects.create_user(
                username='admin',
                password='admin123',
                email='admin@mediclinic.com',
                first_name='Admin',
                last_name='User',
                role='admin',
                organization=org,
                is_superuser=True,
                is_staff=True,
            )

        receptionist = User.objects.filter(username='reception').first()
        if not receptionist:
            receptionist = User.objects.create_user(
                username='reception',
                password='reception123',
                email='reception@mediclinic.com',
                first_name='Reception',
                last_name='User',
                role='receptionist',
                organization=org,
            )

        doctor = User.objects.filter(username='doctor').first()
        if not doctor:
            doctor = User.objects.create_user(
                username='doctor',
                password='doctor123',
                email='doctor@mediclinic.com',
                first_name='Jane',
                last_name='Smith',
                role='doctor',
                organization=org,
            )

        p1, _ = Patient.objects.get_or_create(
            full_name='Alice Johnson', phone='555-0101',
            defaults={
                'organization': org,
                'date_of_birth': date(1990, 3, 15),
                'pre_existing_conditions': ['Flu'],
            },
        )
        p2, _ = Patient.objects.get_or_create(
            full_name='Bob Williams', phone='555-0102',
            defaults={
                'organization': org,
                'date_of_birth': date(1979, 8, 22),
                'pre_existing_conditions': ['Back pain'],
            },
        )
        p3, _ = Patient.objects.get_or_create(
            full_name='Carol Davis', phone='555-0103',
            defaults={
                'organization': org,
                'date_of_birth': date(1996, 1, 7),
                'pre_existing_conditions': ['Migraine'],
            },
        )

        now = timezone.now()
        if not Appointment.objects.filter(organization=org).exists():
            Appointment.objects.bulk_create([
                Appointment(
                    organization=org, patient=p1, doctor=doctor,
                    booked_by=admin,
                    appointment_dt=now + timedelta(days=1, hours=10),
                    reason='Follow-up checkup',
                    status='scheduled',
                ),
                Appointment(
                    organization=org, patient=p2, doctor=doctor,
                    booked_by=receptionist,
                    appointment_dt=now + timedelta(days=2, hours=14),
                    reason='X-ray review',
                    status='scheduled',
                ),
            ])

        self.stdout.write(self.style.SUCCESS('Seed complete!'))
        self.stdout.write('')
        self.stdout.write('Organization: MediClinic (slug: mediclinic)')
        self.stdout.write('---')
        self.stdout.write('admin     / admin123      (role: admin)')
        self.stdout.write('reception / reception123  (role: receptionist)')
        self.stdout.write('doctor    / doctor123     (role: doctor)')
        self.stdout.write('---')
        self.stdout.write('3 patients, 2 appointments created')
