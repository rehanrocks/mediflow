from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta, date, time
from organizations.models import Organization, Feature, OrganizationFeature
from users.models import User, DoctorAttendance
from appointments.models import Patient, Appointment
from staff.models import StaffMember
from access_control.models import Role, ModulePermission, MODULE_CHOICES
from users.models import Qualification


class Command(BaseCommand):
    help = 'Seed demo data — idempotent, org-aware'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding demo data...\n')

        orgs = self._create_organizations()
        self._create_features()
        self._create_org_features(orgs)
        self._seed_access_control(orgs)
        credentials = self._create_users(orgs)
        self._create_patients_and_appointments(orgs)
        self._seed_doctors(orgs)
        self._seed_staff(orgs)

        self.stdout.write('\n=== Demo Credentials ===')
        for cred in credentials:
            self.stdout.write(cred)

        self.stdout.write('\n=== Role Access Summary ===')
        self.stdout.write('-' * 55)
        self.stdout.write('ADMIN         -> Full access to all modules')
        self.stdout.write('RECEPTIONIST  -> Patients (add/edit), Appointments (add/edit),')
        self.stdout.write('                 Doctors (view+add, not edit/delete),')
        self.stdout.write('                 NO staff access, NO dashboard/admin features')
        self.stdout.write('DOCTOR        -> Own appointments (read-only),')
        self.stdout.write('                 Own patients (read-only),')
        self.stdout.write('                 Own dashboard only')
        self.stdout.write('-' * 55)

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
        doctors, _ = Feature.objects.get_or_create(
            key='doctors',
            defaults={'label': 'Doctors Module', 'description': 'Doctor profiles, attendance, and case analytics'},
        )
        staff, _ = Feature.objects.get_or_create(
            key='staff',
            defaults={'label': 'Staff Module', 'description': 'Manage non-clinical clinic staff'},
        )
        self.stdout.write(f'  Features: {appointments.key}, {patients.key}, {doctors.key}, {staff.key}')

    def _create_org_features(self, orgs):
        appointments_feat = Feature.objects.get(key='appointments')
        patients_feat = Feature.objects.get(key='patients')
        doctors_feat = Feature.objects.get(key='doctors')
        staff_feat = Feature.objects.get(key='staff')

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
            organization=orgs['downtown'],
            feature=doctors_feat,
            defaults={'is_enabled': True},
        )
        OrganizationFeature.objects.update_or_create(
            organization=orgs['riverside'],
            feature=patients_feat,
            defaults={'is_enabled': True},
        )
        OrganizationFeature.objects.update_or_create(
            organization=orgs['riverside'],
            feature=doctors_feat,
            defaults={'is_enabled': True},
        )
        OrganizationFeature.objects.update_or_create(
            organization=orgs['riverside'],
            feature=appointments_feat,
            defaults={'is_enabled': True},
        )
        OrganizationFeature.objects.update_or_create(
            organization=orgs['downtown'],
            feature=staff_feat,
            defaults={'is_enabled': True},
        )
        OrganizationFeature.objects.update_or_create(
            organization=orgs['riverside'],
            feature=staff_feat,
            defaults={'is_enabled': True},
        )
        self.stdout.write(f'  Downtown Clinic: appointments=On, patients=On, doctors=On, staff=On')
        self.stdout.write(f'  Riverside Medical: appointments=On, patients=On, doctors=On, staff=On')

    def _seed_access_control(self, orgs):
        SYSTEM_ROLES = [
            {"name": "Admin", "slug": "admin", "description": "Full system access"},
            {"name": "Doctor", "slug": "doctor", "description": "Clinical staff, own patients and appointments"},
            {"name": "Receptionist", "slug": "receptionist", "description": "Front desk, patient and appointment management"},
        ]

        for role_data in SYSTEM_ROLES:
            role, created = Role.objects.get_or_create(
                slug=role_data["slug"],
                is_system=True,
                defaults={
                    "name": role_data["name"],
                    "description": role_data["description"],
                    "organization": None,
                }
            )

        SYSTEM_PERMISSIONS = {
            "admin": {m: "both" for m, _ in MODULE_CHOICES},
            "receptionist": {
                "patients": "both",
                "appointments": "both",
                "doctors": "both",
                "staff": "none",
                "reports": "read",
            },
            "doctor": {
                "patients": "read",
                "appointments": "read",
                "doctors": "read",
                "staff": "none",
                "reports": "none",
            },
        }

        for role_slug, perms in SYSTEM_PERMISSIONS.items():
            role = Role.objects.get(slug=role_slug, is_system=True)
            for module, access in perms.items():
                ModulePermission.objects.update_or_create(
                    role=role, module=module, defaults={"access": access}
                )

        downtown = orgs["downtown"]
        custom_role, _ = Role.objects.get_or_create(
            organization=downtown,
            slug="head-nurse",
            defaults={
                "name": "Head Nurse",
                "description": "Senior nursing staff with patient and appointment access",
                "is_system": False,
            }
        )
        for module, access in [
            ("patients", "both"),
            ("appointments", "both"),
            ("doctors", "read"),
            ("staff", "none"),
            ("reports", "read"),
        ]:
            ModulePermission.objects.update_or_create(
                role=custom_role, module=module, defaults={"access": access}
            )

        self.stdout.write("  System roles: admin, doctor, receptionist (with permissions)")
        self.stdout.write("  Custom role: Head Nurse (Downtown Clinic)")

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

        for org_key, org in orgs.items():
            for user in User.objects.filter(organization=org):
                system_role = Role.objects.filter(slug=user.role, is_system=True).first()
                if system_role and not user.role_obj:
                    user.role_obj = system_role
                    user.save(update_fields=["role_obj"])

        self.stdout.write("  All users linked to role_obj")

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
                date_of_birth=date(1980, 1, 15),
                pre_existing_conditions=['Hypertension'],
            )
            p2 = Patient.objects.create(
                organization=org,
                full_name='Emily Davis',
                phone='555-0102',
                date_of_birth=date(1992, 5, 20),
                pre_existing_conditions=['Migraine'],
            )
            p3 = Patient.objects.create(
                organization=org,
                full_name='Robert Kim',
                phone='555-0103',
                date_of_birth=date(1967, 11, 3),
                pre_existing_conditions=['Type 2 Diabetes'],
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

        self.stdout.write('  Skipped appointments for Riverside Medical (no patients pre-seeded for appointment creation)')

    def _ensure_qualification(self, name):
        first_part = name.split(",")[0].strip()
        if not first_part:
            return None
        q, _ = Qualification.objects.get_or_create(
            name=first_part.lower(),
        )
        return q

    def _seed_doctors(self, orgs):
        import random
        downtown = orgs['downtown']
        reasons = [
            'Chest Pain', 'Fever', 'Routine Checkup', 'Follow Up',
            'Hypertension Review', 'Cough & Cold', 'Diabetes Management',
        ]
        diagnoses = ['Hypertension', 'Viral Fever', 'Stable', 'Migraine', 'Type 2 Diabetes']

        doc1 = User.objects.filter(username='doc1_downtown-clinic').first()
        if doc1:
            doc1.first_name = 'Ahmed'
            doc1.last_name = 'Khan'
            doc1.phone = '+923001234567'
            doc1.qualification = 'MBBS, FCPS (Cardiology)'
            doc1.qualification_obj = self._ensure_qualification('MBBS, FCPS (Cardiology)')
            doc1.specializations = ['Cardiologist', 'Internal Medicine']
            doc1.experience_years = 12
            doc1.shift_start = time(8, 0)
            doc1.shift_end = time(16, 0)
            doc1.join_date = date(2019, 3, 15)
            doc1.status = 'active'
            doc1.save()
            self.stdout.write(f'  Updated doctor: Ahmed Khan (Cardiologist)')

        doc2 = User.objects.filter(username='doc2_downtown-clinic').first()
        if doc2:
            doc2.first_name = 'Sana'
            doc2.last_name = 'Malik'
            doc2.phone = '+923007654321'
            doc2.qualification = 'MBBS, MCPS'
            doc2.qualification_obj = self._ensure_qualification('MBBS, MCPS')
            doc2.specializations = ['General Physician', 'Pediatrics']
            doc2.experience_years = 7
            doc2.shift_start = time(14, 0)
            doc2.shift_end = time(22, 0)
            doc2.join_date = date(2021, 9, 1)
            doc2.status = 'active'
            doc2.save()
            self.stdout.write(f'  Updated doctor: Sana Malik (General Physician)')

        if not doc1 or not doc2:
            self.stdout.write('  Skipping doctor attendance + appointments (doctors not found)')
            return

        today = timezone.localdate()

        for doctor in [doc1, doc2]:
            if DoctorAttendance.objects.filter(doctor=doctor).exists():
                self.stdout.write(f'  Attendance already exists for {doctor.first_name}, skipping')
                continue

            day = today - timedelta(days=29)
            absent_days = set()
            while len(absent_days) < 2:
                d = today - timedelta(days=random.randint(0, 29))
                if d.weekday() < 5:
                    absent_days.add(d)

            while day <= today:
                if day.weekday() >= 5:
                    day += timedelta(days=1)
                    continue

                if day in absent_days:
                    DoctorAttendance.objects.create(
                        doctor=doctor,
                        organization=downtown,
                        date=day,
                    )
                else:
                    is_late = random.choice([True, False])
                    chk_in = doctor.shift_start
                    if is_late:
                        late_minutes = random.randint(5, 30)
                        h = doctor.shift_start.hour
                        m = doctor.shift_start.minute + late_minutes
                        if m >= 60:
                            h += 1
                            m -= 60
                        chk_in = time(h, m)

                    DoctorAttendance.objects.create(
                        doctor=doctor,
                        organization=downtown,
                        date=day,
                        checkin_time=chk_in,
                        checkout_time=doctor.shift_end,
                    )
                day += timedelta(days=1)
            self.stdout.write(f'  Created 14-day attendance for {doctor.first_name}')

        for doctor in [doc1, doc2]:
            existing = Appointment.objects.filter(
                doctor=doctor,
                organization=downtown,
            ).exclude(
                patient__in=Patient.objects.filter(organization=downtown)[:3]
            ).count()
            if existing >= 10:
                self.stdout.write(f'  Extra appointments for {doctor.first_name} already exist, skipping')
                continue

            patients = list(Patient.objects.filter(organization=downtown))
            appts = []
            for i in range(20):
                appt_date = today - timedelta(days=random.randint(0, 29))
                hour = random.randint(9, 17)
                minute = random.choice([0, 15, 30, 45])
                appt_dt = timezone.make_aware(
                    timezone.datetime(appt_date.year, appt_date.month, appt_date.day, hour, minute)
                )

                r = random.random()
                if r < 0.7:
                    st = 'completed'
                elif r < 0.8:
                    st = 'cancelled'
                else:
                    st = 'scheduled'

                reason = random.choice(reasons)
                diagnosis = random.choice(diagnoses) if st == 'completed' else ''

                appts.append(Appointment(
                    organization=downtown,
                    patient=random.choice(patients),
                    doctor=doctor,
                    appointment_dt=appt_dt,
                    reason=reason,
                    status=st,
                    diagnosis=diagnosis,
                    treatment_plan='Standard treatment protocol' if st == 'completed' else '',
                    payment_status=random.choice(['paid', 'unpaid']),
                ))
            Appointment.objects.bulk_create(appts)
            self.stdout.write(f'  Created 20 extra appointments for {doctor.first_name}')

        self.stdout.write('  Doctors seeded: Ahmed Khan, Sana Malik — org: Downtown Clinic')

    def _seed_staff(self, orgs):
        downtown = orgs['downtown']

        if StaffMember.objects.filter(organization=downtown).exists():
            self.stdout.write('  Staff for Downtown Clinic already exist, skipping')
            return

        staff_list = [
            {
                'full_name': 'Rashid Ali',
                'age': 34,
                'phone': '+923011111001',
                'role': 'Ward Boy',
                'status': 'active',
                'joining_date': date(2020, 6, 1),
                'address': 'House 5, Block A, Lahore',
            },
            {
                'full_name': 'Nazia Bibi',
                'age': 28,
                'phone': '+923011111002',
                'role': 'Nurse',
                'status': 'active',
                'joining_date': date(2022, 3, 15),
                'address': 'Flat 3, DHA Phase 4, Lahore',
                'notes': 'Night shift preference',
            },
            {
                'full_name': 'Tariq Mehmood',
                'age': 45,
                'phone': '+923011111003',
                'role': 'Security Guard',
                'status': 'active',
                'joining_date': date(2018, 1, 10),
                'address': '',
            },
            {
                'full_name': 'Shabana Kausar',
                'age': 31,
                'phone': '+923011111004',
                'role': 'Sweeper',
                'status': 'inactive',
                'joining_date': date(2021, 8, 20),
                'address': '',
                'notes': 'On extended leave',
            },
            {
                'full_name': 'Imran Hassan',
                'age': 26,
                'phone': '+923011111005',
                'role': 'Nurse',
                'status': 'active',
                'joining_date': date(2023, 11, 5),
                'address': 'Johar Town, Lahore',
            },
        ]

        for entry in staff_list:
            StaffMember.objects.create(
                organization=downtown,
                full_name=entry['full_name'],
                age=entry['age'],
                phone=entry['phone'],
                address=entry.get('address', ''),
                role=entry['role'],
                status=entry['status'],
                joining_date=entry['joining_date'],
                notes=entry.get('notes'),
            )

        self.stdout.write('  Staff seeded: 5 members for Downtown Clinic')
        self.stdout.write('  Staff feature: ENABLED for all organizations')
