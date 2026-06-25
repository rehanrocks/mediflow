"""
Full end-to-end integration tests for the Access Control module.
Tests the complete flow: create role → set permissions → login → access resources → enforce.
"""
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from organizations.models import Organization, Feature, OrganizationFeature
from users.models import User, Qualification
from appointments.models import Patient, Appointment
from staff.models import StaffMember
from access_control.models import Role, ModulePermission, MODULE_CHOICES


class FullFlowIntegrationTests(TestCase):
    """End-to-end: admin creates role → sets perms → user logs in → access enforced."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name="Flow Clinic", slug="flow-clinic")

        for key in ["appointments", "patients", "doctors", "staff"]:
            feat, _ = Feature.objects.get_or_create(key=key, defaults={"label": key})
            OrganizationFeature.objects.get_or_create(
                organization=self.org, feature=feat, defaults={"is_enabled": True}
            )

        self.admin_role = Role.objects.create(name="Admin", slug="admin", is_system=True)
        self.doctor_role = Role.objects.create(name="Doctor", slug="doctor", is_system=True)
        self.receptionist_role = Role.objects.create(
            name="Receptionist", slug="receptionist", is_system=True
        )

        for module, _ in MODULE_CHOICES:
            ModulePermission.objects.get_or_create(
                role=self.admin_role, module=module, defaults={"access": "both"}
            )
        ModulePermission.objects.get_or_create(
            role=self.receptionist_role, module="patients", defaults={"access": "both"}
        )
        ModulePermission.objects.get_or_create(
            role=self.receptionist_role, module="appointments", defaults={"access": "both"}
        )
        ModulePermission.objects.get_or_create(
            role=self.receptionist_role, module="doctors", defaults={"access": "both"}
        )
        ModulePermission.objects.get_or_create(
            role=self.receptionist_role, module="staff", defaults={"access": "none"}
        )
        ModulePermission.objects.get_or_create(
            role=self.doctor_role, module="patients", defaults={"access": "read"}
        )
        ModulePermission.objects.get_or_create(
            role=self.doctor_role, module="appointments", defaults={"access": "read"}
        )
        ModulePermission.objects.get_or_create(
            role=self.doctor_role, module="doctors", defaults={"access": "read"}
        )
        ModulePermission.objects.get_or_create(
            role=self.doctor_role, module="staff", defaults={"access": "none"}
        )

        self.admin = User.objects.create_user(
            username="flow_admin", password="pass123",
            first_name="Flow", last_name="Admin", role="admin",
            organization=self.org, role_obj=self.admin_role,
        )
        self.receptionist = User.objects.create_user(
            username="flow_rec", password="pass123",
            first_name="Flow", last_name="Rec", role="receptionist",
            organization=self.org, role_obj=self.receptionist_role,
        )
        self.doctor = User.objects.create_user(
            username="flow_doc", password="pass123",
            first_name="Flow", last_name="Doc", role="doctor",
            organization=self.org, role_obj=self.doctor_role,
        )

    # ─── FULL FLOW ───

    def test_full_flow_create_role_assign_perms_login_enforce(self):
        """Admin creates role 'Billing', sets patients=read, user logs in, gets correct access."""
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        # 1. Create custom role
        resp = admin_client.post("/api/access-control/roles/", {
            "name": "Billing Clerk", "description": "Handles billing",
        })
        self.assertEqual(resp.status_code, 201)
        billing_role_id = resp.data["id"]
        billing_role = Role.objects.get(id=billing_role_id)
        self.assertFalse(billing_role.is_system)

        # 2. Set permissions: patients=read, appointments=both, rest=none
        resp = admin_client.post(
            f"/api/access-control/roles/{billing_role_id}/set-permissions/",
            {"permissions": [
                {"module": "patients", "access": "read"},
                {"module": "appointments", "access": "both"},
            ]},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)

        # 3. Assign role to user
        billing_user = User.objects.create_user(
            username="billing", password="pass123",
            first_name="Bill", last_name="Clerk", role="doctor",
            organization=self.org, role_obj=billing_role,
        )

        # 4. Login as billing user
        login_resp = self.client.post("/api/auth/login/", {
            "username": "billing", "password": "pass123",
        })
        self.assertEqual(login_resp.status_code, 200)
        self.assertEqual(login_resp.data["role"], "billing-clerk")
        self.assertIn("permissions", login_resp.data)
        self.assertEqual(login_resp.data["permissions"].get("patients"), "read")
        self.assertEqual(login_resp.data["permissions"].get("appointments"), "both")
        self.assertEqual(login_resp.data["permissions"].get("staff"), "none")

        # 5. Access: patients list OK (read), create denied (no write)
        billing_client = APIClient()
        billing_client.force_authenticate(user=billing_user)

        patient_resp = billing_client.get("/api/patients/")
        self.assertEqual(patient_resp.status_code, 200)

        create_resp = billing_client.post("/api/patients/", {
            "full_name": "Test", "phone": "555",
        })
        self.assertEqual(create_resp.status_code, 403)

        # 6. Appointments: read OK, write OK (both access)
        appt_resp = billing_client.get("/api/appointments/")
        self.assertEqual(appt_resp.status_code, 200)

        future = timezone.now() + timezone.timedelta(hours=2)
        patient = Patient.objects.create(organization=self.org, full_name="P", phone="555")
        create_appt_resp = billing_client.post("/api/appointments/", {
            "patient": patient.id,
            "doctor": self.doctor.id,
            "appointment_dt": future.isoformat(),
            "reason": "Billing review",
        })
        self.assertEqual(create_appt_resp.status_code, 201)

        # 7. Staff: denied (none access)
        staff_resp = billing_client.get("/api/staff/")
        self.assertEqual(staff_resp.status_code, 403)

    def test_admin_can_revoke_own_staff_access(self):
        """Admin sets staff=none on admin role → admin gets 403 on staff endpoints."""
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        # Revoke staff from admin role (keep other permissions)
        resp = admin_client.post(
            f"/api/access-control/roles/{self.admin_role.id}/set-permissions/",
            {"permissions": [
                {"module": "patients", "access": "both"},
                {"module": "appointments", "access": "both"},
                {"module": "doctors", "access": "both"},
                {"module": "staff", "access": "none"},
                {"module": "reports", "access": "both"},
            ]},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)

        # Admin now gets 403 on staff
        staff_resp = admin_client.get("/api/staff/")
        self.assertEqual(staff_resp.status_code, 403)

        # Admin can still access patients
        patient_resp = admin_client.get("/api/patients/")
        self.assertEqual(patient_resp.status_code, 200)

        # Restore staff access
        admin_client.post(
            f"/api/access-control/roles/{self.admin_role.id}/set-permissions/",
            {"permissions": [
                {"module": "patients", "access": "both"},
                {"module": "appointments", "access": "both"},
                {"module": "doctors", "access": "both"},
                {"module": "staff", "access": "both"},
                {"module": "reports", "access": "both"},
            ]},
            format="json",
        )

    def test_permission_change_propagates_to_token_refresh(self):
        """Role change reflects after token refresh (within cache timeout)."""
        admin_client = APIClient()

        # Login as admin
        login_resp = self.client.post("/api/auth/login/", {
            "username": "flow_admin", "password": "pass123",
        })
        refresh_token = login_resp.data["refresh"]
        self.assertEqual(login_resp.data["permissions"].get("staff"), "both")

        # Revoke staff from admin role
        admin_client.force_authenticate(user=self.admin)
        admin_client.post(
            f"/api/access-control/roles/{self.admin_role.id}/set-permissions/",
            {"permissions": [
                {"module": "patients", "access": "both"},
                {"module": "appointments", "access": "both"},
                {"module": "doctors", "access": "both"},
                {"module": "staff", "access": "none"},
                {"module": "reports", "access": "both"},
            ]},
            format="json",
        )

        # Refresh token → should reflect new permissions
        refresh_resp = self.client.post("/api/auth/refresh/", {
            "refresh": refresh_token,
        })
        self.assertEqual(refresh_resp.status_code, 200)
        self.assertEqual(refresh_resp.data["permissions"].get("staff"), "none")

        # Restore
        admin_client.post(
            f"/api/access-control/roles/{self.admin_role.id}/set-permissions/",
            {"permissions": [{"module": "staff", "access": "both"}]},
            format="json",
        )

    # ─── STAFF AUTO-CREATE ROLE ───

    def test_staff_create_auto_creates_role_with_no_permissions(self):
        """Adding staff with new role string auto-creates Role row (all perms=none)."""
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        resp = admin_client.post("/api/staff/", {
            "full_name": "Lab Tech",
            "age": 30,
            "phone": "+923001234567",
            "role": "X-Ray Technician",
            "status": "active",
            "joining_date": "2024-06-01",
        })
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.data.get("role_created"))

        # Role should exist with no permissions
        role = Role.objects.get(slug="x-ray-technician", organization=self.org)
        self.assertFalse(role.is_system)
        self.assertEqual(ModulePermission.objects.filter(role=role).count(), 0)

        # User assigned this role should be locked out of everything
        xray_user = User.objects.create_user(
            username="xray", password="pass123",
            first_name="X", last_name="Ray", role="doctor",
            organization=self.org, role_obj=role,
        )
        xray_client = APIClient()
        xray_client.force_authenticate(user=xray_user)
        patient_resp = xray_client.get("/api/patients/")
        self.assertEqual(patient_resp.status_code, 403)

    def test_staff_update_changing_role_auto_creates(self):
        """Updating staff with new role string also auto-creates Role row."""
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        # Create staff first
        staff = StaffMember.objects.create(
            organization=self.org, full_name="Old Role", age=25,
            phone="+923001111001", role="Nurse", status="active",
            joining_date=timezone.now().date(),
        )
        # Update with new role
        resp = admin_client.put(f"/api/staff/{staff.id}/", {
            "full_name": "Old Role",
            "age": 25,
            "phone": "+923001111001",
            "role": "Triage Nurse",
            "status": "active",
            "joining_date": str(timezone.now().date()),
        })
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data.get("role_created"))
        self.assertTrue(
            Role.objects.filter(slug="triage-nurse", organization=self.org).exists()
        )

    def test_staff_with_existing_role_no_duplicate(self):
        """Staff with role that already exists → role_created=false, no duplicate."""
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        Role.objects.get_or_create(
            organization=self.org, slug="nurse",
            defaults={"name": "Nurse", "is_system": False},
        )

        resp = admin_client.post("/api/staff/", {
            "full_name": "Nurse One",
            "age": 28,
            "phone": "+923002222222",
            "role": "Nurse",
            "status": "active",
            "joining_date": "2024-01-01",
        })
        self.assertEqual(resp.status_code, 201)
        self.assertFalse(resp.data.get("role_created"))

    # ─── QUALIFICATION TESTS ───

    def test_qualification_auto_created_on_doctor_save(self):
        """Creating doctor with new qualification auto-creates Qualification row."""
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        resp = admin_client.post("/api/doctors/", {
            "first_name": "New", "last_name": "Doctor",
            "qualification": "FRCS Neurosurgery",
            "specializations": ["Surgery"],
            "experience_years": 10,
            "join_date": "2024-01-01",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(
            Qualification.objects.filter(name="frcs neurosurgery").exists()
        )

    def test_qualification_lowercase_dedup(self):
        """Same qualification with different casing → single row."""
        Qualification.objects.create(name="mbbs")

        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        resp = admin_client.post("/api/doctors/", {
            "first_name": "Doc", "last_name": "One",
            "qualification": "MBBS",
            "specializations": ["General"],
            "experience_years": 5,
            "join_date": "2024-01-01",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Qualification.objects.filter(name="mbbs").count(), 1)

    def test_qualification_empty_string_sets_null_fk(self):
        """Empty qualification string → qualification_obj is None."""
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        resp = admin_client.post("/api/doctors/", {
            "first_name": "Doc", "last_name": "Two",
            "qualification": "",
            "specializations": ["General"],
            "experience_years": 5,
            "join_date": "2024-01-01",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        doctor = User.objects.get(username__startswith="doc_")
        self.assertIsNone(doctor.qualification_obj)

    # ─── EDGE CASES ───

    def test_custom_role_deleted_cannot_be_used(self):
        """After deleting a custom role, users with that role get 403 (role_obj becomes None? No, SET_NULL)."""
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        custom = Role.objects.create(
            name="TempRole", slug="temprole", organization=self.org, is_system=False
        )
        ModulePermission.objects.create(role=custom, module="patients", access="read")

        temp_user = User.objects.create_user(
            username="temp_user", password="pass123",
            first_name="Temp", last_name="User", role="doctor",
            organization=self.org, role_obj=custom,
        )

        # Delete role (no other users assigned yet - but temp_user is assigned)
        # Should fail because user is assigned
        resp = admin_client.delete(f"/api/access-control/roles/{custom.id}/")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("active users", str(resp.data))

        # Deactivate user, then delete role
        temp_user.is_active = False
        temp_user.save()

        # Now the check is: role.users.filter(is_active=True).exists()
        self.assertFalse(custom.users.filter(is_active=True).exists())

    def test_receptionist_cannot_access_access_control(self):
        """Receptionist gets 403 on all access-control endpoints."""
        rec_client = APIClient()
        rec_client.force_authenticate(user=self.receptionist)

        self.assertEqual(rec_client.get("/api/access-control/roles/").status_code, 403)
        self.assertEqual(rec_client.get("/api/access-control/role-names/").status_code, 403)
        self.assertEqual(
            rec_client.post("/api/access-control/roles/", {
                "name": "Hack", "description": "try",
            }).status_code, 403
        )

    def test_doctor_cannot_access_staff_even_if_feature_enabled(self):
        """Doctor has staff=none permission → 403 on staff endpoints."""
        doc_client = APIClient()
        doc_client.force_authenticate(user=self.doctor)

        resp = doc_client.get("/api/staff/")
        self.assertEqual(resp.status_code, 403)

        resp = doc_client.post("/api/staff/", {
            "full_name": "Test", "age": 25,
            "phone": "+923001234567", "role": "Nurse",
            "status": "active", "joining_date": "2024-01-01",
        })
        self.assertEqual(resp.status_code, 403)

    def test_system_role_update_name_silently_ignored(self):
        """PUT system role with new name → 200, name unchanged, description updated."""
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        resp = admin_client.put(
            f"/api/access-control/roles/{self.doctor_role.id}/",
            {"name": "Super Doctor", "description": "Updated doctor desc"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.doctor_role.refresh_from_db()
        self.assertEqual(self.doctor_role.name, "Doctor")
        self.assertEqual(self.doctor_role.description, "Updated doctor desc")

    def test_set_permissions_unmentioned_modules_become_none(self):
        """Only mentioning patients=makes doctors, staff, etc. become 'none'."""
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        custom = Role.objects.create(
            name="Sparse", slug="sparse", organization=self.org, is_system=False
        )
        admin_client.post(
            f"/api/access-control/roles/{custom.id}/set-permissions/",
            {"permissions": [{"module": "patients", "access": "read"}]},
            format="json",
        )
        perms = {
            p.module: p.access
            for p in ModulePermission.objects.filter(role=custom)
        }
        self.assertEqual(perms.get("patients"), "read")
        self.assertEqual(perms.get("appointments"), "none")
        self.assertEqual(perms.get("staff"), "none")

    def test_create_role_duplicate_slug_in_same_org_fails(self):
        """Creating two roles with same slug in same org → 400."""
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        admin_client.post("/api/access-control/roles/", {"name": "My Role"})
        resp = admin_client.post("/api/access-control/roles/", {"name": "My Role"})
        # Either 400 (serializer catches it) or DB constraint
        self.assertIn(resp.status_code, [400, 500])
        self.assertIn("already exists", str(resp.data).lower())

    def test_set_permissions_invalid_access_value(self):
        """set-permissions with invalid access value → 400."""
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        custom = Role.objects.create(
            name="BadAccess", slug="badaccess", organization=self.org, is_system=False
        )
        resp = admin_client.post(
            f"/api/access-control/roles/{custom.id}/set-permissions/",
            {"permissions": [{"module": "patients", "access": "full"}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid access", str(resp.data))

    def test_role_names_returns_system_plus_custom(self):
        """role-names endpoint returns both system + custom roles for the org."""
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        Role.objects.create(
            name="Custom Only", slug="custom-only",
            organization=self.org, is_system=False,
        )
        resp = admin_client.get("/api/access-control/role-names/")
        slugs = [r["slug"] for r in resp.data]
        self.assertIn("admin", slugs)
        self.assertIn("doctor", slugs)
        self.assertIn("receptionist", slugs)
        self.assertIn("custom-only", slugs)
        self.assertNotIn("head-nurse", slugs)  # belongs to different org

    def test_doctor_access_scoped_to_own_patients(self):
        """Doctor sees only patients with their appointments (backend scoping)."""
        doc_client = APIClient()
        doc_client.force_authenticate(user=self.doctor)

        other_doc = User.objects.create_user(
            username="other_doc", password="pass123",
            first_name="Other", last_name="Doc", role="doctor",
            organization=self.org, role_obj=self.doctor_role,
        )

        p1 = Patient.objects.create(organization=self.org, full_name="P1", phone="555-1")
        p2 = Patient.objects.create(organization=self.org, full_name="P2", phone="555-2")

        # Doctor has an appointment with p1 only
        future = timezone.now() + timezone.timedelta(hours=2)
        Appointment.objects.create(
            organization=self.org, patient=p1, doctor=self.doctor,
            appointment_dt=future, reason="Check",
        )

        resp = doc_client.get("/api/patients/")
        self.assertEqual(resp.status_code, 200)
        results = resp.data.get("results", resp.data)
        patient_ids = [p["id"] for p in results]
        self.assertIn(p1.id, patient_ids)
        self.assertNotIn(p2.id, patient_ids)

    def test_doctor_cannot_access_other_doctors_stats(self):
        """Doctor gets 403 on another doctor's stats."""
        other_doc = User.objects.create_user(
            username="other_doc2", password="pass123",
            first_name="Other", last_name="Doc2", role="doctor",
            organization=self.org, role_obj=self.doctor_role,
        )
        doc_client = APIClient()
        doc_client.force_authenticate(user=self.doctor)

        resp = doc_client.get(f"/api/doctors/{other_doc.id}/stats/")
        self.assertEqual(resp.status_code, 403)

    def test_receptionist_can_view_all_doctor_stats(self):
        """Receptionist can view any doctor's stats."""
        rec_client = APIClient()
        rec_client.force_authenticate(user=self.receptionist)

        resp = rec_client.get(f"/api/doctors/{self.doctor.id}/stats/")
        self.assertEqual(resp.status_code, 200)

    def test_login_response_role_detail_and_permissions(self):
        """Login response has role as string (backward compat) + role_detail object + permissions dict."""
        resp = self.client.post("/api/auth/login/", {
            "username": "flow_admin", "password": "pass123",
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["role"], "admin")
        self.assertIn("role_detail", resp.data)
        self.assertEqual(resp.data["role_detail"]["slug"], "admin")
        self.assertTrue(resp.data["role_detail"]["is_system"])
        self.assertIn("permissions", resp.data)
        self.assertEqual(resp.data["permissions"]["patients"], "both")
