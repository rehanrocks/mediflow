# MediFlow — Access Control Module: Full Implementation Plan
## Backend Plan (for coding agent) + Frontend Spec (for frontend engineer)
## Stack: Django + DRF + PostgreSQL + React + Vite

---

## WHAT THIS MODULE DOES (read before building anything)

Admin can:
1. Create custom roles beyond the 3 built-in ones (admin, doctor, receptionist).
   These custom roles are stored in the database. When staff module creates a
   staff member, the role dropdown shows all roles from DB (built-in + custom).
2. Define per-role permissions: for each module (patients, appointments, doctors,
   staff, reports), choose READ only / WRITE only / READ+WRITE / NO ACCESS.
3. Assign any role (built-in or custom) to any user.
4. The system enforces these DB-stored permissions on every API request — not
   hardcoded in code. A permission change in the UI takes effect on the next
   request, no code deploy needed.

Built-in roles (admin, doctor, receptionist) have their permissions pre-seeded
but ARE fully editable by admin — including changing their module access.
The only things that cannot be changed on built-in roles are their name and slug
(since "admin"/"doctor"/"receptionist" slugs are used for identity checks like
login redirect and dashboard routing). Permissions are fully dynamic for ALL
roles — built-in and custom alike.

---

---

# PART 1 — BACKEND PLAN
# For: coding agent (Django + DRF + PostgreSQL)

---

## Execution Order

| # | Prompt | What it builds |
|---|--------|----------------|
| B1 | Role model | DB table for all roles (built-in + custom) |
| B2 | Permission model | Module-level read/write permissions per role |
| B3 | User.role FK migration | Link User to Role table instead of CharField |
| B4 | Dynamic permission engine | Middleware/mixin that checks DB permissions |
| B5 | Role CRUD API | Endpoints to create/list/update/delete custom roles |
| B6 | Permission assignment API | Endpoints to set module permissions per role |
| B7 | Login response update | Return permissions in login/refresh response |
| B8 | Update existing permission classes | Use DB permissions instead of hardcoded |
| B9 | Seed data | Built-in roles + permissions pre-seeded |
| B10 | Staff role dropdown endpoint | Endpoint serving all roles for staff module |
| B11 | Auto-create Role from Staff role string | StaffMemberViewSet silently creates a Role when a typed role doesn't exist yet |
| B-QA | Tests + checklist | Full QA |

---

## B1 — Role model

```
Create a new app: python manage.py startapp access_control
Add "access_control" to INSTALLED_APPS in settings.py.

In access_control/models.py create:

class Role(models.Model):
  organization  FK → organizations.Organization, CASCADE,
                related_name="roles"
                null=True, blank=True
                — null means SYSTEM role (admin/doctor/receptionist).
                  System roles belong to no org and are shared.
                — non-null means a CUSTOM role created by that org's admin.
  name          CharField, max_length=100
                e.g. "admin", "doctor", "receptionist", "Head Nurse", "Lab Tech"
  slug          SlugField, max_length=120
                auto-generated from name on save (slugify(name)).
                Used as a stable identifier in JWT and permission checks.
  is_system     BooleanField, default=False
                True for admin/doctor/receptionist — these cannot be
                edited or deleted by any admin.
  description   CharField, max_length=255, blank=True
  created_at    DateTimeField, auto_now_add=True

  class Meta:
    unique_together = [
      ("organization", "slug"),   # custom roles unique per org
    ]
    # System roles (organization=null) must also be unique by slug —
    # enforce this in clean():
    #   if self.is_system and Role.objects.filter(
    #     is_system=True, slug=self.slug
    #   ).exclude(pk=self.pk).exists():
    #     raise ValidationError("A system role with this slug already exists.")
    ordering = ["is_system", "name"]
    # is_system=True (system roles) sort first

  def save(self, *args, **kwargs):
    from django.utils.text import slugify
    if not self.slug:
      self.slug = slugify(self.name)
    super().save(*args, **kwargs)

  def __str__(self):
    return self.name

Register in access_control/admin.py:
  list_display = ["name", "slug", "organization", "is_system", "created_at"]
  list_filter  = ["is_system", "organization"]
  readonly_fields = ["slug", "is_system"] for system roles (add
    get_readonly_fields method that returns these when obj.is_system=True)

Run makemigrations access_control and migrate.
Do NOT touch User model yet — that is B3.
```

---

## B2 — ModulePermission model

```
In access_control/models.py add:

MODULE_CHOICES = [
  ("patients",     "Patients"),
  ("appointments", "Appointments"),
  ("doctors",      "Doctors"),
  ("staff",        "Staff"),
  ("reports",      "Reports"),
]

ACCESS_CHOICES = [
  ("none",  "No Access"),
  ("read",  "Read Only"),
  ("write", "Write Only"),
  ("both",  "Read & Write"),
]

class ModulePermission(models.Model):
  role          FK → Role, CASCADE, related_name="module_permissions"
  module        CharField, max_length=50, choices=MODULE_CHOICES
  access        CharField, max_length=10, choices=ACCESS_CHOICES, default="none"

  class Meta:
    unique_together = [("role", "module")]
    # One permission row per role per module. No duplicates.

  def __str__(self):
    return f"{self.role.name} — {self.module}: {self.access}"

  # Helper properties used by the permission engine (B4):
  @property
  def can_read(self):
    return self.access in ["read", "both"]

  @property
  def can_write(self):
    return self.access in ["write", "both"]

Register in access_control/admin.py:
  list_display = ["role", "module", "access"]
  list_filter  = ["module", "access"]

Run makemigrations and migrate.
```

---

## B3 — Migrate User.role from CharField to FK

```
IMPORTANT: This is the most sensitive migration in the module.
Read all steps before executing any of them.

Step 1 — Add new FK field alongside old CharField:
In users/models.py, add:
  role_obj  FK → access_control.Role, SET_NULL, null=True, blank=True,
            related_name="users"
            — temporary name "role_obj" to avoid collision with
              existing "role" CharField.

Run makemigrations users --name add_role_fk and migrate.

Step 2 — Data migration: populate role_obj from existing role string:
Create a data migration:
  python manage.py makemigrations users --empty --name populate_role_fk

In the migration's forwards function:
  def forwards(apps, schema_editor):
    User  = apps.get_model("users", "User")
    Role  = apps.get_model("access_control", "Role")
    for user in User.objects.all():
      if user.role:  # existing CharField value
        try:
          role_obj = Role.objects.get(slug=user.role, is_system=True)
          user.role_obj = role_obj
          user.save(update_fields=["role_obj"])
        except Role.DoesNotExist:
          pass  # will be caught in QA — don't fail the migration

This migration REQUIRES that B9 (seed of system roles) has already run.
Order of operations: run B9 seed BEFORE running this migration.
If seed has not run, role_obj will be null for all users — QA will catch this.

Step 3 — Keep both fields for now. Do NOT drop role CharField yet.
The old "role" CharField stays as a read fallback during transition.
Drop it only after B4 and B8 are complete and all tests pass.
Add a note in the model:
  # DEPRECATED: use role_obj FK instead. Will be removed after access_control
  # module is fully deployed and tested.

Step 4 — Update User.get_role_slug() helper:
Add a property to User:
  @property
  def role_slug(self):
    """
    Single source of truth for role string.
    Reads from role_obj FK if set, falls back to legacy role CharField.
    After migration is complete and verified, this can be simplified to
    just: return self.role_obj.slug if self.role_obj else None
    """
    if self.role_obj_id:
      return self.role_obj.slug
    return self.role  # legacy fallback

Update ALL existing code that reads user.role to use user.role_slug instead:
  - permission classes: user.role == "admin" → user.role_slug == "admin"
  - serializers: role field → role_slug property
  - JWT token generation: inject role_slug into token payload
  Only change the reading side. The writing side (creating users) is handled
  in B5's user creation endpoint.

Run makemigrations and migrate after each step.
```

---

## B4 — Dynamic permission engine

```
Create access_control/permissions.py with the following classes.
These REPLACE the hardcoded role checks in the existing permission classes
once B8 wires them in. Build them here first, wire in B8.

─────────────────────────────────────────
Permission cache helper
─────────────────────────────────────────
Do not hit the DB on every single permission check — that would add 1-2
queries per API request. Instead, use Django's per-request cache:

from django.core.cache import cache

def get_role_permissions(role_id):
  """
  Returns a dict: { "patients": "both", "appointments": "read", ... }
  Cached for 60 seconds per role_id using Django's default cache.
  Cache is invalidated in ModulePermission post_save signal (see below).
  """
  cache_key = f"role_perms_{role_id}"
  cached = cache.get(cache_key)
  if cached is not None:
    return cached

  from access_control.models import ModulePermission
  perms = ModulePermission.objects.filter(role_id=role_id).values("module", "access")
  result = {p["module"]: p["access"] for p in perms}
  cache.set(cache_key, result, timeout=60)
  return result

# Signal to invalidate cache when permissions change:
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

@receiver([post_save, post_delete], sender=ModulePermission)
def invalidate_permission_cache(sender, instance, **kwargs):
  cache_key = f"role_perms_{instance.role_id}"
  cache.delete(cache_key)

Register the signal in access_control/apps.py ready() method.

─────────────────────────────────────────
HasModuleAccess (base permission class)
─────────────────────────────────────────
class HasModuleAccess(BasePermission):
  """
  Factory-style permission class. Usage:
    permission_classes = [IsAuthenticated, HasModuleAccess("patients", "read")]
    permission_classes = [IsAuthenticated, HasModuleAccess("appointments", "write")]

  For system roles (admin/doctor/receptionist), falls back to the existing
  hardcoded rules from the previous RBAC module to maintain backward
  compatibility during transition.

  For custom roles, checks ModulePermission from DB.
  """
  def __init__(self, module, required_access):
    # required_access: "read" | "write" | "both"
    self.module = module
    self.required_access = required_access

  def has_permission(self, request, view):
    user = request.user
    if not user or not user.is_authenticated:
      return False

    role = user.role_obj
    if not role:
      return False

    # ALL roles (system and custom) check DB permissions.
    # The seed data pre-populates correct permissions for system roles.
    # If admin changes a system role's permissions, the change is respected here.
    perms = get_role_permissions(role.id)
    access = perms.get(self.module, "none")

    if self.required_access == "read":
      return access in ["read", "both"]
    if self.required_access == "write":
      return access in ["write", "both"]
    if self.required_access == "both":
      return access == "both"
    return False

  # _check_system_role is no longer needed — removed.
  # All permission logic is DB-driven for every role.

─────────────────────────────────────────
IsAdminRole (update existing)
─────────────────────────────────────────
Update the existing IsAdminRole class to use role_slug:
  def has_permission(self, request, view):
    return (
      request.user and
      request.user.is_authenticated and
      request.user.role_slug == "admin"
    )

─────────────────────────────────────────
IsAdminOrReceptionist (update existing)
─────────────────────────────────────────
  def has_permission(self, request, view):
    return (
      request.user and
      request.user.is_authenticated and
      request.user.role_slug in ["admin", "receptionist"]
    )

─────────────────────────────────────────
UPDATE: CanViewStaffModule (already exists in staff module)
─────────────────────────────────────────
Update to use DB permissions for ALL roles — no hardcoded system role check:

  def has_permission(self, request, view):
    if not request.user or not request.user.is_authenticated:
      return False
    role = request.user.role_obj
    if not role:
      return False
    # DB-driven for all roles including admin/doctor/receptionist.
    # If admin changes the "admin" role's staff permission, it reflects here.
    perms = get_role_permissions(role.id)
    access = perms.get("staff", "none")
    return access in ["read", "write", "both"]

Update the message to: "You do not have permission to access the staff module."
```

---

## B5 — Role CRUD API

```
In access_control/views.py create RoleViewSet.

class RoleViewSet(ModelViewSet):

  serializer_class = RoleSerializer  (see serializers below)

  def get_queryset(self):
    org = self.request.user.organization
    # Return system roles + this org's custom roles
    from django.db.models import Q
    return Role.objects.filter(
      Q(is_system=True) | Q(organization=org)
    ).prefetch_related("module_permissions")

  def get_permissions(self):
    # Only admin can manage roles
    return [IsAuthenticated(), IsAdminRole()]

  def perform_create(self, serializer):
    org = self.request.user.organization
    serializer.save(organization=org, is_system=False)

  def destroy(self, request, *args, **kwargs):
    role = self.get_object()
    if role.is_system:
      return Response(
        {"detail": "System roles cannot be deleted."},
        status=400
      )
    # Check if any users are currently assigned to this role
    if role.users.filter(is_active=True).exists():
      return Response(
        {"detail": "Cannot delete a role that is assigned to active users. "
                   "Reassign those users first."},
        status=400
      )
    return super().destroy(request, *args, **kwargs)

  def update(self, request, *args, **kwargs):
    role = self.get_object()
    if role.is_system:
      # System roles: name and slug are locked, but description CAN be updated.
      # Strip name/slug from payload silently — only allow description change.
      data = request.data.copy()
      data.pop("name", None)
      data.pop("slug", None)
      serializer = self.get_serializer(role, data=data, partial=True)
      serializer.is_valid(raise_exception=True)
      serializer.save()
      return Response(serializer.data)
    return super().update(request, *args, **kwargs)

─────────────────────────────────────────
RoleSerializer — access_control/serializers.py
─────────────────────────────────────────
class ModulePermissionSerializer(ModelSerializer):
  class Meta:
    model = ModulePermission
    fields = ["module", "access", "can_read", "can_write"]
    read_only_fields = ["can_read", "can_write"]

class RoleSerializer(ModelSerializer):
  module_permissions = ModulePermissionSerializer(many=True, read_only=True)
  user_count = SerializerMethodField()

  def get_user_count(self, obj):
    return obj.users.filter(is_active=True).count()

  class Meta:
    model = Role
    fields = [
      "id", "name", "slug", "description", "is_system",
      "module_permissions", "user_count", "created_at"
    ]
    read_only_fields = ["slug", "is_system", "created_at", "user_count"]

class RoleWriteSerializer(ModelSerializer):
  class Meta:
    model = Role
    fields = ["name", "description"]

  def validate_name(self, value):
    if not value or not value.strip():
      raise serializers.ValidationError("Role name is required.")
    if len(value.strip()) < 2:
      raise serializers.ValidationError("Role name must be at least 2 characters.")
    return value.strip()

─────────────────────────────────────────
URLs — access_control/urls.py
─────────────────────────────────────────
router = DefaultRouter()
router.register(r"roles", RoleViewSet, basename="role")
urlpatterns = router.urls

In mediflow/urls.py:
  path("api/access-control/", include("access_control.urls")),

Routes generated:
  GET    /api/access-control/roles/        list all roles (system + org custom)
  POST   /api/access-control/roles/        create custom role
  GET    /api/access-control/roles/:id/    get single role + its permissions
  PUT    /api/access-control/roles/:id/    update custom role name/description
  DELETE /api/access-control/roles/:id/    delete custom role (if no active users)
```

---

## B6 — Permission assignment API

```
In access_control/views.py add:

class ModulePermissionViewSet(ModelViewSet):
  """
  Manage module permissions for a specific role.
  URL: /api/access-control/roles/:role_id/permissions/
  """
  serializer_class = ModulePermissionWriteSerializer
  permission_classes = [IsAuthenticated, IsAdminRole]

  def get_queryset(self):
    role_id = self.kwargs["role_pk"]
    # Ensure the role belongs to this org or is system
    org = self.request.user.organization
    from django.db.models import Q
    role = get_object_or_404(
      Role,
      pk=role_id
    )
    # verify admin can access this role
    if not role.is_system and role.organization != org:
      raise PermissionDenied("You do not have access to this role.")
    # System roles: permission rows ARE editable — no restriction here.
    return ModulePermission.objects.filter(role_id=role_id)

  def create(self, request, *args, **kwargs):
    # Upsert: if a permission for this role+module already exists, update it.
    role_id = self.kwargs["role_pk"]
    module  = request.data.get("module")
    access  = request.data.get("access", "none")
    perm, created = ModulePermission.objects.update_or_create(
      role_id=role_id,
      module=module,
      defaults={"access": access}
    )
    serializer = ModulePermissionSerializer(perm)
    status_code = 201 if created else 200
    return Response(serializer.data, status=status_code)

─────────────────────────────────────────
Bulk permission set endpoint (the main one the UI uses)
─────────────────────────────────────────
Add a custom @action to RoleViewSet:

@action(detail=True, methods=["post"], url_path="set-permissions")
def set_permissions(self, request, pk=None):
  """
  Set all module permissions for a role in one request.
  Body: { permissions: [ { module: "patients", access: "both" }, ... ] }
  Replaces ALL existing permissions for this role.
  Admin only. System roles blocked.
  """
  role = self.get_object()

  # System roles: permissions ARE editable. Name and slug are locked only.
  # No restriction here — all roles go through the same permission-setting logic.

  permissions_data = request.data.get("permissions", [])

  # Validate
  valid_modules = [c[0] for c in MODULE_CHOICES]
  valid_access  = [c[0] for c in ACCESS_CHOICES]
  errors = []
  for item in permissions_data:
    if item.get("module") not in valid_modules:
      errors.append(f"Invalid module: {item.get('module')}")
    if item.get("access") not in valid_access:
      errors.append(f"Invalid access value: {item.get('access')}")
  if errors:
    return Response({"detail": errors}, status=400)

  # Upsert all permissions in a transaction
  from django.db import transaction
  with transaction.atomic():
    for item in permissions_data:
      ModulePermission.objects.update_or_create(
        role=role,
        module=item["module"],
        defaults={"access": item["access"]}
      )
    # Set any unmentioned modules to "none"
    mentioned_modules = {item["module"] for item in permissions_data}
    unmentioned = [m for m in valid_modules if m not in mentioned_modules]
    if unmentioned:
      ModulePermission.objects.filter(
        role=role, module__in=unmentioned
      ).update(access="none")

  # Return full updated role
  serializer = RoleSerializer(role)
  return Response(serializer.data)

─────────────────────────────────────────
ModulePermissionWriteSerializer
─────────────────────────────────────────
class ModulePermissionWriteSerializer(ModelSerializer):
  class Meta:
    model  = ModulePermission
    fields = ["module", "access"]

  def validate_module(self, value):
    valid = [c[0] for c in MODULE_CHOICES]
    if value not in valid:
      raise serializers.ValidationError(f"Must be one of: {valid}")
    return value

  def validate_access(self, value):
    valid = [c[0] for c in ACCESS_CHOICES]
    if value not in valid:
      raise serializers.ValidationError(f"Must be one of: {valid}")
    return value

─────────────────────────────────────────
Add nested URL for permissions:
─────────────────────────────────────────
In access_control/urls.py:
  from rest_framework_nested import routers
  # Install: pip install drf-nested-routers

  router = routers.DefaultRouter()
  router.register(r"roles", RoleViewSet, basename="role")

  roles_router = routers.NestedDefaultRouter(router, r"roles", lookup="role")
  roles_router.register(r"permissions", ModulePermissionViewSet,
                        basename="role-permissions")

  urlpatterns = router.urls + roles_router.urls

This generates:
  GET  /api/access-control/roles/:role_id/permissions/
  POST /api/access-control/roles/:role_id/permissions/   (upsert single)
  POST /api/access-control/roles/:role_id/set-permissions/  (bulk upsert)
```

---

## B7 — Login response update

```
In the existing custom TokenObtainPairSerializer, extend the login response
to include the user's full permission set. This lets the frontend know
immediately on login which modules the user can access, without a separate
permission-fetch request.

In validate() / get_token(), add to the response dict:

  user_role = user.role_obj
  role_data = {
    "id":        user_role.id        if user_role else None,
    "name":      user_role.name      if user_role else user.role_slug,
    "slug":      user_role.slug      if user_role else user.role_slug,
    "is_system": user_role.is_system if user_role else True,
  }

  if user_role:
    # ALL roles (system and custom) fetch permissions from DB.
    # This means even admin/doctor/receptionist permissions are DB-driven
    # and will reflect any changes admin made via the Access Control module.
    perms = ModulePermission.objects.filter(role=user_role).values("module","access")
    permissions = {p["module"]: p["access"] for p in perms}
    if not permissions:
      # No rows yet (e.g. new role just created, seed not run) — safe default
      permissions = {m: "none" for m, _ in MODULE_CHOICES}
  else:
    permissions = {m: "none" for m, _ in MODULE_CHOICES}

  # Add to the response (not just the JWT payload — in the JSON response body):
  response_data["role"]        = role_data
  response_data["permissions"] = permissions
  # permissions shape: { "patients": "both", "appointments": "read", ... }

def _system_role_permissions(role_slug):
  """Hardcoded permission map for built-in roles."""
  if role_slug == "admin":
    return {m: "both" for m, _ in MODULE_CHOICES}
  if role_slug == "receptionist":
    return {
      "patients":     "both",
      "appointments": "both",
      "doctors":      "both",  # can read + create, but edit/delete is admin-only
      "staff":        "none",
      "reports":      "read",
    }
  if role_slug == "doctor":
    return {
      "patients":     "read",
      "appointments": "read",
      "doctors":      "read",
      "staff":        "none",
      "reports":      "none",
    }
  return {m: "none" for m, _ in MODULE_CHOICES}

Also inject permissions into the JWT payload (for stateless verification):
  token["permissions"] = permissions
  token["role_slug"]   = role_data["slug"]

Update TokenRefreshSerializer override (from RBAC plan B1):
  After issuing a new access token, re-fetch the user's current role and
  permissions from DB and re-inject them — same logic as above.
  This ensures a permission change takes effect on next token refresh
  (within 60 seconds max, due to the permission cache timeout).
```

---

## B8 — Update existing permission classes to use dynamic engine

```
This prompt wires HasModuleAccess (built in B4) into the existing ViewSets.
It is a search-and-replace of permission_classes across the codebase.

In appointments/views.py:

PatientViewSet.get_permissions():
  list, retrieve:
    [IsAuthenticated(), HasModuleAccess("patients", "read")]
  create, update, partial_update:
    [IsAuthenticated(), HasModuleAccess("patients", "write")]
  destroy:
    [IsAuthenticated(), IsAdminRole()]
  # Doctor patient scoping (B3 queryset logic) stays unchanged.
  # HasModuleAccess("patients","read") still returns True for doctor
  # via _check_system_role — the scoping is in get_queryset, not here.

AppointmentViewSet.get_permissions():
  list, retrieve:
    [IsAuthenticated(), HasModuleAccess("appointments", "read")]
  create, update, partial_update, update_status:
    [IsAuthenticated(), HasModuleAccess("appointments", "write")]
  destroy:
    [IsAuthenticated(), IsAdminRole()]

In users/views.py:

DoctorViewSet.get_permissions():
  list, retrieve:
    [IsAuthenticated(), HasModuleAccess("doctors", "read")]
  create:
    [IsAuthenticated(), HasModuleAccess("doctors", "write")]
  update, partial_update:
    [IsAuthenticated(), IsAdminRole()]
  destroy:
    [IsAuthenticated(), IsAdminRole()]
  # Checkin/checkout actions: [IsAuthenticated(), IsAdminOrReceptionist()]
  # (unchanged — these are attendance recording, not doctor management)

In staff/views.py:

StaffMemberViewSet.get_permissions():
  list, retrieve:
    [IsAuthenticated(), HasModuleAccess("staff", "read")]
  create, update, partial_update:
    [IsAuthenticated(), HasModuleAccess("staff", "write")]
  destroy:
    [IsAuthenticated(), IsAdminRole()]

HasModuleAccess handles the system role fallback internally (B4), so
removing IsAdminOrReceptionist and CanViewStaffModule from these ViewSets
is safe — HasModuleAccess replaces them.
Keep IsAdminRole on destroy actions — delete is always admin-only regardless
of custom role permissions (this is a safety floor, not a feature gate).

Import HasModuleAccess in each views.py file:
  from access_control.permissions import HasModuleAccess
```

---

## B9 — Seed data

```
In the existing seed_demo management command, add a new section at the TOP
(before any user creation) since B3's data migration depends on roles existing.

─────────────────────────────────────────
Seed system roles (idempotent get_or_create):
─────────────────────────────────────────
SYSTEM_ROLES = [
  {"name": "Admin",        "slug": "admin",        "description": "Full system access"},
  {"name": "Doctor",       "slug": "doctor",       "description": "Clinical staff, own patients and appointments"},
  {"name": "Receptionist", "slug": "receptionist", "description": "Front desk, patient and appointment management"},
]

for role_data in SYSTEM_ROLES:
  role, created = Role.objects.get_or_create(
    slug=role_data["slug"],
    is_system=True,
    defaults={
      "name":         role_data["name"],
      "description":  role_data["description"],
      "organization": None,  # system roles have no org
    }
  )

─────────────────────────────────────────
Seed system role permissions (idempotent):
─────────────────────────────────────────
SYSTEM_PERMISSIONS = {
  "admin": {m: "both" for m, _ in MODULE_CHOICES},
  "receptionist": {
    "patients":     "both",
    "appointments": "both",
    "doctors":      "both",
    "staff":        "none",
    "reports":      "read",
  },
  "doctor": {
    "patients":     "read",
    "appointments": "read",
    "doctors":      "read",
    "staff":        "none",
    "reports":      "none",
  },
}

for role_slug, perms in SYSTEM_PERMISSIONS.items():
  role = Role.objects.get(slug=role_slug, is_system=True)
  for module, access in perms.items():
    ModulePermission.objects.update_or_create(
      role=role, module=module, defaults={"access": access}
    )

─────────────────────────────────────────
Seed one custom role for Downtown Clinic (for demo):
─────────────────────────────────────────
downtown = Organization.objects.get(slug="downtown-clinic")
custom_role, _ = Role.objects.get_or_create(
  organization=downtown,
  slug="head-nurse",
  defaults={
    "name":        "Head Nurse",
    "description": "Senior nursing staff with patient and appointment access",
    "is_system":   False,
  }
)
# Head Nurse: read+write patients and appointments, read doctors, no staff
for module, access in [
  ("patients",     "both"),
  ("appointments", "both"),
  ("doctors",      "read"),
  ("staff",        "none"),
  ("reports",      "read"),
]:
  ModulePermission.objects.update_or_create(
    role=custom_role, module=module, defaults={"access": access}
  )

─────────────────────────────────────────
Assign role_obj to all existing seeded users:
─────────────────────────────────────────
After creating all users, set role_obj:
  for user in User.objects.filter(organization=downtown):
    system_role = Role.objects.filter(slug=user.role, is_system=True).first()
    if system_role and not user.role_obj:
      user.role_obj = system_role
      user.save(update_fields=["role_obj"])

Print:
  "Access Control seeded:"
  "  System roles: admin, doctor, receptionist (with permissions)"
  "  Custom role: Head Nurse (Downtown Clinic)"
  "  All downtown users linked to role_obj"
```

---

## B10 — Role dropdown endpoint for Staff module

```
The Staff module's "Role" field is a free-text CharField on StaffMember
(separate from the User role system — a staff member is not a system user).
The Access Control module adds a new requirement: when admin creates a
staff member, the role dropdown shows all Role names from the DB
(system + org custom) as suggestions, PLUS an "Other (type your own)"
option so the admin can still type any free text.

Add a simple list endpoint:

In access_control/views.py:

class RoleNamesView(APIView):
  """
  Returns all role names for the role dropdown in the Staff module.
  This is NOT the same as the full role list with permissions —
  it is a lightweight name list for dropdowns only.
  """
  permission_classes = [IsAuthenticated, IsAdminRole]

  def get(self, request):
    org = request.user.organization
    from django.db.models import Q
    roles = Role.objects.filter(
      Q(is_system=True) | Q(organization=org)
    ).values("id", "name", "slug", "is_system").order_by("is_system", "name")
    return Response(list(roles))

Wire in access_control/urls.py:
  path("role-names/", RoleNamesView.as_view(), name="role-names"),

Route: GET /api/access-control/role-names/
Returns: [{ id, name, slug, is_system }, ...]
e.g.: [
  { "id": 1, "name": "Admin",        "slug": "admin",        "is_system": true },
  { "id": 2, "name": "Doctor",       "slug": "doctor",       "is_system": true },
  { "id": 3, "name": "Receptionist", "slug": "receptionist", "is_system": true },
  { "id": 4, "name": "Head Nurse",   "slug": "head-nurse",   "is_system": false },
]

The frontend renders these as dropdown options + "Other..." at the bottom.
If admin picks "Other", a text input appears for free-form entry.
```

---

## B11 — Auto-create Role from Staff role string

```
PROBLEM: Staff module's "Role" field (B10) is free text. Admin can type
"Lab Technician" even if no such Role exists in the access_control Role
table yet. Today that string just sits on StaffMember.role with no
corresponding Role row — so it never shows up in Access Control to have
permissions assigned to it.

FIX: When a staff member is created or updated with a role string that
doesn't exist yet as a Role for that org, auto-create the Role row
silently. No new screen, no separate API call from the frontend — it
happens inside the existing staff save flow.

New endpoint (for completeness / admin-triggered re-sync, not required
for the normal flow since perform_create/perform_update handle it
automatically):
  POST /api/access-control/roles/from-staff/
  Body: { role_name: string }
  Behavior: same as _ensure_role_exists() below — get_or_create a Role
  for request.user.organization from the given name. Returns the
  RoleObject (200 if it already existed, 201 if newly created).
  This is mainly a safety net / manual trigger; the staff save flow
  below does NOT call this endpoint — it runs the same logic in-process.

In staff/views.py, update StaffMemberViewSet:

def perform_create(self, serializer):
    staff = serializer.save(
        organization=self.request.user.organization
    )
    self._ensure_role_exists(staff.role, self.request.user.organization)

def perform_update(self, serializer):
    staff = serializer.save()
    self._ensure_role_exists(staff.role, self.request.user.organization)

def _ensure_role_exists(self, role_name, organization):
    from django.utils.text import slugify
    from access_control.models import Role
    if not role_name:
        return
    Role.objects.get_or_create(
        organization=organization,
        slug=slugify(role_name),
        defaults={
            "name":      role_name,
            "is_system": False,
        }
    )
    # ModulePermission rows are NOT created here —
    # new role starts with no permissions (all "none" by default).
    # Admin must go to the Access Control page to assign permissions.

Notes:
- get_or_create on (organization, slug) makes this idempotent. If
  "Lab Technician" already exists as a Role for this org, nothing
  happens — no duplicate, no error.
- If it's new, the Role row is created with is_system=False,
  organization=admin's org, and NO ModulePermission rows. The dynamic
  permission engine (B4) already treats a missing ModulePermission row
  as "none" by default, so this new role is effectively locked out of
  every module until the admin explicitly assigns permissions on the
  Access Control page.
- No migration needed for this prompt — Role and ModulePermission
  already exist from B1/B2.
- This must run for BOTH create and update, since an admin editing an
  existing staff member can also type a brand new role string into the
  "Other..." field.
- Serializer should return whether a new role was created so the
  frontend can show the toast described in F4 below. Add a
  response-only field, e.g. include `role_created: bool` in the
  StaffMemberViewSet response by checking the `created` flag from
  get_or_create and attaching it to the response data in create()/
  update() (DRF ModelViewSet.create/update already call
  perform_create/perform_update — override create()/update() just
  enough to merge this flag into response.data, or store it as an
  instance attribute set in _ensure_role_exists() and read it back
  after perform_create/perform_update runs).

QA:
[ ] Create staff with role="Receptionist" (existing system role) →
    no new Role row created, get_or_create returns existing one.
[ ] Create staff with role="Lab Technician" (new) → new Role row
    created: name="Lab Technician", slug="lab-technician",
    organization=admin's org, is_system=False, zero ModulePermission
    rows.
[ ] Create staff with role="Lab Technician" again (same org) → no
    duplicate Role row; get_or_create finds existing one.
[ ] Two different orgs both create staff with role="Lab Technician" →
    two separate Role rows (one per org, since unique_together is
    (organization, slug)).
[ ] Update an existing staff member's role from "Receptionist" to a
    brand-new string "Triage Nurse" → new Role row created at update
    time, same as create.
[ ] New auto-created role appears in Access Control role list with
    all modules defaulting to "No Access".
[ ] Assigning permissions to the new role on Access Control page
    works exactly like any other custom role.
```

---

## B-QA — Tests + checklist

### Test prompt
```
Write Django TestCase classes in access_control/tests.py.
Use APIClient + force_authenticate throughout.

─── Role CRUD ───
1.  GET /api/access-control/roles/ as admin →
    200, list includes system roles (admin/doctor/receptionist)
    AND org's custom role (Head Nurse from seed).

2.  GET /api/access-control/roles/ as receptionist → 403.

3.  POST /api/access-control/roles/ as admin with
    { "name": "Lab Technician", "description": "Lab access only" } →
    201, role created with is_system=False, organization=admin's org.

4.  POST /api/access-control/roles/ with name="" → 400.

5.  POST /api/access-control/roles/ with name="Ad" (1 char) → 400
    (min 2 chars).

6.  PUT /api/access-control/roles/:admin_role_id/ with { "name": "SuperAdmin" } →
    200, BUT name is silently ignored and remains "Admin" (name+slug locked).
    PUT with { "description": "Updated desc" } → 200, description updated.

6b. POST /api/access-control/roles/:admin_role_id/set-permissions/ with
    { permissions: [{ module: "staff", access: "none" }] } →
    200, admin role's staff permission updated in DB.
    Confirm: an admin user hitting GET /api/staff/ now gets 403
    (permission is now DB-enforced, not hardcoded).

7.  DELETE /api/access-control/roles/:custom_role_id/ with active users
    assigned → 400 "Cannot delete a role that is assigned to active users."

8.  DELETE /api/access-control/roles/:custom_role_id/ with no users →
    204, role gone from DB.

9.  DELETE /api/access-control/roles/:system_role_id/ → 400
    "System roles cannot be deleted."

─── Permission assignment ───
10. POST /api/access-control/roles/:custom_id/set-permissions/ with:
    { permissions: [
      { module: "patients", access: "read" },
      { module: "appointments", access: "both" }
    ]} → 200, permissions stored in DB.
    Modules not mentioned (doctors, staff, reports) set to "none".

11. POST /api/access-control/roles/:system_id/set-permissions/ →
    200, permissions updated. Verify in DB that ModulePermission rows
    for that system role now reflect the new values.

12. POST /api/access-control/roles/:custom_id/set-permissions/ with
    invalid module name → 400 with error detail.

13. POST twice with different values → second call overwrites first
    (upsert, not duplicate). DB has exactly one row per role+module.

─── Dynamic permission engine ───
14. Create a custom role with module_permission patients=read.
    Assign a user to this role.
    POST /api/patients/ as that user → 403 (write not granted).
    GET /api/patients/ as that user → 200 (read granted).

15. Update the same role's patients permission to "both".
    Wait up to 60 seconds (or manually clear cache in test).
    POST /api/patients/ as that user → 201 (write now granted).
    This confirms dynamic enforcement — no code deploy needed.

16. Custom role with staff=none.
    GET /api/staff/ as that user → 403.

17. Custom role with staff=read.
    GET /api/staff/ as that user → 200.
    POST /api/staff/ as that user → 403 (write not granted).

─── Login response ───
18. POST /api/auth/login/ as admin → response contains:
    "role": { "id": N, "name": "Admin", "slug": "admin", "is_system": true }
    "permissions": { "patients": "both", "appointments": "both", ... }

19. POST /api/auth/login/ as custom role user → response contains:
    "permissions" reflecting that role's actual DB permissions.

─── Role names dropdown ───
20. GET /api/access-control/role-names/ as admin → 200, list includes
    system roles + custom roles, each with id/name/slug/is_system.

21. GET /api/access-control/role-names/ as receptionist → 403.

─── Backward compatibility ───
22. All existing tests from previous modules still pass.
    Run: python manage.py test — zero failures.

23. system role "doctor": GET /api/patients/ → scoped to own patients (B3 rule intact).
24. system role "receptionist": POST /api/appointments/ → 201 (unchanged).
25. system role "admin": DELETE /api/staff/:id/ → 204 (unchanged).

Run: python manage.py test access_control
Run: python manage.py test  (full suite)
```

### Manual QA checklist
```
[ ] python manage.py seed_demo → system roles created, Head Nurse custom role created
[ ] GET /api/access-control/roles/ (admin) → system roles + Head Nurse in list
[ ] Each role in list includes module_permissions array and user_count
[ ] POST new custom role "Lab Tech" → created, appears in next GET
[ ] POST /api/access-control/roles/:lab_tech_id/set-permissions/ with
    { permissions: [{ module: "patients", access: "read" }] } →
    200, patients=read stored, all other modules set to none
[ ] Assign Lab Tech role to a test user (via Django Admin / User edit)
[ ] GET /api/patients/ as Lab Tech user → 200
[ ] POST /api/patients/ as Lab Tech user → 403 (write not granted)
[ ] Change Lab Tech patients permission to "both" via
    POST /api/access-control/roles/:id/set-permissions/
[ ] Immediately GET /api/patients/ and POST /api/patients/ as Lab Tech → both 200
    (cache invalidated by signal, new permission takes effect within 60s)
[ ] DELETE custom role with active users → 400 clear error message
[ ] DELETE system role "doctor" → 400 clear error message
[ ] PUT system role "admin" → 400 clear error message
[ ] Login as any user → response has "role" object AND "permissions" dict
[ ] GET /api/access-control/role-names/ → returns all roles as flat list
[ ] All previous module tests pass (no regressions)
```

---
---

# PART 2 — FRONTEND SPEC
# For: frontend engineer (React + Vite + Tailwind)
# Design system: Outfit (sans), JetBrains Mono (mono), brand #4338CA,
# canvas #FFFFFF, mist #F6F8F9, hairline #E4E8EB, slate #5B6472

---

## Overview of frontend changes

1. AuthContext extended: stores `permissions` dict from login response.
2. New `usePermission()` hook: single source of truth for all access checks.
3. New /access-control page (admin-only): manage roles + set permissions.
4. Staff module role field: changes from plain text to dropdown + "Other" option.
5. All existing module pages: switch from hardcoded role checks to `usePermission()`.

---

## F1 — AuthContext + usePermission hook

```
In src/context/AuthContext.jsx, extend stored user data to include:
  permissions: {
    patients:     "both" | "read" | "write" | "none",
    appointments: "both" | "read" | "write" | "none",
    doctors:      "both" | "read" | "write" | "none",
    staff:        "both" | "read" | "write" | "none",
    reports:      "both" | "read" | "write" | "none",
  }
Store in localStorage key "user" alongside existing fields.

Create src/lib/usePermission.js:

import { useAuth } from '../context/AuthContext'

export function usePermission() {
  const { user } = useAuth()

  const can = (module, action) => {
    // action: "read" | "write"
    if (!user) return false
    const access = user.permissions?.[module] ?? "none"
    if (action === "read")  return access === "read"  || access === "both"
    if (action === "write") return access === "write" || access === "both"
    return false
  }

  const canRead  = (module) => can(module, "read")
  const canWrite = (module) => can(module, "write")

  return { can, canRead, canWrite }
}

Replace ALL existing role checks in every component with this hook:
  BEFORE: user.role === 'admin'
  AFTER:  canWrite('patients')   or   canRead('staff')   etc.

The hook reads from the permissions dict returned at login — never
computes permissions from the role string directly in components.
```

---

## F2 — API service additions

```
Add to src/services/api.js:

// Access Control
export const getRoles           = ()         => api.get('/access-control/roles/')
export const getRoleById        = (id)       => api.get(`/access-control/roles/${id}/`)
export const createRole         = (data)     => api.post('/access-control/roles/', data)
export const updateRole         = (id, data) => api.put(`/access-control/roles/${id}/`, data)
export const deleteRole         = (id)       => api.delete(`/access-control/roles/${id}/`)
export const setRolePermissions = (id, data) =>
  api.post(`/access-control/roles/${id}/set-permissions/`, data)
export const getRoleNames       = ()         =>
  api.get('/access-control/role-names/')
```

---

## F3 — Access Control page: /access-control

```
Route: /access-control
Guard: admin only — if !canWrite('staff') redirect to /
(staff permission is used as proxy for "admin-level control" since
canWrite('staff') === true only for admin in system roles)
Better guard: check user.role_obj.slug === 'admin' directly from stored user.

Sidebar: add "Access Control" link with lucide ShieldCheck icon.
Show only if user is admin (same guard as above).
Feature key: no feature gating — this is an admin-system page, always on.

─────────────────────────────────────────
Page layout
─────────────────────────────────────────
Topbar title: "Access Control"
Subtitle: "Manage roles and module permissions"
Top-right: "+ New Role" button (brand solid, lucide Plus icon) — always visible
           since this page is admin-only already.

Two-panel layout (on ≥ 1024px):
  Left panel  (360px fixed): Role list
  Right panel (flex-1):      Permission editor for selected role

On < 1024px: single column — role list on top, permission editor below
(only shown when a role is selected).

─────────────────────────────────────────
Left panel — Role list
─────────────────────────────────────────
bg-canvas rounded-card shadow-card overflow-hidden h-fit

Section header: "Roles" Outfit 600 text-[13px] text-slate uppercase
tracking-wide px-4 py-3 border-b border-hairline

Role rows — one per role from GET /api/access-control/roles/:
  Each row: px-4 py-3 flex items-center gap-3 border-b border-hairline
  last:border-0 cursor-pointer hover:bg-mist transition-colors

  Left: colored avatar circle (avatarColor from role name) with role
    initial(s) — same pattern as user avatars
  Center flex col:
    Role name: Outfit 500 text-[14px] text-ink
    User count: Outfit 400 text-[12px] text-slate  e.g. "3 users"
    System badge: if is_system → small chip "System" bg-slate-100
      text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-mono
  Right: if !is_system → kebab menu (⋮) with "Edit name" and "Delete"

Selected row: bg-brand/5 border-l-2 border-brand

Loading: 4 skeleton rows (shimmer).

Empty state (no custom roles, only system ones):
  Show system roles normally. Below them, a faint dashed-border card:
  "No custom roles yet" Outfit 400 text-[13px] text-slate text-center py-4
  "+ Create your first custom role" link in text-brand

─────────────────────────────────────────
Right panel — Permission editor
─────────────────────────────────────────
Default state (no role selected):
  Centered empty state: lucide ShieldCheck size-40 text-brand/20
  "Select a role to manage its permissions" text-slate text-[14px]

When a role is selected:
bg-canvas rounded-card shadow-card p-6

Header row:
  Role name: Outfit 700 text-[20px] text-ink
  System badge if is_system (same chip as role list)
  Edit name button (lucide Pencil, ghost) — hidden for system roles
  (name and slug are locked on system roles — description only via edit)
  "X users assigned" Outfit 400 text-[13px] text-slate

If is_system:
  Show a subtle info banner (blue, not amber — this is informational not a warning):
  bg-blue-50 border border-blue-200 rounded-control px-4 py-3 mb-4
  lucide Info text-blue-500 mr-2 inline
  "This is a system role. You can change its module permissions freely.
   Its name cannot be renamed."
  Outfit 400 text-[13px] text-blue-800
  — permissions are FULLY editable, same as custom roles.
  No disabled state on permission toggles for system roles.

Permissions grid:
  For each module (patients, appointments, doctors, staff, reports):
  One row per module. Rows separated by border-b border-hairline.

  Row layout: py-4 flex items-center gap-4
    Left (w-[140px]):
      Module icon (lucide): patients→Users, appointments→CalendarClock,
        doctors→Stethoscope, staff→Briefcase, reports→BarChart2
      Module name: Outfit 500 text-[14px] text-ink  capitalize
    Right: 4 toggle buttons in a row (pill group):
      [No Access] [Read] [Write] [Read & Write]
      Active state: bg-brand text-white
      Inactive: bg-mist text-slate border border-hairline hover:bg-hairline
      Each: Outfit 500 text-[12px] px-3 py-1.5 rounded-control
      ALL roles (system and custom): toggles are fully interactive — no disabled state.

  onChange: update local state immediately (optimistic UI — don't wait for API).
  A "Save Changes" button appears in sticky footer of the right panel when
  any permission has changed (dirty state). Clicking it calls
  POST /api/access-control/roles/:id/set-permissions/ with the full
  permissions array. On success: toast "Permissions saved". On error:
  revert to last saved state + rose error banner.

  "Save Changes" button: brand solid, full-width, sticky bottom-0 bg-canvas
  border-t border-hairline px-6 py-4. Only visible when dirty=true.
  "Discard" ghost link next to it — resets to last saved state.

─────────────────────────────────────────
Create / Edit role modal
─────────────────────────────────────────
Triggered by "+ New Role" or row kebab "Edit name".
Centered modal, max-w-md:
  Title: "Create Role" or "Edit Role"
  Fields:
    Name: text input, required, min 2 chars
    Description: textarea 2 rows, optional, placeholder "What can this role do?"
  On create success: new role added to list, auto-selected, permission editor
    opens for it (all modules start at "none" for new roles).
  On edit success: name updates in list and header.

─────────────────────────────────────────
Delete role modal
─────────────────────────────────────────
Confirmation modal (same pattern as staff/patient delete):
  "Delete Role?"
  "This will permanently delete the [name] role. Users currently assigned
  to this role must be reassigned before deletion."
  On 400 from backend ("users assigned"): show the backend error inline in
  the modal — do not close it, show "X active users are assigned to this role.
  Reassign them before deleting."
  On success: role removed from list, right panel resets to empty state.

─────────────────────────────────────────
QA for F3
─────────────────────────────────────────
[ ] System roles visible in list with "System" chip, no kebab menu (name locked)
[ ] Custom roles show kebab with Edit + Delete
[ ] Selecting a role highlights it and loads permission editor
[ ] System role: blue info banner shown, permission toggles FULLY INTERACTIVE
[ ] System role: change a permission toggle → Save button appears (same as custom)
[ ] System role: Save → permissions updated, toast shown, reload confirms persisted
[ ] Custom role: toggles interactive, Save button appears on change
[ ] Save → permissions persisted (reload page, verify same state)
[ ] Discard → reverts to last saved state without API call
[ ] Create role → appears in list, permission editor auto-opens
[ ] Delete with users assigned → 400 error shown in modal, not closed
[ ] Delete with no users → role gone from list
[ ] Page inaccessible for receptionist/doctor → redirected to /
```

---

## F4 — Staff module: role field as dropdown + free text

```
In src/pages/staff/AddStaff.jsx and EditStaff.jsx:

Replace the plain <input type="text"> role field with:

1. On mount, fetch GET /api/access-control/role-names/ and store in state.

2. Render a <select> showing all fetched role names + an "Other..." option
   at the bottom of the list. Outfit 500 text-[13px] styled same as other
   selects in the system.

3. When user selects "Other...": show a plain text input below the select
   (same style as the original role field was) with placeholder
   "Type custom role title..."

4. When user selects any named option: text input is hidden, the selected
   role name is used as the value.

5. On submit: send the role name string to the backend (unchanged from
   current behavior — it's still a free-text CharField on StaffMember,
   the dropdown just pre-fills it from DB role names as suggestions).
   The backend (B11) silently auto-creates a Role row if the typed
   string doesn't exist yet for this org — no extra frontend call needed.

5a. After save, check the response for a `role_created: true` flag
    (added by B11). If present, show a toast instead of the normal
    plain "Staff member added" toast:
      "Staff member added. New role '<RoleName>' saved to Access
       Control. Go to Access Control to set permissions for this role."
    Make "Access Control" a clickable link/segment in the toast that
    routes to /access-control.
    If `role_created` is false/absent (role already existed), show the
    normal toast: "Staff member added." (or "Staff member updated."
    on edit).
    Same behavior applies on EditStaff.jsx when role_created is true.

6. Helper text below the field stays: "You can select an existing role or
   type a custom one." (replaces "Type any role title as needed...")

Loading state for the dropdown: show a disabled <select> with "Loading
roles..." as the single option while the fetch is in progress.
Error state: if fetch fails, fall back to the original plain text input
with a small text-slate note "Could not load role suggestions."

QA:
[ ] Dropdown shows all system roles + org custom roles from DB
[ ] Selecting "Other..." reveals the text input
[ ] Selecting a named role hides the text input
[ ] If role-names fetch fails → plain text input shown, no crash
[ ] On edit, if existing staff role matches a DB role name → that option
    is pre-selected. If not → "Other..." selected + text input pre-filled.
[ ] On submit, role value sent to backend is the name string (not an ID)
[ ] Submitting a brand-new typed role (e.g. "Lab Technician") → toast
    reads "Staff member added. New role 'Lab Technician' saved to
    Access Control. Go to Access Control to set permissions for this
    role." with a working link to /access-control
[ ] Submitting an existing/selected role → normal toast only, no
    "new role" messaging
[ ] Same toast behavior verified on EditStaff.jsx, not just AddStaff.jsx
[ ] New role created this way shows up immediately in Access Control's
    role list with all modules at "No Access"
```

---

## API Contract Summary
## (Reference for both backend developer and frontend engineer)

```
─── Role management (admin only) ───

GET    /api/access-control/roles/
  Returns: [{ id, name, slug, description, is_system, user_count,
              module_permissions: [{module, access, can_read, can_write}],
              created_at }]

POST   /api/access-control/roles/
  Body: { name: string, description?: string }
  Returns: RoleObject (201)

PUT    /api/access-control/roles/:id/
  Body: { name, description }
  Returns: RoleObject (200)
  System roles: name silently ignored (slug locked), description updated only.
  Custom roles: name + description both updated.

DELETE /api/access-control/roles/:id/
  Returns: 204
  Error if is_system: 400 { detail: "System roles cannot be deleted." }
  Error if users assigned: 400 { detail: "Cannot delete..." }

POST   /api/access-control/roles/:id/set-permissions/
  Body: { permissions: [{ module: string, access: string }] }
  Modules:  patients | appointments | doctors | staff | reports
  Access:   none | read | write | both
  Unmentioned modules set to "none".
  Returns: full RoleObject with updated module_permissions (200)
  Works for ALL roles — system and custom alike.
  System roles: permissions are DB-driven and fully editable by admin.

GET    /api/access-control/role-names/
  Returns: [{ id, name, slug, is_system }]
  — lightweight, for dropdowns only

POST   /api/access-control/roles/from-staff/
  Body: { role_name: string }
  Behavior: get_or_create a Role for the requesting admin's org from
  role_name. Returns RoleObject (200 if already existed, 201 if newly
  created). Safety-net/manual-trigger endpoint — the normal Staff
  add/edit flow does NOT call this; StaffMemberViewSet.perform_create()/
  perform_update() run the same get_or_create logic in-process and
  return a `role_created: bool` flag on the staff save response instead.

─── Login response additions ───
POST /api/auth/login/ — response now includes:
  role: { id, name, slug, is_system }
  permissions: { patients: "both"|"read"|"write"|"none", ... }

─── Permission enforcement ───
All existing endpoints unchanged in URL and response shape.
Only the access rules change: custom roles use DB permissions,
system roles use the hardcoded fallback in HasModuleAccess._check_system_role().
A 403 from any endpoint means either role or permission denied:
  { detail: "You do not have permission to perform this action." }
```
