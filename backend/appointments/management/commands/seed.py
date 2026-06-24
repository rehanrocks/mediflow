from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from organizations.models import Organization, Feature, OrganizationFeature
from users.models import User
from appointments.models import Patient, Appointment


class Command(BaseCommand):
    help = 'Seed database with test data'

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

        admin, _ = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@mediclinic.com',
                'first_name': 'Admin',
                'last_name': 'User',
                'role': 'admin',
                'organization': org,
                'is_superuser': True,
                'is_staff': True,
            },
        )
        admin.set_password('admin123')
        admin.save()

        receptionist, _ = User.objects.get_or_create(
            username='reception',
            defaults={
                'email': 'reception@mediclinic.com',
                'first_name': 'Reception',
                'last_name': 'User',
                'role': 'receptionist',
                'organization': org,
            },
        )
        receptionist.set_password('reception123')
        receptionist.save()

        doctor, _ = User.objects.get_or_create(
            username='doctor',
            defaults={
                'email': 'doctor@mediclinic.com',
                'first_name': 'Jane',
                'last_name': 'Smith',
                'role': 'doctor',
                'organization': org,
            },
        )
        doctor.set_password('doctor123')
        doctor.save()

        p1, _ = Patient.objects.get_or_create(
            full_name='Alice Johnson', phone='555-0101',
            defaults={'organization': org, 'age': 34, 'condition': 'Flu'},
        )
        p2, _ = Patient.objects.get_or_create(
            full_name='Bob Williams', phone='555-0102',
            defaults={'organization': org, 'age': 45, 'condition': 'Back pain'},
        )
        p3, _ = Patient.objects.get_or_create(
            full_name='Carol Davis', phone='555-0103',
            defaults={'organization': org, 'age': 28, 'condition': 'Migraine'},
        )

        now = timezone.now()
        Appointment.objects.get_or_create(
            organization=org, patient=p1, appointment_dt=now + timedelta(hours=2),
            defaults={
                'doctor': doctor,
                'booked_by': admin,
                'reason': 'Follow-up checkup',
                'status': 'scheduled',
            },
        )
        Appointment.objects.get_or_create(
            organization=org, patient=p2, appointment_dt=now + timedelta(days=1),
            defaults={
                'doctor': doctor,
                'booked_by': receptionist,
                'reason': 'X-ray review',
                'status': 'scheduled',
            },
        )

        self.stdout.write(self.style.SUCCESS('Seed complete!'))
        self.stdout.write('')
        self.stdout.write('Organization: MediClinic (slug: mediclinic)')
        self.stdout.write('---')
        self.stdout.write('admin     / admin123      (role: admin)')
        self.stdout.write('reception / reception123  (role: receptionist)')
        self.stdout.write('doctor    / doctor123     (role: doctor)')
        self.stdout.write('---')
        self.stdout.write('3 patients, 2 appointments created')
