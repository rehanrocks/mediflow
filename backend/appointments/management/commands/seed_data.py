from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, datetime, timedelta
from organizations.models import Organization, Feature, OrganizationFeature
from users.models import User
from appointments.models import Patient, Appointment

FIXED_TODAY = date(2026, 6, 28)


class Command(BaseCommand):
    help = 'Seeds the database with deterministic demo data matching the frontend'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database...')

        org, _ = Organization.objects.get_or_create(
            slug='downtown-clinic',
            defaults={
                'name': 'Downtown Clinic',
                'display_name': 'Downtown Clinic',
            }
        )

        for key, label in [('appointments', 'Appointments'), ('patients', 'Patients')]:
            feature, _ = Feature.objects.get_or_create(key=key, defaults={'label': label})
            OrganizationFeature.objects.get_or_create(
                organization=org, feature=feature, defaults={'is_enabled': True}
            )

        admin_user = User.objects.filter(username='dana').first()
        if not admin_user:
            admin_user = User.objects.create_user(
                username='dana',
                password='password123',
                email='dana@downtownclinic.com',
                first_name='Dana',
                last_name='Teller',
                role='receptionist',
                organization=org,
                is_staff=True,
            )

        doctor_data = [
            {'username': 'nora', 'first_name': 'Nora', 'last_name': 'Patel', 'email': 'nora@downtownclinic.com'},
            {'username': 'ethan', 'first_name': 'Ethan', 'last_name': 'Morris', 'email': 'ethan@downtownclinic.com'},
            {'username': 'leila', 'first_name': 'Leila', 'last_name': 'Reed', 'email': 'leila@downtownclinic.com'},
        ]
        doctors = {}
        for dd in doctor_data:
            doctor = User.objects.filter(username=dd['username']).first()
            if not doctor:
                doctor = User.objects.create_user(
                    username=dd['username'],
                    password='password123',
                    email=dd['email'],
                    first_name=dd['first_name'],
                    last_name=dd['last_name'],
                    role='doctor',
                    organization=org,
                )
            doctors[dd['first_name'].lower()] = doctor

        patient_data = [
            {
                'full_name': 'Maria Garcia', 'phone': '+15550142111',
                'date_of_birth': date(1979, 4, 18), 'sex': 'Female',
                'marital_status': 'Married', 'address': '24 Cedar Lane, Springfield',
                'weight_kg': 72, 'height_cm': 165, 'physical_activity_level': 'Lightly Active',
                'pre_existing_conditions': ['Post-op hip replacement'],
                'known_allergies': ['Penicillin'],
                'current_medications': ['Ibuprofen'],
                'blood_group': 'O+', 'onboarding_date': date(2025, 2, 12),
            },
            {
                'full_name': 'Robert Johnson', 'phone': '+15550188222',
                'date_of_birth': date(1967, 9, 30), 'sex': 'Male',
                'marital_status': 'Married', 'address': '88 Pine Street, Springfield',
                'weight_kg': 86.4, 'height_cm': 178, 'physical_activity_level': 'Sedentary',
                'pre_existing_conditions': ['Diabetes'],
                'known_allergies': [],
                'current_medications': ['Metformin', 'Atorvastatin'],
                'blood_group': 'A+', 'onboarding_date': date(2024, 11, 20),
            },
            {
                'full_name': 'Aisha Khan', 'phone': '+923001234567',
                'date_of_birth': date(1991, 6, 3), 'sex': 'Female',
                'marital_status': 'Single', 'address': '17 Garden Road, Lahore',
                'weight_kg': 64.2, 'height_cm': 164, 'physical_activity_level': 'Moderately Active',
                'pre_existing_conditions': ['Hypertension'],
                'known_allergies': ['Sulfa drugs'],
                'current_medications': ['Amlodipine'],
                'blood_group': 'B+', 'onboarding_date': date(2025, 5, 4),
            },
            {
                'full_name': 'Daniel Turner', 'phone': '+15550194444',
                'date_of_birth': date(1984, 1, 26), 'sex': 'Male',
                'marital_status': 'Divorced', 'address': '341 North Avenue, Springfield',
                'weight_kg': 79, 'height_cm': 181, 'physical_activity_level': 'Very Active',
                'pre_existing_conditions': [],
                'known_allergies': [],
                'current_medications': [],
                'blood_group': 'AB-', 'onboarding_date': date(2025, 7, 16),
            },
            {
                'full_name': 'Mei Lin', 'phone': '+15550166555',
                'date_of_birth': date(1996, 12, 8), 'sex': 'Female',
                'marital_status': 'Single', 'address': '9 Lake View, Springfield',
                'weight_kg': 58, 'height_cm': 160, 'physical_activity_level': 'Lightly Active',
                'pre_existing_conditions': ['Asthma'],
                'known_allergies': ['Dust'],
                'current_medications': ['Salbutamol inhaler'],
                'blood_group': 'O-', 'onboarding_date': date(2026, 1, 8),
            },
            {
                'full_name': 'Omar Hassan', 'phone': '+15550125666',
                'date_of_birth': date(1962, 3, 12), 'sex': 'Male',
                'marital_status': 'Widowed', 'address': '52 Clinic Road, Springfield',
                'weight_kg': 91, 'height_cm': 173, 'physical_activity_level': 'Sedentary',
                'pre_existing_conditions': ['Cardiology consult', 'Hypertension'],
                'known_allergies': [],
                'current_medications': ['Lisinopril'],
                'blood_group': 'A-', 'onboarding_date': date(2024, 8, 28),
            },
        ]

        patients = {}
        for pd in patient_data:
            patient, _ = Patient.objects.get_or_create(
                phone=pd['phone'], organization=org,
                defaults={k: v for k, v in pd.items() if k != 'phone'}
            )
            patients[pd['full_name']] = patient

        anchor = timezone.make_aware(datetime.combine(FIXED_TODAY, datetime.min.time()))

        appointment_data = [
            {
                'patient': 'Maria Garcia', 'doctor': 'nora',
                'appointment_dt': anchor - timedelta(days=28),
                'reason': 'Surgical recovery review', 'status': 'completed',
                'temperature': '37.1', 'blood_pressure': '118/76',
                'diagnosis': 'Stable post-operative recovery.',
                'treatment_plan': 'Continue mobility exercises and pain management.',
                'medications_prescribed': ['Ibuprofen'],
                'precautions': ['Avoid stairs without support', 'Report swelling immediately'],
                'medical_activity': ['Light walking twice daily'],
                'post_scheduling_notes': 'Follow-up scheduled after mobility assessment.',
                'additional_notes': 'Patient reports improved sleep.',
                'notes': 'Post-op review completed.', 'payment_status': 'paid',
            },
            {
                'patient': 'Robert Johnson', 'doctor': 'ethan',
                'appointment_dt': anchor - timedelta(days=18),
                'reason': 'Glucose control check', 'status': 'completed',
                'temperature': '36.8', 'blood_pressure': '132/84',
                'diagnosis': 'Diabetes follow-up with mild elevation in fasting readings.',
                'treatment_plan': 'Review diet log and continue current medication.',
                'medications_prescribed': ['Metformin'],
                'precautions': ['Avoid skipped meals'],
                'medical_activity': ['20 minute walk after dinner'],
                'post_scheduling_notes': '',
                'additional_notes': 'Bring glucometer next visit.',
                'notes': 'Routine diabetic review.', 'payment_status': 'unpaid',
            },
            {
                'patient': 'Aisha Khan', 'doctor': 'nora',
                'appointment_dt': anchor - timedelta(days=7),
                'reason': 'Blood pressure follow-up', 'status': 'completed',
                'temperature': '', 'blood_pressure': '126/82',
                'diagnosis': 'Blood pressure improving.',
                'treatment_plan': 'Maintain current medication and monitor twice weekly.',
                'medications_prescribed': ['Amlodipine'],
                'precautions': ['Limit high sodium foods'],
                'medical_activity': ['Light walking'],
                'post_scheduling_notes': 'Call if readings exceed 150/95.',
                'additional_notes': '',
                'notes': 'Follow-up visit.', 'payment_status': 'paid',
            },
            {
                'patient': 'Daniel Turner', 'doctor': 'leila',
                'appointment_dt': anchor + timedelta(days=1),
                'reason': 'Routine physical', 'status': 'scheduled',
                'temperature': '', 'blood_pressure': '',
                'notes': '', 'payment_status': 'unpaid',
            },
            {
                'patient': 'Mei Lin', 'doctor': 'ethan',
                'appointment_dt': anchor + timedelta(days=2),
                'reason': 'Cough and breathing concerns', 'status': 'scheduled',
                'temperature': '37.2', 'blood_pressure': '',
                'notes': 'Patient asked for afternoon slot.', 'payment_status': 'unpaid',
            },
            {
                'patient': 'Omar Hassan', 'doctor': 'leila',
                'appointment_dt': anchor + timedelta(days=3),
                'reason': 'Cardiology intake', 'status': 'scheduled',
                'temperature': '', 'blood_pressure': '140/90',
                'notes': 'Bring previous ECG records.', 'payment_status': 'paid',
            },
            {
                'patient': 'Maria Garcia', 'doctor': 'nora',
                'appointment_dt': anchor + timedelta(days=8),
                'reason': 'Mobility progress check', 'status': 'scheduled',
                'temperature': '', 'blood_pressure': '',
                'notes': '', 'payment_status': 'unpaid',
            },
        ]

        if Appointment.objects.filter(organization=org).exists():
            self.stdout.write('  Appointments for Downtown Clinic already exist, skipping')
        else:
            appointments_to_create = []
            for ad in appointment_data:
                patient = patients.get(ad['patient'])
                doctor = doctors.get(ad['doctor'])
                if patient and doctor:
                    appointments_to_create.append(Appointment(
                        organization=org,
                        booked_by=admin_user,
                        patient=patient,
                        doctor=doctor,
                        appointment_dt=ad['appointment_dt'],
                        reason=ad.get('reason', ''),
                        status=ad.get('status', 'scheduled'),
                        notes=ad.get('notes', ''),
                        temperature=ad.get('temperature', ''),
                        blood_pressure=ad.get('blood_pressure', ''),
                        diagnosis=ad.get('diagnosis', ''),
                        treatment_plan=ad.get('treatment_plan', ''),
                        medications_prescribed=ad.get('medications_prescribed', []),
                        precautions=ad.get('precautions', []),
                        medical_activity=ad.get('medical_activity', []),
                        post_scheduling_notes=ad.get('post_scheduling_notes', ''),
                        additional_notes=ad.get('additional_notes', ''),
                        payment_status=ad.get('payment_status', 'unpaid'),
                    ))

            Appointment.objects.bulk_create(appointments_to_create)

        self.stdout.write(self.style.SUCCESS(
            f'Seeded: {Organization.objects.count()} org, '
            f'{User.objects.count()} users, '
            f'{Patient.objects.count()} patients, '
            f'{Appointment.objects.count()} appointments'
        ))
        self.stdout.write(self.style.SUCCESS('Login: dana / password123'))
