# MediFlow — Staff Module: Backend Implementation Plan
## Sequential prompts for your coding agent · Django + DRF · Feed one at a time

Existing codebase assumed: all previous modules (appointments, patients, doctors,
organizations, users, branding) already built and working. Do not touch any
existing model, serializer, view, or URL. Only add new code.

---

## Execution Order

| # | Prompt | What it builds |
|---|--------|----------------|
| B1 | StaffMember model | New staff app + model |
| B2 | Serializers | List, detail, write serializers |
| B3 | Permission classes | Staff-specific RBAC |
| B4 | Views + URLs | Full CRUD ViewSet, registered routes |
| B5 | Feature catalog | Add "staff" feature key to seed |
| B6 | Seed data | Demo staff members |
| B-QA | Tests + checklist | Full QA |

---

## B1 — StaffMember model

```
Run: python manage.py startapp staff
Add "staff" to INSTALLED_APPS in settings.py.

In staff/models.py create:

class StaffMember(models.Model):
  organization  FK → organizations.Organization, CASCADE,
                related_name="staff_members"
  full_name     CharField, max_length=150
  age           PositiveIntegerField
  phone         CharField, max_length=20
  address       TextField, blank=True, default=""
  role          CharField, max_length=100
                — free text, NOT choices. Any string is valid:
                  "Nurse", "Ward Boy", "Sweeper", "Security Guard", etc.
                — not unique. Same role can apply to many staff members.
  status        CharField, max_length=10,
                choices=[("active","Active"),("inactive","Inactive")],
                default="active"
  joining_date  DateField
  notes         TextField, blank=True, null=True
                — admin-only internal notes. Null when not set.
  created_at    DateTimeField, auto_now_add=True

  class Meta:
    ordering = ["-created_at"]

Add model-level clean() with four validations:
1. age must be between 1 and 100 inclusive.
   Raise ValidationError({"age": "Age must be between 1 and 100."})

2. joining_date must not be in the future.
   from django.utils import timezone
   if self.joining_date > timezone.localdate():
     Raise ValidationError({"joining_date": "Joining date cannot be in the future."})

3. phone uniqueness within the organization:
   StaffMember.objects.filter(organization=self.organization, phone=self.phone)
   .exclude(pk=self.pk if self.pk else None)
   If any exists → raise ValidationError(
     {"phone": "This phone is already registered to another staff member."})
   Note: uniqueness is per-org only, not global across all orgs.

4. role must not be blank after stripping whitespace.
   if not self.role or not self.role.strip():
     raise ValidationError({"role": "Role is required."})

Override save() to strip role whitespace before saving:
  self.role = self.role.strip()
  super().save(*args, **kwargs)

Register in staff/admin.py:
  @admin.register(StaffMember)
  class StaffMemberAdmin(ModelAdmin):
    list_display  = ["full_name", "role", "organization", "status",
                     "phone", "joining_date", "created_at"]
    list_filter   = ["organization", "status"]
    search_fields = ["full_name", "phone", "role"]

Run makemigrations staff and migrate.
```

---

## B2 — Serializers

```
Create staff/serializers.py with three serializers.

─────────────────────────────────────────
StaffListSerializer  (GET /api/staff/ list)
─────────────────────────────────────────
ModelSerializer on StaffMember.
fields: id, full_name, age, phone, address, role, status,
        joining_date, created_at, notes
All read-only. notes serializes as null when blank/null — not empty string.

─────────────────────────────────────────
StaffDetailSerializer  (GET /api/staff/:id/)
─────────────────────────────────────────
Subclass of StaffListSerializer. No extra fields for this MVP.
Kept separate so future detail-only fields can be added without touching list.

─────────────────────────────────────────
StaffWriteSerializer  (POST, PUT, PATCH)
─────────────────────────────────────────
ModelSerializer on StaffMember.
Writable fields: full_name, age, phone, address, role, status, joining_date, notes

Field-level validators:

validate_age(value):
  if value < 1 or value > 100:
    raise serializers.ValidationError("Age must be between 1 and 100.")
  return value

validate_joining_date(value):
  from django.utils import timezone
  if value > timezone.localdate():
    raise serializers.ValidationError("Joining date cannot be in the future.")
  return value

validate_role(value):
  if not value or not value.strip():
    raise serializers.ValidationError("Role is required.")
  return value.strip()

validate_phone(value):
  import re
  if not re.match(r'^\+[1-9]\d{7,14}$', value):
    raise serializers.ValidationError(
      "Phone must be in E.164 format (e.g. +923001234567).")
  return value

validate(self, data):  (cross-field — phone uniqueness check)
  phone = data.get("phone")
  organization = self.context["request"].user.organization
  qs = StaffMember.objects.filter(organization=organization, phone=phone)
  if self.instance:
    qs = qs.exclude(pk=self.instance.pk)
  if qs.exists():
    raise serializers.ValidationError(
      {"phone": "This phone is already registered to another staff member."})
  return data

override create():
  Set organization = self.context["request"].user.organization.
  Never trust a client-sent organization value.
  return StaffMember.objects.create(**validated_data)

override update():
  Pop organization from validated_data if present — do not allow changing org.
  Apply remaining fields to instance, call instance.save(), return instance.
```

---

## B3 — Permission classes

```
In the existing permissions file where IsStaffMember and IsAdminRole live
(appointments/permissions.py or organizations/permissions.py), add ONE new class:

class CanViewStaffModule(BasePermission):
  """
  Grants access to admin and receptionist roles.
  Blocks doctor role entirely — doctors have no visibility into the staff module.
  """
  message = "You do not have access to the staff module."

  def has_permission(self, request, view):
    return (
      request.user and
      request.user.is_authenticated and
      request.user.role in ["admin", "receptionist"]
    )

Do not create any other new permission class.
Reuse the existing IsAdminRole for write operations (create/update/delete).
Reuse the existing HasFeature class for feature gating.

Permission composition per action (applied in the ViewSet get_permissions):
  list, retrieve   → [IsAuthenticated, CanViewStaffModule, HasFeature("staff")]
  create           → [IsAuthenticated, IsAdminRole,        HasFeature("staff")]
  update           → [IsAuthenticated, IsAdminRole,        HasFeature("staff")]
  partial_update   → [IsAuthenticated, IsAdminRole,        HasFeature("staff")]
  destroy          → [IsAuthenticated, IsAdminRole,        HasFeature("staff")]
```

---

## B4 — Views and URLs

```
Create staff/views.py:

from rest_framework.viewsets import ModelViewSet
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from .models import StaffMember
from .serializers import StaffListSerializer, StaffDetailSerializer, StaffWriteSerializer
from appointments.permissions import IsAdminRole, CanViewStaffModule
from organizations.permissions import HasFeature

class StaffMemberViewSet(ModelViewSet):

  filter_backends = [SearchFilter]
  search_fields   = ["full_name", "phone", "role"]

  def get_queryset(self):
    qs = StaffMember.objects.filter(
      organization=self.request.user.organization
    )
    # ?status=active|inactive
    status_param = self.request.query_params.get("status")
    if status_param in ["active", "inactive"]:
      qs = qs.filter(status=status_param)
    # ?phone=<exact> — for frontend edit-form uniqueness pre-check
    phone_param = self.request.query_params.get("phone")
    if phone_param:
      qs = qs.filter(phone=phone_param)
    return qs

  def get_serializer_class(self):
    if self.action in ["create", "update", "partial_update"]:
      return StaffWriteSerializer
    if self.action == "retrieve":
      return StaffDetailSerializer
    return StaffListSerializer

  def get_permissions(self):
    if self.action in ["create", "update", "partial_update", "destroy"]:
      return [IsAuthenticated(), IsAdminRole(), HasFeature("staff")()]
    return [IsAuthenticated(), CanViewStaffModule(), HasFeature("staff")()]

  def destroy(self, request, *args, **kwargs):
    """
    HARD DELETE — not soft delete.
    StaffMember has no FK references from other models so hard delete is safe.
    """
    instance = self.get_object()
    instance.delete()
    return Response(status=204)

─────────────────────────────────────────
Create staff/urls.py:
─────────────────────────────────────────
from rest_framework.routers import DefaultRouter
from .views import StaffMemberViewSet

router = DefaultRouter()
router.register(r"staff", StaffMemberViewSet, basename="staff")
urlpatterns = router.urls

Routes generated:
  GET    /api/staff/        list
  POST   /api/staff/        create
  GET    /api/staff/:id/    retrieve
  PUT    /api/staff/:id/    update
  PATCH  /api/staff/:id/    partial_update
  DELETE /api/staff/:id/    destroy

─────────────────────────────────────────
In mediflow/urls.py add:
─────────────────────────────────────────
  path("api/", include("staff.urls")),
alongside existing includes. Do not remove or change any existing url entry.
```

---

## B5 — Feature catalog

```
In the existing seed_demo management command, add to the feature catalog section
(idempotent get_or_create — do not duplicate existing feature rows):

Feature.objects.get_or_create(
  key="staff",
  defaults={
    "label": "Staff Module",
    "description": "Manage non-clinical clinic staff"
  }
)

OrganizationFeature:
- Downtown Clinic  → "staff" enabled  (is_enabled=True)
- Riverside Medical → "staff" disabled (is_enabled=False)

Use get_or_create for each OrganizationFeature row. If the row already exists,
update is_enabled using .update() or set + save — do not create a duplicate.
```

---

## B6 — Seed data

```
In the same seed_demo command, add after the feature section.
All creates are idempotent: check exists by phone+organization before creating.

For Downtown Clinic create 5 StaffMember records:

1. full_name="Rashid Ali",     age=34, phone="+923011111001",
   role="Ward Boy",            status="active",
   joining_date=date(2020, 6, 1),   address="House 5, Block A, Lahore",
   notes=None

2. full_name="Nazia Bibi",     age=28, phone="+923011111002",
   role="Nurse",               status="active",
   joining_date=date(2022, 3, 15),  address="Flat 3, DHA Phase 4, Lahore",
   notes="Night shift preference"

3. full_name="Tariq Mehmood",  age=45, phone="+923011111003",
   role="Security Guard",      status="active",
   joining_date=date(2018, 1, 10),  address="",
   notes=None

4. full_name="Shabana Kausar", age=31, phone="+923011111004",
   role="Sweeper",             status="inactive",
   joining_date=date(2021, 8, 20),  address="",
   notes="On extended leave"

5. full_name="Imran Hassan",   age=26, phone="+923011111005",
   role="Nurse",               status="active",
   joining_date=date(2023, 11, 5),  address="Johar Town, Lahore",
   notes=None

Print at end:
  "Staff seeded: 5 members for Downtown Clinic"
  "Staff feature: ENABLED Downtown Clinic | DISABLED Riverside Medical"
```

---

## B-QA — Tests and manual checklist

### Test prompt
```
Write Django TestCase classes in staff/tests.py covering these 18 cases.
Use APIClient + force_authenticate throughout.

1.  GET /api/staff/ as admin (Downtown Clinic) → 200, results contain 5 seeded members.

2.  GET /api/staff/ as receptionist (Downtown Clinic) → 200 (receptionist can view).

3.  GET /api/staff/ as doctor (Downtown Clinic) → 403,
    detail contains "do not have access to the staff module".

4.  GET /api/staff/ as admin (Riverside Medical) → 403,
    detail indicates feature not enabled for their plan.

5.  GET /api/staff/ as Downtown Clinic admin only returns Downtown Clinic staff —
    create a Riverside Medical staff member in the test, confirm it does NOT
    appear in Downtown Clinic admin's results.

6.  GET /api/staff/:id/ where the ID belongs to Riverside Medical, requested by
    Downtown Clinic admin → 404 (not 403 — org-scoped queryset makes it "not found").

7.  POST /api/staff/ as receptionist → 403.

8.  POST /api/staff/ as admin with valid payload → 201, response body includes
    all StaffObject fields (id, full_name, age, phone, address, role, status,
    joining_date, created_at, notes).

9.  POST /api/staff/ with age=0 → 400, error on "age" key.

10. POST /api/staff/ with age=101 → 400, error on "age" key.

11. POST /api/staff/ with joining_date = tomorrow → 400, error on "joining_date" key.

12. POST /api/staff/ with role="" → 400, error on "role" key.

13. POST /api/staff/ with role="   " (whitespace only) → 400, error on "role" key.

14. POST /api/staff/ with role="  Nurse  " (padded) → 201,
    confirm stored role = "Nurse" (stripped) by fetching the created record.

15. POST /api/staff/ with phone="+923011111002" when Nazia Bibi already has that
    phone in the same org → 400, error on "phone" key.
    Same phone but different org → 201 (uniqueness is per-org).

16. POST /api/staff/ with phone="03001234567" (no + prefix) → 400, phone error.

17. DELETE /api/staff/:id/ as admin → 204.
    Confirm hard delete: StaffMember.objects.filter(pk=deleted_id).exists() → False.

18. GET /api/staff/?status=inactive → returns only inactive staff (Shabana Kausar).
    GET /api/staff/?search=nurse → returns both Nazia Bibi and Imran Hassan.
    GET /api/staff/?phone=+923011111001 → returns exactly 1 result (Rashid Ali).

Run: python manage.py test staff
```

### Manual checklist
```
[ ] python manage.py test staff → all 18 tests pass
[ ] python manage.py seed_demo → completes without error, prints staff summary
[ ] All previous module tests still pass (no regressions):
    python manage.py test appointments organizations users

[ ] GET /api/staff/ with no token → 401
[ ] GET /api/staff/ (Downtown Clinic admin) → 200, 5 members in results
[ ] GET /api/staff/ (Downtown Clinic receptionist) → 200
[ ] GET /api/staff/ (Downtown Clinic doctor) → 403
[ ] GET /api/staff/ (Riverside Medical admin) → 403 "not included in your plan"

[ ] POST /api/staff/ (admin) with role="  Ward Boy  " → stored as "Ward Boy"
    — verify in Django Admin

[ ] POST /api/staff/ joining_date = today → 201 (today is valid, not future)
[ ] POST /api/staff/ joining_date = tomorrow → 400

[ ] DELETE /api/staff/:id/ → 204
    Django shell: StaffMember.objects.filter(pk=<deleted_id>).exists() → False
    (confirms hard delete, not soft)

[ ] GET /api/staff/?search=nurse → case-insensitive, returns 2 results
[ ] GET /api/staff/?status=inactive → 1 result (Shabana Kausar)
[ ] GET /api/staff/?search=nurse&status=active → 2 results (both filters compose)
[ ] GET /api/staff/?phone=+923011111003 → exactly 1 result (Tariq Mehmood)

[ ] Django Admin → Staff Members section visible
    → can create / edit / delete a staff member from admin UI
    → list_filter by organization and status works
```

---

## API Contract
## (Hand to frontend engineer — matches the Staff frontend spec exactly)

```
All endpoints require: Authorization: Bearer <access_token>
All endpoints require: org must have "staff" feature enabled (else 403).
All list responses: { count, next, previous, results }
All errors: { detail: "..." } or { field_name: ["..."] }

GET  /api/staff/
  Query: ?search=<str>           icontains on full_name, phone, role
         ?status=active|inactive exact match
         ?phone=<E.164>          exact match (for edit-form uniqueness pre-check)
  RBAC: admin + receptionist · doctor → 403
  Returns: paginated StaffObject list

GET  /api/staff/:id/
  RBAC: admin + receptionist
  Returns: single StaffObject

POST /api/staff/
  RBAC: admin only
  Body:
    full_name     string   required
    age           integer  required, 1–100
    phone         string   required, E.164, unique within org
    address       string   optional
    role          string   required, non-empty, max 100 chars, stored stripped
    joining_date  string   required, YYYY-MM-DD, not in future
    status        string   required, "active" | "inactive"
    notes         string   optional, null if omitted
  Returns: StaffObject (201)

PUT   /api/staff/:id/   — admin only, all fields required, returns StaffObject (200)
PATCH /api/staff/:id/   — admin only, partial fields, returns StaffObject (200)
DELETE /api/staff/:id/  — admin only, hard delete, returns 204

StaffObject:
{
  id:           number
  full_name:    string
  age:          number
  phone:        string       E.164
  address:      string       empty string if not set
  role:         string       always whitespace-stripped
  status:       "active" | "inactive"
  joining_date: "YYYY-MM-DD"
  created_at:   ISO datetime
  notes:        string | null
}
```
