from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from organizations.models import Organization, Feature, OrganizationFeature
from users.models import User
from access_control.models import Role, ModulePermission, MODULE_CHOICES


class AccessControlTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.org = Organization.objects.create(
            name="Test Clinic", slug="test-clinic"
        )

        features = ["appointments", "patients", "doctors", "staff"]
        for key in features:
            feat, _ = Feature.objects.get_or_create(
                key=key, defaults={"label": key.capitalize()}
            )
            OrganizationFeature.objects.get_or_create(
                organization=self.org, feature=feat, defaults={"is_enabled": True}
            )

        self.admin_role = Role.objects.create(
            name="Admin", slug="admin", is_system=True
        )
        self.doctor_role = Role.objects.create(
            name="Doctor", slug="doctor", is_system=True
        )
        self.receptionist_role = Role.objects.create(
            name="Receptionist", slug="receptionist", is_system=True
        )

        for module, _ in MODULE_CHOICES:
            ModulePermission.objects.create(
                role=self.admin_role, module=module, access="both"
            )
        ModulePermission.objects.create(
            role=self.receptionist_role, module="patients", access="both"
        )
        ModulePermission.objects.create(
            role=self.receptionist_role, module="appointments", access="both"
        )
        ModulePermission.objects.create(
            role=self.receptionist_role, module="doctors", access="both"
        )
        ModulePermission.objects.create(
            role=self.receptionist_role, module="staff", access="none"
        )
        ModulePermission.objects.create(
            role=self.receptionist_role, module="reports", access="read"
        )
        ModulePermission.objects.create(
            role=self.doctor_role, module="patients", access="read"
        )
        ModulePermission.objects.create(
            role=self.doctor_role, module="appointments", access="read"
        )
        ModulePermission.objects.create(
            role=self.doctor_role, module="doctors", access="read"
        )
        ModulePermission.objects.create(
            role=self.doctor_role, module="staff", access="none"
        )
        ModulePermission.objects.create(
            role=self.doctor_role, module="reports", access="none"
        )

        self.admin_user = User.objects.create_user(
            username="admin@test.com",
            password="testpass123",
            first_name="Admin",
            last_name="User",
            role="admin",
            organization=self.org,
            role_obj=self.admin_role,
        )
        self.receptionist = User.objects.create_user(
            username="rec@test.com",
            password="testpass123",
            first_name="Rec",
            last_name="User",
            role="receptionist",
            organization=self.org,
            role_obj=self.receptionist_role,
        )
        self.doctor = User.objects.create_user(
            username="doc@test.com",
            password="testpass123",
            first_name="Doc",
            last_name="User",
            role="doctor",
            organization=self.org,
            role_obj=self.doctor_role,
        )

    def _authenticate(self, user):
        self.client.force_authenticate(user=user)

    def _create_user_with_role(self, username, password, role_obj):
        return User.objects.create_user(
            username=username,
            password=password,
            first_name=role_obj.name,
            last_name="User",
            role="doctor",
            organization=self.org,
            role_obj=role_obj,
        )

    # ─── Role CRUD ───

    def test_list_roles_as_admin(self):
        """1. GET /api/access-control/roles/ as admin → 200."""
        self._authenticate(self.admin_user)
        response = self.client.get("/api/access-control/roles/")
        self.assertEqual(response.status_code, 200)
        slugs = [r["slug"] for r in response.data.get("results", response.data)]
        self.assertIn("admin", slugs)
        self.assertIn("doctor", slugs)
        self.assertIn("receptionist", slugs)

    def test_list_roles_as_receptionist(self):
        """2. GET /api/access-control/roles/ as receptionist → 403."""
        self._authenticate(self.receptionist)
        response = self.client.get("/api/access-control/roles/")
        self.assertEqual(response.status_code, 403)

    def test_create_role_as_admin(self):
        """3. POST /api/access-control/roles/ as admin → 201."""
        self._authenticate(self.admin_user)
        response = self.client.post("/api/access-control/roles/", {
            "name": "Lab Technician",
            "description": "Lab access only",
        })
        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            Role.objects.filter(
                slug="lab-technician",
                organization=self.org,
                is_system=False,
            ).exists()
        )

    def test_create_role_empty_name(self):
        """4. POST with name='' → 400."""
        self._authenticate(self.admin_user)
        response = self.client.post("/api/access-control/roles/", {
            "name": "",
        })
        self.assertEqual(response.status_code, 400)

    def test_create_role_short_name(self):
        """5. POST with name='A' (1 char) → 400."""
        self._authenticate(self.admin_user)
        response = self.client.post("/api/access-control/roles/", {
            "name": "A",
        })
        self.assertEqual(response.status_code, 400)

    def test_update_system_role_name_ignored(self):
        """6. PUT system role → name silently ignored, description updated."""
        self._authenticate(self.admin_user)
        response = self.client.put(
            f"/api/access-control/roles/{self.admin_role.id}/",
            {"name": "SuperAdmin", "description": "Updated desc"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.admin_role.refresh_from_db()
        self.assertEqual(self.admin_role.name, "Admin")
        self.assertEqual(self.admin_role.description, "Updated desc")

    def test_set_permissions_on_admin_role(self):
        """6b. set-permissions on admin role → 200, staff=none in DB."""
        self._authenticate(self.admin_user)
        response = self.client.post(
            f"/api/access-control/roles/{self.admin_role.id}/set-permissions/",
            {"permissions": [{"module": "staff", "access": "none"}]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        staff_perm = ModulePermission.objects.get(
            role=self.admin_role, module="staff"
        )
        self.assertEqual(staff_perm.access, "none")

    def test_delete_role_with_active_users(self):
        """7. DELETE custom role with active users → 400."""
        self._authenticate(self.admin_user)
        custom = Role.objects.create(
            name="Assigned", slug="assigned", organization=self.org, is_system=False
        )
        test_user = self._create_user_with_role(
            "assigned_user@test.com", "testpass123", custom
        )
        response = self.client.delete(f"/api/access-control/roles/{custom.id}/")
        self.assertEqual(response.status_code, 400)
        self.assertIn("active users", str(response.data))

    def test_delete_empty_custom_role(self):
        """8. DELETE custom role with no users → 204."""
        self._authenticate(self.admin_user)
        custom = Role.objects.create(
            name="Empty", slug="empty", organization=self.org, is_system=False
        )
        response = self.client.delete(f"/api/access-control/roles/{custom.id}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Role.objects.filter(id=custom.id).exists())

    def test_delete_system_role_blocked(self):
        """9. DELETE system role → 400."""
        self._authenticate(self.admin_user)
        response = self.client.delete(
            f"/api/access-control/roles/{self.doctor_role.id}/"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("System roles cannot be deleted", str(response.data))

    # ─── Permission assignment ───

    def test_set_permissions_custom_role(self):
        """10. set-permissions on custom role → 200, unmentioned set to none."""
        self._authenticate(self.admin_user)
        custom = Role.objects.create(
            name="Limited", slug="limited", organization=self.org, is_system=False
        )
        response = self.client.post(
            f"/api/access-control/roles/{custom.id}/set-permissions/",
            {"permissions": [
                {"module": "patients", "access": "read"},
                {"module": "appointments", "access": "both"},
            ]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        perms = {
            p.module: p.access
            for p in ModulePermission.objects.filter(role=custom)
        }
        self.assertEqual(perms.get("patients"), "read")
        self.assertEqual(perms.get("appointments"), "both")
        self.assertEqual(perms.get("doctors"), "none")

    def test_set_permissions_system_role(self):
        """11. set-permissions on system role → 200."""
        self._authenticate(self.admin_user)
        response = self.client.post(
            f"/api/access-control/roles/{self.doctor_role.id}/set-permissions/",
            {"permissions": [{"module": "staff", "access": "read"}]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        perm = ModulePermission.objects.get(
            role=self.doctor_role, module="staff"
        )
        self.assertEqual(perm.access, "read")

    def test_set_permissions_invalid_module(self):
        """12. set-permissions with invalid module → 400."""
        self._authenticate(self.admin_user)
        custom = Role.objects.create(
            name="Bad", slug="bad", organization=self.org, is_system=False
        )
        response = self.client.post(
            f"/api/access-control/roles/{custom.id}/set-permissions/",
            {"permissions": [{"module": "invalid", "access": "read"}]},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_set_permissions_upsert(self):
        """13. POST twice → second overwrites, no duplicates."""
        self._authenticate(self.admin_user)
        custom = Role.objects.create(
            name="Upsert", slug="upsert", organization=self.org, is_system=False
        )
        self.client.post(
            f"/api/access-control/roles/{custom.id}/set-permissions/",
            {"permissions": [{"module": "patients", "access": "read"}]},
            format="json",
        )
        self.client.post(
            f"/api/access-control/roles/{custom.id}/set-permissions/",
            {"permissions": [{"module": "patients", "access": "both"}]},
            format="json",
        )
        count = ModulePermission.objects.filter(
            role=custom, module="patients"
        ).count()
        self.assertEqual(count, 1)
        perm = ModulePermission.objects.get(role=custom, module="patients")
        self.assertEqual(perm.access, "both")

    # ─── Dynamic permission engine ───

    def test_custom_role_read_permitted_write_denied(self):
        """14. Custom role with patients=read → POST denied, GET allowed."""
        custom = Role.objects.create(
            name="Reader", slug="reader", organization=self.org, is_system=False
        )
        ModulePermission.objects.create(
            role=custom, module="patients", access="read"
        )
        test_user = self._create_user_with_role(
            "reader@test.com", "testpass123", custom
        )
        self._authenticate(test_user)

        get_resp = self.client.get("/api/patients/")
        self.assertEqual(get_resp.status_code, 200)

        post_resp = self.client.post("/api/patients/", {
            "full_name": "Test Patient",
            "phone": "12345",
        })
        self.assertEqual(post_resp.status_code, 403)

    def test_permission_change_takes_effect(self):
        """15. Update role perms → take effect (cache invalidated)."""
        custom = Role.objects.create(
            name="Upgradable", slug="upgradable", organization=self.org,
            is_system=False,
        )
        ModulePermission.objects.create(
            role=custom, module="patients", access="read"
        )
        test_user = self._create_user_with_role(
            "up@test.com", "testpass123", custom
        )
        self._authenticate(test_user)
        post_resp = self.client.post("/api/patients/", {
            "full_name": "Test", "phone": "12345",
        })
        self.assertEqual(post_resp.status_code, 403)

        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin_user)
        admin_client.post(
            f"/api/access-control/roles/{custom.id}/set-permissions/",
            {"permissions": [{"module": "patients", "access": "both"}]},
            format="json",
        )

        post_resp2 = self.client.post("/api/patients/", {
            "full_name": "Test", "phone": "12345",
        })
        self.assertEqual(post_resp2.status_code, 201)

    def test_custom_role_staff_none_denied(self):
        """16. Custom role with staff=none → GET /api/staff/ → 403."""
        custom = Role.objects.create(
            name="NoStaff", slug="no-staff", organization=self.org,
            is_system=False,
        )
        ModulePermission.objects.create(
            role=custom, module="staff", access="none"
        )
        test_user = self._create_user_with_role(
            "nostaff@test.com", "testpass123", custom
        )
        self._authenticate(test_user)
        response = self.client.get("/api/staff/")
        self.assertEqual(response.status_code, 403)

    def test_custom_role_staff_read_granted_write_denied(self):
        """17. Custom role with staff=read → GET ok, POST denied."""
        custom = Role.objects.create(
            name="StaffReader", slug="staff-reader", organization=self.org,
            is_system=False,
        )
        ModulePermission.objects.create(
            role=custom, module="staff", access="read"
        )
        test_user = self._create_user_with_role(
            "sr@test.com", "testpass123", custom
        )
        self._authenticate(test_user)
        get_resp = self.client.get("/api/staff/")
        self.assertEqual(get_resp.status_code, 200)

        post_resp = self.client.post("/api/staff/", {
            "full_name": "Test Staff",
            "age": 25,
            "phone": "+923001234567",
            "role": "Nurse",
            "status": "active",
            "joining_date": "2024-01-01",
        })
        self.assertEqual(post_resp.status_code, 403)

    # ─── Login response ───

    def test_login_response_role_and_permissions(self):
        """18. POST /api/auth/login/ → response contains role + permissions."""
        response = self.client.post("/api/auth/login/", {
            "username": "admin@test.com",
            "password": "testpass123",
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn("role", response.data)
        self.assertIn("role_detail", response.data)
        self.assertEqual(response.data["role"], "admin")
        self.assertEqual(response.data["role_detail"]["slug"], "admin")
        self.assertIn("permissions", response.data)
        self.assertEqual(
            response.data["permissions"].get("patients"), "both"
        )

    def test_login_response_custom_role_permissions(self):
        """19. Login as custom role → permissions reflect DB."""
        custom = Role.objects.create(
            name="Custom", slug="custom", organization=self.org, is_system=False
        )
        ModulePermission.objects.create(
            role=custom, module="patients", access="read"
        )
        test_user = self._create_user_with_role(
            "custom@test.com", "testpass123", custom
        )
        response = self.client.post("/api/auth/login/", {
            "username": "custom@test.com",
            "password": "testpass123",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], "custom")
        self.assertEqual(response.data["role_detail"]["slug"], "custom")
        self.assertEqual(
            response.data["permissions"].get("patients"), "read"
        )

    # ─── Role names dropdown ───

    def test_role_names_as_admin(self):
        """20. GET /api/access-control/role-names/ as admin → 200."""
        self._authenticate(self.admin_user)
        response = self.client.get("/api/access-control/role-names/")
        self.assertEqual(response.status_code, 200)
        slugs = [r["slug"] for r in response.data]
        self.assertIn("admin", slugs)
        self.assertIn("doctor", slugs)

    def test_role_names_as_receptionist(self):
        """21. GET /api/access-control/role-names/ as receptionist → 403."""
        self._authenticate(self.receptionist)
        response = self.client.get("/api/access-control/role-names/")
        self.assertEqual(response.status_code, 403)

    # ─── Backward compatibility ───

    def test_doctor_patient_list(self):
        """23. Doctor: GET /api/patients/ → 200 (scoped to own)."""
        self._authenticate(self.doctor)
        response = self.client.get("/api/patients/")
        self.assertEqual(response.status_code, 200)

    def test_receptionist_create_appointment(self):
        """24. Receptionist: POST /api/appointments/ → 201."""
        self._authenticate(self.receptionist)
        from appointments.models import Patient
        patient = Patient.objects.create(
            organization=self.org,
            full_name="Test Patient",
            phone="12345",
        )
        future = timezone.now() + timezone.timedelta(hours=2)
        response = self.client.post("/api/appointments/", {
            "patient": patient.id,
            "doctor": self.doctor.id,
            "appointment_dt": future.isoformat(),
            "reason": "Checkup",
        })
        self.assertEqual(response.status_code, 201)

    def test_admin_delete_staff(self):
        """25. Admin: DELETE /api/staff/:id/ → 204."""
        self._authenticate(self.admin_user)
        from staff.models import StaffMember
        staff = StaffMember.objects.create(
            organization=self.org,
            full_name="Test Staff",
            age=25,
            phone="+923001111111",
            role="Nurse",
            status="active",
            joining_date=timezone.now().date(),
        )
        response = self.client.delete(f"/api/staff/{staff.id}/")
        self.assertEqual(response.status_code, 204)
