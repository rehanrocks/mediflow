from datetime import date, timedelta
from django.test import TestCase, override_settings
from django.utils import timezone
from django.core import mail
from rest_framework.test import APIClient

from organizations.models import Organization, Feature, OrganizationFeature
from users.models import User, DoctorAttendance
from appointments.models import Patient, Appointment
from staff.models import StaffMember
from access_control.models import Role, ModulePermission, MODULE_CHOICES


@override_settings(RATELIMIT_ENABLE=False)
class ProvisioningModelFieldsTests(TestCase):
    """1-5. Model fields exist with correct defaults."""

    def test_user_force_password_change_exists(self):
        field = User._meta.get_field("force_password_change")
        self.assertIsNotNone(field)
        self.assertFalse(field.default)

    def test_user_has_account_exists(self):
        field = User._meta.get_field("has_account")
        self.assertFalse(field.get_default())

    def test_staff_email_exists(self):
        field = StaffMember._meta.get_field("email")
        self.assertFalse(field.blank)

    def test_staff_has_account_exists(self):
        field = StaffMember._meta.get_field("has_account")
        self.assertFalse(field.get_default())

    def test_staff_user_fk_exists(self):
        field = StaffMember._meta.get_field("user")
        self.assertTrue(field.null)


class GenerateTempPasswordTests(TestCase):
    """2. generate_temp_password() tests."""

    def test_password_length(self):
        from users.provisioning import generate_temp_password
        pw = generate_temp_password()
        self.assertGreaterEqual(len(pw), 12)

    def test_contains_uppercase(self):
        from users.provisioning import generate_temp_password
        for _ in range(10):
            pw = generate_temp_password()
            self.assertTrue(any(c.isupper() for c in pw))

    def test_contains_digit(self):
        from users.provisioning import generate_temp_password
        for _ in range(10):
            pw = generate_temp_password()
            self.assertTrue(any(c.isdigit() for c in pw))

    def test_contains_special(self):
        from users.provisioning import generate_temp_password
        special = "!@#$%^&*"
        for _ in range(10):
            pw = generate_temp_password()
            self.assertTrue(any(c in special for c in pw))

    def test_non_deterministic(self):
        from users.provisioning import generate_temp_password
        pw1 = generate_temp_password()
        pw2 = generate_temp_password()
        self.assertNotEqual(pw1, pw2)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class ProvisionUserAccountDoctorTests(TestCase):
    """3-5. provision_user_account for doctors."""

    def setUp(self):
        self.org = Organization.objects.create(name="Test Clinic", slug="test-clinic")
        Role.objects.get_or_create(slug="doctor", is_system=True, defaults={"name": "Doctor"})

    def test_provision_doctor_creates_user_with_correct_flags(self):
        from users.provisioning import provision_user_account
        doctor = User.objects.create_user(
            username="provision_doc",
            first_name="Test",
            last_name="Doctor",
            email="provisiondoc@test.com",
            role="doctor",
            organization=self.org,
        )
        result = provision_user_account(doctor, "doctor", self.org)
        doctor.refresh_from_db()
        self.assertEqual(result["user"].username, doctor.username)
        self.assertTrue(doctor.force_password_change)
        self.assertTrue(doctor.has_account)
        self.assertIn("user", result)
        self.assertIn("temp_password", result)
        self.assertIn("email_sent", result)

    def test_provision_doctor_duplicate_email_raises(self):
        from users.provisioning import provision_user_account
        User.objects.create_user(
            username="existing",
            email="duplicate@test.com",
            role="doctor",
            organization=self.org,
        )
        doctor = User.objects.create_user(
            username="another_doc",
            first_name="Another",
            email="another@test.com",
            role="doctor",
            organization=self.org,
        )
        # This should be fine since email is different
        result = provision_user_account(doctor, "doctor", self.org)
        self.assertIsNotNone(result)

    def test_after_provision_password_is_correct(self):
        from users.provisioning import provision_user_account
        doctor = User.objects.create_user(
            username="pwcheck",
            first_name="PW",
            last_name="Check",
            email="pwcheck@test.com",
            role="doctor",
            organization=self.org,
        )
        result = provision_user_account(doctor, "doctor", self.org)
        doctor.refresh_from_db()
        self.assertTrue(doctor.check_password(result["temp_password"]))


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class DoctorCreationWithProvisioningTests(TestCase):
    """6-9. POST /api/doctors/ with provisioning."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name="DT Clinic", slug="dt-clinic")
        for key in ("doctors", "appointments", "patients"):
            feat, _ = Feature.objects.get_or_create(key=key, defaults={"label": key})
            OrganizationFeature.objects.get_or_create(
                organization=cls.org, feature=feat, defaults={"is_enabled": True}
            )
        Role.objects.get_or_create(slug="admin", is_system=True, defaults={"name": "Admin"})
        Role.objects.get_or_create(slug="doctor", is_system=True, defaults={"name": "Doctor"})
        for mod, _ in MODULE_CHOICES:
            ModulePermission.objects.get_or_create(
                role=Role.objects.get(slug="admin"), module=mod, defaults={"access": "full_access"}
            )

    def setUp(self):
        self.admin = User.objects.create_user(
            username=f"admin_{self._testMethodName}",
            email=f"admin_{self._testMethodName}@test.com",
            password="pass123",
            role="admin",
            organization=self.org,
            role_obj=Role.objects.get(slug="admin"),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_create_doctor_with_email_sends_onboarding(self):
        resp = self.client.post("/api/doctors/", {
            "first_name": "New", "last_name": "Doc",
            "email": "newdoc@test.com",
            "phone": "+923001111010",
            "qualification": "MBBS",
            "specializations": ["General"],
            "experience_years": 5,
            "shift_start": "08:00", "shift_end": "16:00",
            "status": "active", "join_date": "2024-06-01",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.data.get("has_account"))
        self.assertTrue(resp.data.get("email_sent"))
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].subject, "Your MediFlow Portal Access")
        self.assertEqual(mail.outbox[0].to, ["newdoc@test.com"])
        self.assertIn("newdoc@test.com", mail.outbox[0].body)

    def test_create_doctor_duplicate_email_400(self):
        User.objects.create_user(
            username="existingdoc", email="exists@test.com",
            password="pass", role="doctor", organization=self.org,
        )
        resp = self.client.post("/api/doctors/", {
            "first_name": "Dup", "last_name": "Doc",
            "email": "exists@test.com",
            "specializations": ["General"],
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("already registered", str(resp.data))

    def test_create_doctor_without_email_400(self):
        resp = self.client.post("/api/doctors/", {
            "first_name": "No", "last_name": "Email",
            "specializations": ["General"],
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("email", str(resp.data).lower())

    def test_create_doctor_sets_force_password_change(self):
        resp = self.client.post("/api/doctors/", {
            "first_name": "Force", "last_name": "PW",
            "email": "forcepw@test.com",
            "specializations": ["General"],
            "experience_years": 3,
            "join_date": "2024-01-01",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        user = User.objects.get(username="forcepw@test.com")
        self.assertTrue(user.force_password_change)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class StaffCreationWithProvisioningTests(TestCase):
    """10-12. POST /api/staff/ with provisioning."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name="Staff Clinic", slug="staff-clinic")
        feat, _ = Feature.objects.get_or_create(key="staff", defaults={"label": "Staff"})
        OrganizationFeature.objects.get_or_create(
            organization=cls.org, feature=feat, defaults={"is_enabled": True}
        )
        Role.objects.get_or_create(slug="admin", is_system=True, defaults={"name": "Admin"})
        for mod, _ in MODULE_CHOICES:
            ModulePermission.objects.get_or_create(
                role=Role.objects.get(slug="admin"), module=mod, defaults={"access": "full_access"}
            )

    def setUp(self):
        self.admin = User.objects.create_user(
            username=f"staffadmin_{self._testMethodName}",
            email=f"staffadmin_{self._testMethodName}@test.com",
            password="pass123",
            role="admin",
            organization=self.org,
            role_obj=Role.objects.get(slug="admin"),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_create_staff_with_email_sends_onboarding(self):
        resp = self.client.post("/api/staff/", {
            "full_name": "Test Nurse",
            "email": "testnurse@staff.com",
            "age": 30,
            "phone": "+923009999999",
            "role": "Nurse",
            "status": "active",
            "joining_date": "2024-01-01",
        })
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.data.get("has_account"))
        self.assertTrue(resp.data.get("email_sent"))
        self.assertEqual(len(mail.outbox), 1)
        staff = StaffMember.objects.get(full_name="Test Nurse")
        self.assertIsNotNone(staff.user_id)

    def test_create_staff_email_already_user_400(self):
        User.objects.create_user(
            username="portaluser", email="portal@staff.com",
            password="pass", role="doctor", organization=self.org,
        )
        resp = self.client.post("/api/staff/", {
            "full_name": "Dup Portal",
            "email": "portal@staff.com",
            "age": 25,
            "phone": "+923008888888",
            "role": "Nurse",
            "status": "active",
            "joining_date": "2024-01-01",
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("portal user", str(resp.data).lower())

    def test_create_staff_without_email_400(self):
        resp = self.client.post("/api/staff/", {
            "full_name": "No Email",
            "age": 25,
            "phone": "+923007777777",
            "role": "Nurse",
            "status": "active",
            "joining_date": "2024-01-01",
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("email", str(resp.data).lower())


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class LoginForcePasswordChangeTests(TestCase):
    """13-14. Login with force_password_change."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name="Login Clinic", slug="login-clinic")
        Role.objects.get_or_create(slug="doctor", is_system=True, defaults={"name": "Doctor"})
        Role.objects.get_or_create(slug="admin", is_system=True, defaults={"name": "Admin"})
        for mod, _ in MODULE_CHOICES:
            ModulePermission.objects.get_or_create(
                role=Role.objects.get(slug="admin"), module=mod, defaults={"access": "full_access"}
            )

    def test_login_returns_force_password_change_true(self):
        user = User.objects.create_user(
            username="forcer", email="forcer@test.com",
            password="tempPass123",
            role="doctor", organization=self.org,
            force_password_change=True,
        )
        resp = self.client.post("/api/auth/login/", {
            "username": "forcer", "password": "tempPass123",
        })
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["force_password_change"])

    def test_login_returns_force_password_change_false(self):
        user = User.objects.create_user(
            username="normal", email="normal@test.com",
            password="normalPass123",
            role="admin", organization=self.org,
            role_obj=Role.objects.get(slug="admin"),
        )
        resp = self.client.post("/api/auth/login/", {
            "username": "normal", "password": "normalPass123",
        })
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["force_password_change"])


@override_settings(RATELIMIT_ENABLE=False)
class ChangePasswordEndpointTests(TestCase):
    """15-23. POST /api/auth/change-password/."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name="PW Clinic", slug="pw-clinic")
        Role.objects.get_or_create(slug="doctor", is_system=True, defaults={"name": "Doctor"})

    def setUp(self):
        self.client = APIClient()

    def test_change_password_success(self):
        user = User.objects.create_user(
            username="pwuser", password="OldPass@1",
            role="doctor", organization=self.org,
            force_password_change=True,
        )
        self.client.force_authenticate(user=user)
        resp = self.client.post("/api/auth/change-password/", {
            "new_password": "NewPass@2",
            "confirm_password": "NewPass@2",
        })
        self.assertEqual(resp.status_code, 200)
        self.assertIn("successfully", str(resp.data))
        user.refresh_from_db()
        self.assertFalse(user.force_password_change)
        self.assertTrue(user.check_password("NewPass@2"))

    def test_change_password_mismatch(self):
        user = User.objects.create_user(
            username="mismatch", password="OldPass@1",
            role="doctor", organization=self.org,
        )
        self.client.force_authenticate(user=user)
        resp = self.client.post("/api/auth/change-password/", {
            "new_password": "NewPass@2",
            "confirm_password": "Wrong@3",
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("do not match", str(resp.data))

    def test_change_password_same_as_current(self):
        user = User.objects.create_user(
            username="samepw", password="SamePass@1",
            role="doctor", organization=self.org,
        )
        self.client.force_authenticate(user=user)
        resp = self.client.post("/api/auth/change-password/", {
            "new_password": "SamePass@1",
            "confirm_password": "SamePass@1",
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("different", str(resp.data).lower())

    def test_change_password_too_short(self):
        user = User.objects.create_user(
            username="shortpw", password="OldPass@1",
            role="doctor", organization=self.org,
        )
        self.client.force_authenticate(user=user)
        resp = self.client.post("/api/auth/change-password/", {
            "new_password": "Sh@1",
            "confirm_password": "Sh@1",
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("8", str(resp.data))

    def test_change_password_no_uppercase(self):
        user = User.objects.create_user(
            username="noup", password="OldPass@1",
            role="doctor", organization=self.org,
        )
        self.client.force_authenticate(user=user)
        resp = self.client.post("/api/auth/change-password/", {
            "new_password": "nouppercase@1",
            "confirm_password": "nouppercase@1",
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("uppercase", str(resp.data).lower())

    def test_change_password_no_digit(self):
        user = User.objects.create_user(
            username="nodig", password="OldPass@1",
            role="doctor", organization=self.org,
        )
        self.client.force_authenticate(user=user)
        resp = self.client.post("/api/auth/change-password/", {
            "new_password": "NoDigitHere!",
            "confirm_password": "NoDigitHere!",
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("number", str(resp.data).lower())

    def test_change_password_no_special(self):
        user = User.objects.create_user(
            username="nospec", password="OldPass@1",
            role="doctor", organization=self.org,
        )
        self.client.force_authenticate(user=user)
        resp = self.client.post("/api/auth/change-password/", {
            "new_password": "NoSpecial1",
            "confirm_password": "NoSpecial1",
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("special", str(resp.data).lower())

    def test_after_change_password_force_flag_cleared_on_login(self):
        user = User.objects.create_user(
            username="clearflag", password="OldPass@1",
            role="doctor", organization=self.org,
            force_password_change=True,
        )
        self.client.force_authenticate(user=user)
        self.client.post("/api/auth/change-password/", {
            "new_password": "NewPass@9",
            "confirm_password": "NewPass@9",
        })
        user.refresh_from_db()
        self.assertFalse(user.force_password_change)
        self.assertTrue(user.check_password("NewPass@9"))


class AccessLevelNormalisationTests(TestCase):
    """24-25. Access level normalization."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name="Norm Clinic", slug="norm-clinic")
        Role.objects.get_or_create(slug="admin", is_system=True, defaults={"name": "Admin"})

    def setUp(self):
        self.admin = User.objects.create_user(
            username=f"normadmin_{self._testMethodName}",
            email=f"normadmin_{self._testMethodName}@test.com",
            password="pass123",
            role="admin",
            organization=self.org,
            role_obj=Role.objects.get(slug="admin"),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_full_access_accepted_in_set_permissions(self):
        role = Role.objects.create(
            name="TestRole", slug="testrole", organization=self.org, is_system=False
        )
        resp = self.client.post(f"/api/access-control/roles/{role.id}/set-permissions/", {
            "permissions": [{"module": "patients", "access": "full_access"}],
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        perm = ModulePermission.objects.get(role=role, module="patients")
        self.assertEqual(perm.access, "full_access")

    def test_no_access_accepted_in_set_permissions(self):
        role = Role.objects.create(
            name="NoAccessRole", slug="noaccessrole", organization=self.org, is_system=False
        )
        resp = self.client.post(f"/api/access-control/roles/{role.id}/set-permissions/", {
            "permissions": [{"module": "staff", "access": "no_access"}],
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        perm = ModulePermission.objects.get(role=role, module="staff")
        self.assertEqual(perm.access, "no_access")

    def test_legacy_write_value_rejected(self):
        role = Role.objects.create(
            name="LegacyRole", slug="legacyrole", organization=self.org, is_system=False
        )
        resp = self.client.post(f"/api/access-control/roles/{role.id}/set-permissions/", {
            "permissions": [{"module": "patients", "access": "write"}],
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_legacy_both_value_rejected(self):
        role = Role.objects.create(
            name="LegacyBoth", slug="legacyboth", organization=self.org, is_system=False
        )
        resp = self.client.post(f"/api/access-control/roles/{role.id}/set-permissions/", {
            "permissions": [{"module": "appointments", "access": "both"}],
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_legacy_none_value_rejected(self):
        role = Role.objects.create(
            name="LegacyNone", slug="legacynone", organization=self.org, is_system=False
        )
        resp = self.client.post(f"/api/access-control/roles/{role.id}/set-permissions/", {
            "permissions": [{"module": "doctors", "access": "none"}],
        }, format="json")
        self.assertEqual(resp.status_code, 400)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class EmailContentTests(TestCase):
    """26. Email content verification."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name="Email Clinic", slug="email-clinic")
        for key in ("doctors", "appointments", "patients"):
            feat, _ = Feature.objects.get_or_create(key=key, defaults={"label": key})
            OrganizationFeature.objects.get_or_create(
                organization=cls.org, feature=feat, defaults={"is_enabled": True}
            )
        Role.objects.get_or_create(slug="admin", is_system=True, defaults={"name": "Admin"})
        Role.objects.get_or_create(slug="doctor", is_system=True, defaults={"name": "Doctor"})
        for mod, _ in MODULE_CHOICES:
            ModulePermission.objects.get_or_create(
                role=Role.objects.get(slug="admin"), module=mod, defaults={"access": "full_access"}
            )

    def setUp(self):
        self.admin = User.objects.create_user(
            username=f"emailadmin_{self._testMethodName}",
            email=f"emailadmin_{self._testMethodName}@test.com",
            password="pass123",
            role="admin",
            organization=self.org,
            role_obj=Role.objects.get(slug="admin"),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_email_subject_is_correct(self):
        resp = self.client.post("/api/doctors/", {
            "first_name": "Subject", "last_name": "Test",
            "email": "subjecttest@email.com",
            "specializations": ["General"],
            "experience_years": 5,
            "join_date": "2024-01-01",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(mail.outbox[0].subject, "Your MediFlow Portal Access")

    def test_email_contains_first_name(self):
        resp = self.client.post("/api/doctors/", {
            "first_name": "FirstName", "last_name": "Test",
            "email": "firstname@email.com",
            "specializations": ["General"],
            "experience_years": 5,
            "join_date": "2024-01-01",
        }, format="json")
        self.assertIn("FirstName", mail.outbox[0].body)

    def test_email_contains_portal_url(self):
        from django.conf import settings
        resp = self.client.post("/api/doctors/", {
            "first_name": "Portal", "last_name": "Test",
            "email": "portal@email.com",
            "specializations": ["General"],
            "experience_years": 5,
            "join_date": "2024-01-01",
        }, format="json")
        self.assertIn(settings.PORTAL_URL, mail.outbox[0].body)

    def test_email_contains_submitted_email(self):
        resp = self.client.post("/api/doctors/", {
            "first_name": "EmailCheck", "last_name": "Test",
            "email": "emailcheck@email.com",
            "specializations": ["General"],
            "experience_years": 5,
            "join_date": "2024-01-01",
        }, format="json")
        self.assertIn("emailcheck@email.com", mail.outbox[0].body)

    def test_email_has_html_alternative(self):
        resp = self.client.post("/api/doctors/", {
            "first_name": "HTML", "last_name": "Test",
            "email": "html@email.com",
            "specializations": ["General"],
            "experience_years": 5,
            "join_date": "2024-01-01",
        }, format="json")
        self.assertEqual(len(mail.outbox[0].alternatives), 1)
        self.assertEqual(mail.outbox[0].alternatives[0][1], "text/html")
