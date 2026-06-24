MediFlow — Doctors Module: Backend Implementation Plan

Sequential prompts for your coding agent · Django + DRF · Feed one at a time

Existing codebase assumed: organizations, users, appointments apps already
built per the MediFlow MVP plan. User model has role, organization FK.
Appointment model exists with doctor, patient, appointment_dt, status,
reason fields. JWT login with custom TokenObtainPairSerializer already wired.


Execution Order

#PromptWhat it buildsB1Doctor Profile fieldsExtend User model with doctor-specific fieldsB2Attendance modelDoctorAttendance model for daily check-in/outB3SerializersDoctorSerializer, DoctorStatsSerializer, DoctorAppointmentSerializerB4RBAC permission classesDoctor-specific permission guardsB5Core CRUD viewsList, detail, create, update, deleteB6Stats endpointAggregated stats computationB7Appointments endpointDoctor's appointment historyB8Attendance endpointsCheck-in / check-out recordingB9URLs + wiringRegister all routesB10Seed dataDemo doctors with attendance + case historyB-QATests + checklistFull QA coverage


B1 — Extend User model with doctor-specific fields

In users/models.py, add the following fields to the existing User model.
These fields are only meaningful when user.role == "doctor" but live on User
to avoid a separate DoctorProfile join on every query.

Add fields:
- phone (CharField, max_length=20, blank=True)
- qualification (CharField, max_length=200, blank=True)
  e.g. "MBBS, FCPS"
- specializations (JSONField, default=list, blank=True)
  stores a list of strings: ["Cardiologist", "General Physician"]
  Do NOT use a separate table — JSONField is sufficient for this MVP.
- experience_years (PositiveIntegerField, default=0)
- shift_start (TimeField, null=True, blank=True)
  24-hour format, e.g. time(9, 0) for 09:00
- shift_end (TimeField, null=True, blank=True)
- join_date (DateField, null=True, blank=True)
- status (CharField, max_length=20,
  choices: [("active","Active"),("inactive","Inactive"),("on_leave","On Leave")],
  default="active")

Add a model-level clean() that validates:
- If role == "doctor": shift_end must be after shift_start when both are set.
  Raise ValidationError("Shift end must be after shift start.") if violated.
- experience_years must not exceed 60. Raise ValidationError if > 60.
- phone uniqueness among doctors in the same organization: query
  User.objects.filter(organization=self.organization, phone=self.phone, role="doctor")
  .exclude(pk=self.pk) — if any exists, raise ValidationError("Phone already in use
  by another doctor in this organization.").
- email uniqueness among doctors in the same organization: same pattern for email.

Run makemigrations and migrate.
Do NOT touch any other existing field on User.


B2 — DoctorAttendance model

Create a new file: users/models.py (add below User) or a dedicated
attendance/models.py inside the users app — use users/models.py to keep
things simple.

Model: DoctorAttendance
Fields:
- doctor (FK → User, CASCADE, related_name="attendance_records",
  limit_choices_to={"role": "doctor"})
- organization (FK → organizations.Organization, CASCADE,
  related_name="attendance_records")
- date (DateField)
- checkin_time (TimeField, null=True, blank=True)
  store as TIME only (not datetime) — the date field carries the date
- checkout_time (TimeField, null=True, blank=True)
- notes (CharField, max_length=200, blank=True)

Meta:
- unique_together = ("doctor", "date")
  One record per doctor per day. Upserting is the correct behavior —
  do not allow two rows for the same doctor on the same date.
- ordering = ["-date"]

Add a property on_time:
  Returns True if checkin_time is set AND
  checkin_time <= (shift_start + timedelta(minutes=15)) where shift_start
  comes from self.doctor.shift_start. Returns None if checkin_time is None.
  (None means absent, not late.)

Add a property cases_on_date:
  Returns count of Appointment.objects.filter(
    doctor=self.doctor,
    appointment_dt__date=self.date,
    status__in=["completed", "in_progress"]
  )
  This is computed on access — not stored. The stats endpoint will batch
  these instead of calling the property in a loop.

Register DoctorAttendance in users/admin.py:
  list_display: doctor, organization, date, checkin_time, checkout_time, on_time
  list_filter: organization, date
  search_fields: doctor__first_name, doctor__last_name

Run makemigrations and migrate.


B3 — Serializers

Create users/serializers.py (if it doesn't exist) with the following
serializers. Import User, DoctorAttendance from users.models, and
Appointment from appointments.models.

─────────────────────────────────────────
3A. DoctorListSerializer (for GET /api/doctors/ list)
─────────────────────────────────────────
ModelSerializer on User. Fields:
  id, first_name, last_name, email, phone, qualification,
  specializations, experience_years, status, join_date,
  shift_start, shift_end

Add these SerializerMethodFields (computed, read-only):
- full_name: f"{first_name} {last_name}"
- today_checkin: look up DoctorAttendance for this doctor where date=today,
  return checkin_time as ISO string "HH:MM:SS" or null
- today_checkout: same for checkout_time
- cases_today: Appointment.objects.filter(
    doctor=instance, appointment_dt__date=today,
    status__in=["completed","in_progress","scheduled"]
  ).count()
- cases_this_week: filter appointment_dt__date__gte=start_of_week (Monday),
  appointment_dt__date__lte=today, same status filter
- cases_this_month: filter appointment_dt__month=today.month,
  appointment_dt__year=today.year, same status filter
- total_cases: filter doctor=instance (all time, all statuses except cancelled)
- avg_cases_per_day: total_cases / max(days_since_join, 1) where days_since_join
  = (today - join_date).days if join_date else 1. Round to 1 decimal.

All date computations use django.utils.timezone.localdate() not datetime.date.today()
(respects USE_TZ=True).

─────────────────────────────────────────
3B. DoctorDetailSerializer (for GET /api/doctors/:id/)
─────────────────────────────────────────
Extends DoctorListSerializer with no extra fields —
same fields, same computed values. The distinction exists so that in future
the detail serializer can add fields (e.g. notes, internal records) without
touching the list serializer. For now they are functionally identical.

─────────────────────────────────────────
3C. DoctorWriteSerializer (for POST and PUT)
─────────────────────────────────────────
ModelSerializer on User. Writable fields:
  first_name, last_name, email, phone, qualification,
  specializations, experience_years, status, join_date,
  shift_start, shift_end

Validation:
- shift_end must be after shift_start: validate at serializer level (validate()
  method), raise serializers.ValidationError({"shift_end": "..."}).
- experience_years > 60: raise ValidationError({"experience_years":
  "Please verify — over 60 years is unusual."}) as a non-blocking warning.
  Actually for the API, raise it as a 400 — the frontend handles the UX
  distinction between warning and error; the backend always rejects invalid data.
- specializations: must be a list with at least 1 item. If empty list or not
  a list, raise ValidationError({"specializations": "At least one specialization
  is required."}).
- phone and email uniqueness within the organization: query User.objects.filter(
  organization=..., phone=value, role="doctor").exclude(pk=self.instance.pk if
  self.instance else None). Raise field-level ValidationError if any match found.

override create(): set role="doctor", set organization from
  self.context["request"].user.organization. Never trust client-sent role or org.
override update(): do NOT allow changing organization or role via this serializer.

─────────────────────────────────────────
3D. DoctorAttendanceSerializer (used inside DoctorStatsSerializer)
─────────────────────────────────────────
ModelSerializer on DoctorAttendance. Fields:
  date, checkin_time, checkout_time
  + SerializerMethodFields:
    cases: Appointment count for this doctor on this date (same filter as cases_today above)
    on_time: attendance_record.on_time property (True/False/None)
  Checkin and checkout times serialized as "HH:MM" strings (not full ISO),
  or null if not set.

─────────────────────────────────────────
3E. DoctorAppointmentSerializer (for GET /api/doctors/:id/appointments/)
─────────────────────────────────────────
ModelSerializer on Appointment. Fields:
  id, appointment_dt, reason, status, diagnosis (null if blank), payment_status
  + SerializerMethodFields:
    patient_name: appointment.patient.full_name
    patient_age: appointment.patient.age (already stored on Patient model)

─────────────────────────────────────────
3F. DoctorStatsSerializer (for GET /api/doctors/:id/stats/)
─────────────────────────────────────────
NOT a ModelSerializer — a plain Serializer that wraps computed data.
The view computes a dict and passes it here for validation + serialization.

Fields (all read-only):
  doctor_id (IntegerField)
  daily_cases (ListField of {date: str, count: int}) — last 30 days
  case_types (ListField of {type: str, count: int})
  monthly_summary (ListField of {month: str, count: int}) — last 12 months
  attendance (DoctorAttendanceSerializer, many=True) — last 30 days
  top_conditions (ListField of {condition: str, count: int}) — top 5

The view builds this dict; the serializer just validates shape and serializes it.


B4 — RBAC permission classes for Doctors module

In appointments/permissions.py (or a new users/permissions.py — put it wherever
the existing IsStaffMember and HasFeature classes live), add:

─────────────────────────────────────────
IsDoctorSelf
─────────────────────────────────────────
has_object_permission(request, view, obj):
  obj is a User instance (a doctor).
  Returns True if request.user.role == "doctor" AND request.user.pk == obj.pk.
  Used to allow doctors to view their own full profile/stats without being staff.

─────────────────────────────────────────
CanViewDoctorFullProfile
─────────────────────────────────────────
has_object_permission(request, view, obj):
  Returns True if ANY of:
  - request.user.role in ["admin", "receptionist"]
  - request.user.role == "doctor" AND request.user.pk == obj.pk
  Returns False for doctors viewing another doctor's profile.
  Used on the stats, attendance, and appointments sub-endpoints.

─────────────────────────────────────────
IsAdminRole
─────────────────────────────────────────
has_permission(request, view):
  Returns True if request.user.role == "admin".
  Used for create, update, delete operations.
  Returns a 403 with detail "Only administrators can perform this action."

Note: all of the above also require the caller to be authenticated (IsAuthenticated
is always the first class in permission_classes — these are composed WITH it, not
replacing it). Also compose with HasFeature("doctors") on every view so that
orgs that haven't bought the doctors module can't access any of these endpoints.


B5 — Core CRUD views

Create users/views.py with the following ViewSets and views.
All querysets filter by request.user.organization first — cross-org data must
never be accessible.

─────────────────────────────────────────
DoctorViewSet (ModelViewSet)
─────────────────────────────────────────
queryset: User.objects.filter(role="doctor")
          Always scoped: .filter(organization=request.user.organization)

get_serializer_class():
  POST, PUT, PATCH → DoctorWriteSerializer
  list            → DoctorListSerializer
  retrieve        → DoctorDetailSerializer

get_permissions():
  create, update, partial_update, destroy →
    [IsAuthenticated, IsAdminRole, HasFeature("doctors")]
  list, retrieve →
    [IsAuthenticated, HasFeature("doctors")]
    (all authenticated users in the org can list/view — RBAC for
    hidden sections is handled frontend-side; backend returns the
    full DoctorObject to admin/receptionist and the limited object
    to doctor role — see get_serializer_class note below)

RBAC in retrieve: when request.user.role == "doctor" AND
  request.user.pk != int(kwargs["pk"]) — use DoctorListSerializer
  (which has no sensitive internal fields) instead of DoctorDetailSerializer.
  This is already handled correctly if DoctorDetailSerializer == DoctorListSerializer
  for now, but structure the if/else so future divergence is easy.

destroy(): soft delete — set instance.is_active=False, instance.save().
  Do NOT actually delete the row (appointments reference this user FK).
  Return 204 No Content.
  After soft delete, the doctor no longer appears in the list queryset
  — add .filter(is_active=True) to the base queryset.

search and filter:
  Add SearchFilter: search_fields = ["first_name", "last_name", "specializations"]
  Note: searching JSONField (specializations) requires PostgreSQL's
  __icontains on the text representation — this is acceptable for MVP.
  Add DoctorStatusFilter (custom FilterBackend or django-filter):
    ?status=active|inactive|on_leave → filter by status field.
  Both filters compose: ?search=cardio&status=active works simultaneously.

list() response: standard paginated { count, next, previous, results }
  where each result is a DoctorListSerializer object including all
  computed fields (today_checkin, cases_today, etc.).
  
  IMPORTANT — N+1 prevention: the computed fields in DoctorListSerializer
  make per-doctor DB calls. For the list view, batch the attendance lookup
  and case counts using a single query each, then annotate or build a dict,
  and pass it via serializer context rather than hitting the DB per doctor.
  Implement this optimization in list() before fetching the serializer:
  
  1. Fetch today's attendance for all doctors in the queryset in ONE query:
     attendances = DoctorAttendance.objects.filter(
       doctor__in=queryset, date=today
     ).values("doctor_id", "checkin_time", "checkout_time")
     attendance_map = {a["doctor_id"]: a for a in attendances}
  
  2. Fetch today's case counts in ONE query using annotation or values/annotate:
     from django.db.models import Count, Q
     case_counts = Appointment.objects.filter(
       doctor__in=queryset,
       appointment_dt__date=today
     ).values("doctor_id").annotate(count=Count("id"))
     cases_map = {c["doctor_id"]: c["count"] for c in case_counts}
  
  Pass attendance_map and cases_map via serializer context:
  context = self.get_serializer_context()
  context["attendance_map"] = attendance_map
  context["cases_map"]      = cases_map
  serializer = DoctorListSerializer(queryset, many=True, context=context)
  
  Update DoctorListSerializer.get_today_checkin() etc. to read from
  context["attendance_map"].get(instance.id) if available, falling back
  to a direct DB query otherwise (so detail views still work without the map).


B6 — Stats endpoint

Add to DoctorViewSet as a custom @action, or as a standalone view — use @action
for consistency.

@action(detail=True, methods=["get"], url_path="stats")
def stats(self, request, pk=None):

Permission check (inside the action):
  doctor = self.get_object()  # already org-scoped by get_queryset
  if not CanViewDoctorFullProfile().has_object_permission(request, request.parser_context["view"], doctor):
    return Response({"detail": "You do not have permission to view this doctor's stats."}, status=403)

Compute the following (all queries scoped to doctor + organization):

─── daily_cases (last 30 days) ───
Generate a list of the last 30 calendar dates (today inclusive).
For each date, count completed+in_progress+scheduled appointments.
Use a single query with annotation grouped by date:
  from django.db.models.functions import TruncDate
  Appointment.objects.filter(
    doctor=doctor,
    appointment_dt__date__gte=thirty_days_ago
  ).annotate(day=TruncDate("appointment_dt")).values("day").annotate(
    count=Count("id")
  ).order_by("day")
Then merge with the full 30-date list so zero-count days are included
(dict lookup, fill missing dates with count=0). Return as:
  [{"date": "YYYY-MM-DD", "count": N}, ...]

─── case_types (by appointment reason) ───
Group appointments by reason field (or a reason_category if that field exists).
Since the MVP appointment model has a free-text `reason` field, group by the
exact reason string for now:
  Appointment.objects.filter(doctor=doctor).values("reason").annotate(
    count=Count("id")
  ).order_by("-count")[:20]
Return as: [{"type": reason_value, "count": N}, ...]
Limit to 20 rows — the frontend shows a pie chart, not an infinite list.

─── monthly_summary (last 12 months) ───
  from django.db.models.functions import TruncMonth
  Appointment.objects.filter(
    doctor=doctor,
    appointment_dt__gte=twelve_months_ago
  ).annotate(month=TruncMonth("appointment_dt")).values("month").annotate(
    count=Count("id")
  ).order_by("month")
Fill missing months with 0. Return as:
  [{"month": "YYYY-MM", "count": N}, ...]  (12 items, oldest first)

─── attendance (last 30 days) ───
  DoctorAttendance.objects.filter(
    doctor=doctor,
    date__gte=thirty_days_ago
  ).order_by("-date")
For each record, also include the case count for that date (batch it — one
Appointment query grouped by date for the 30-day range, then merge):
  appt_by_date = Appointment.objects.filter(
    doctor=doctor,
    appointment_dt__date__gte=thirty_days_ago
  ).annotate(day=TruncDate("appointment_dt")).values("day").annotate(
    count=Count("id")
  )
  appt_map = {r["day"]: r["count"] for r in appt_by_date}
Serialize using DoctorAttendanceSerializer, passing appt_map in context so
the serializer reads cases from the map, not per-row queries.

─── top_conditions (top 5 patient conditions this doctor handled) ───
  Appointment.objects.filter(doctor=doctor).select_related("patient").values(
    "patient__condition"
  ).annotate(count=Count("id")).order_by("-count")[:5]
Return as: [{"condition": patient__condition value, "count": N}, ...]
If patient__condition is blank/null, exclude it from this aggregation.

Assemble the full response dict and serialize with DoctorStatsSerializer.
Return 200.

Performance note: this endpoint runs several queries. For MVP this is
acceptable. Add a comment marking it as a candidate for caching (Django
cache framework, key = f"doctor_stats_{doctor.id}_{today}") when real
load requires it — do not implement caching now.


B7 — Doctor appointments endpoint

Add to DoctorViewSet as a custom @action:

@action(detail=True, methods=["get"], url_path="appointments")
def appointments(self, request, pk=None):

Permission check:
  doctor = self.get_object()
  if not CanViewDoctorFullProfile().has_object_permission(...):
    return 403

Fetch:
  Appointment.objects.filter(
    doctor=doctor,
    organization=request.user.organization
  ).select_related("patient").order_by("-appointment_dt")

Filter by query param ?status= if provided:
  status = request.query_params.get("status")
  if status:
    queryset = queryset.filter(status=status)

Paginate using the viewset's default pagination class (same PageNumberPagination
already configured globally — do not add a custom one here).

Serialize with DoctorAppointmentSerializer (many=True).

Add payment_status to the Appointment model IF it does not already exist:
  payment_status (CharField, max_length=10,
    choices=[("paid","Paid"),("unpaid","Unpaid")], default="unpaid")
  Run makemigrations and migrate if this field is new.
  If it already exists, skip this step.

Return paginated response: { count, next, previous, results }.


B8 — Attendance (check-in / check-out) endpoints

Add two more @actions to DoctorViewSet:

─────────────────────────────────────────
checkin action
─────────────────────────────────────────
@action(detail=True, methods=["post"], url_path="checkin")
permission_classes on this action: [IsAuthenticated, IsStaffMember, HasFeature("doctors")]
(Admin and receptionist record check-in — doctors do not self-check-in in this MVP.)

Body: { "checkin_time": "HH:MM" }  (24-hour, string)

Logic:
  doctor = self.get_object()
  today = timezone.localdate()
  attendance, created = DoctorAttendance.objects.get_or_create(
    doctor=doctor,
    date=today,
    defaults={"organization": request.user.organization}
  )
  if attendance.checkin_time is not None:
    return 400 {"detail": "Doctor has already checked in today."}
  attendance.checkin_time = parsed time from body
  attendance.save()
  return 200 { "date": today, "checkin_time": HH:MM, "on_time": attendance.on_time }

Validate checkin_time format: must match HH:MM pattern. Return 400 if malformed.
Validate: checkin_time must not be in the future (compare against timezone.now().time()).

─────────────────────────────────────────
checkout action
─────────────────────────────────────────
@action(detail=True, methods=["post"], url_path="checkout")
Same permissions as checkin.

Body: { "checkout_time": "HH:MM" }

Logic:
  attendance = get DoctorAttendance for doctor + today. 404 if not found
    ("Doctor has not checked in today — cannot check out.").
  if attendance.checkout_time is not None:
    return 400 {"detail": "Doctor has already checked out today."}
  if parsed checkout_time <= attendance.checkin_time:
    return 400 {"detail": "Checkout time must be after check-in time."}
  attendance.checkout_time = parsed checkout_time
  attendance.save()
  return 200 { "date": today, "checkin_time": HH:MM, "checkout_time": HH:MM }


B9 — URLs and wiring

Create users/urls.py:
  from rest_framework.routers import DefaultRouter
  from users.views import DoctorViewSet

  router = DefaultRouter()
  router.register(r"doctors", DoctorViewSet, basename="doctor")
  urlpatterns = router.urls

The DefaultRouter automatically generates:
  GET    /api/doctors/                        → list
  POST   /api/doctors/                        → create
  GET    /api/doctors/{id}/                   → retrieve
  PUT    /api/doctors/{id}/                   → update
  PATCH  /api/doctors/{id}/                   → partial_update
  DELETE /api/doctors/{id}/                   → destroy
  GET    /api/doctors/{id}/stats/             → stats action (B6)
  GET    /api/doctors/{id}/appointments/      → appointments action (B7)
  POST   /api/doctors/{id}/checkin/           → checkin action (B8)
  POST   /api/doctors/{id}/checkout/          → checkout action (B8)

In mediflow/urls.py, include users.urls under /api/:
  path("api/", include("users.urls")),
  (alongside the existing path("api/", include("appointments.urls")))

Also add "doctors" as a Feature in the seed data (B10) so HasFeature("doctors")
can be toggled per organization. The Feature key must be exactly "doctors".

Add "doctors" to the Feature catalog: Feature.objects.get_or_create(
  key="doctors", defaults={"label": "Doctors Module",
  "description": "Doctor profiles, attendance, and case analytics"}
)
And enable it for Downtown Clinic in OrganizationFeature.


B10 — Seed data

Extend the existing seed_demo management command
(appointments/management/commands/seed_demo.py) with a new section.
Make all additions idempotent (skip if already exists).

Add to the seed:
1. Feature catalog: get_or_create Feature(key="doctors", label="Doctors Module")
2. OrganizationFeature: enable "doctors" for Downtown Clinic.
   Disable it for Riverside Medical (so feature-gating is testable for this
   module too, same pattern as appointments).

3. For Downtown Clinic, update the 2 existing doctor users (created by the
   original seed) with realistic doctor-specific fields:
   Doctor 1:
     first_name="Ahmed", last_name="Khan"
     phone="+923001234567", qualification="MBBS, FCPS (Cardiology)"
     specializations=["Cardiologist", "Internal Medicine"]
     experience_years=12, shift_start=time(8,0), shift_end=time(16,0)
     join_date=date(2019, 3, 15), status="active"
   Doctor 2:
     first_name="Sana", last_name="Malik"
     phone="+923007654321", qualification="MBBS, MCPS"
     specializations=["General Physician", "Pediatrics"]
     experience_years=7, shift_start=time(14,0), shift_end=time(22,0)
     join_date=date(2021, 9, 1), status="active"

4. Create DoctorAttendance records for each doctor for the last 14 days
   (not weekends — skip Saturday/Sunday):
   - Alternate between on-time (checkin = shift_start) and slightly late
     (checkin = shift_start + timedelta(minutes=random.randint(5,30)))
   - checkout = shift_end for all days
   - 2 days out of 14: checkin=None (absent)
   Use get_or_create with date as the key — idempotent.

5. Create additional Appointment records tied to these doctors (in addition
   to what the original seed created) covering the last 30 days, with varied
   reasons and statuses, so the stats endpoint returns meaningful non-zero data:
   - ~20 appointments per doctor spread across last 30 days
   - reasons: cycle through ["Chest Pain", "Fever", "Routine Checkup",
     "Follow Up", "Hypertension Review", "Cough & Cold", "Diabetes Management"]
   - statuses: mix of completed (70%), cancelled (10%), scheduled (20%)
   - appointment_dt: spread across past 30 days at realistic clinic hours
   Use get_or_create or simply create — these are demo rows, not critical
   to be perfectly idempotent (wrap in a try/except if needed).

Print at end: "Doctors seeded: Ahmed Khan, Sana Malik — org: Downtown Clinic"


B-QA — Tests and manual checklist

Test prompt

Write Django TestCase classes in users/tests.py covering:

1. GET /api/doctors/ — staff user returns list of doctors in their org only,
   not doctors from other orgs.

2. GET /api/doctors/ — doctor role can list doctors (reads own org's list).

3. GET /api/doctors/:id/ — admin gets full DoctorDetailSerializer response
   including all computed fields (cases_today, today_checkin, etc.).

4. GET /api/doctors/:id/ — doctor requesting another doctor's profile gets
   the limited DoctorListSerializer response (same fields but verify
   sensitive data not exposed — for now same serializer, so just test 200).

5. POST /api/doctors/ — admin can create; receptionist gets 403; doctor gets 403.

6. POST /api/doctors/ — shift_end before shift_start returns 400.

7. POST /api/doctors/ — empty specializations list returns 400.

8. POST /api/doctors/ — duplicate phone in same org returns 400; duplicate
   phone in DIFFERENT org succeeds (phone unique per org, not globally).

9. DELETE /api/doctors/:id/ — soft delete: doctor disappears from list,
   User row still exists in DB with is_active=False, FK references intact.

10. GET /api/doctors/:id/stats/ — receptionist gets 200 with correct shape:
    keys daily_cases, case_types, monthly_summary, attendance, top_conditions
    all present. daily_cases has exactly 30 items (zero-fill confirmed).
    monthly_summary has exactly 12 items.

11. GET /api/doctors/:id/stats/ — doctor requesting ANOTHER doctor's stats
    gets 403.

12. GET /api/doctors/:id/appointments/ — returns only that doctor's appointments,
    not another doctor's. Pagination present ({ count, next, previous, results }).

13. GET /api/doctors/:id/appointments/?status=completed — filters correctly.

14. POST /api/doctors/:id/checkin/ — creates DoctorAttendance row with today's
    date, correct checkin_time. Second POST same day returns 400.

15. POST /api/doctors/:id/checkout/ — requires prior checkin. checkout before
    checkin time returns 400.

16. GET /api/doctors/:id/stats/ — user from a different org gets 404 (doctor
    not found via org-scoped get_queryset), not a 403.

17. HasFeature("doctors") — a user from an org with "doctors" feature disabled
    gets 403 on GET /api/doctors/ even if their role is admin.

Use APIClient + force_authenticate. Run: python manage.py test users

Manual QA checklist

Backend
[ ] python manage.py test users → all 17 tests pass
[ ] python manage.py seed_demo → runs without error, prints doctor names + org
[ ] GET /api/doctors/ (Downtown Clinic receptionist) → 200, list includes
    Ahmed Khan + Sana Malik with today_checkin, cases_today, avg_cases_per_day populated
[ ] GET /api/doctors/ (Riverside Medical receptionist) → 403 "feature not included
    in your plan" (because "doctors" is disabled for Riverside)
[ ] POST /api/doctors/ with shift_end before shift_start → 400, shift_end error key present
[ ] POST /api/doctors/ with specializations: [] → 400
[ ] DELETE /api/doctors/:id/ → 204, doctor gone from GET list, DB row still present
[ ] GET /api/doctors/:id/stats/ → 200, daily_cases array length exactly 30,
    monthly_summary array length exactly 12, zero-fill days present
[ ] POST /api/doctors/:id/checkin/ { "checkin_time": "09:05" } → 200,
    on_time: true (shift_start 09:00, within 15min grace)
[ ] POST /api/doctors/:id/checkin/ again same day → 400 "already checked in"
[ ] POST /api/doctors/:id/checkout/ { "checkout_time": "08:00" } (before checkin) → 400
[ ] GET /api/doctors/:id/appointments/ → paginated, patient_name + patient_age present
[ ] GET /api/doctors/:id/appointments/?status=completed → only completed rows
[ ] Django Admin → upload a logo for an org → unrelated to doctors, confirm
    existing branding still works (no regression from new migrations)
[ ] N+1 check: add django-debug-toolbar or log DB query count —
    GET /api/doctors/ with 10 doctors should not produce 10+ attendance queries
    (attendance_map batching from B5 must be working)


API Contract Summary

(Copy this to your frontend engineer — matches exactly what Prompt 1-3 expect)

All endpoints require: Authorization: Bearer <access_token>
All endpoints require: HasFeature("doctors") for caller's organization.
All responses use { count, next, previous, results } pagination for lists.
All error responses: { detail: "..." } or { field_name: ["..."] }

GET    /api/doctors/
  Query: ?search=<str>&status=active|inactive|on_leave
  Returns: paginated DoctorObject list (all computed fields included)

GET    /api/doctors/:id/
  Returns: DoctorObject (full)

POST   /api/doctors/
  Admin only. Body: { first_name, last_name, email, phone, qualification,
  specializations: [], experience_years, shift_start "HH:MM", shift_end "HH:MM",
  status, join_date "YYYY-MM-DD" }
  Returns: created DoctorObject (201)

PUT    /api/doctors/:id/
  Admin only. Body: same as POST (all fields required).
  Returns: updated DoctorObject (200)

PATCH  /api/doctors/:id/
  Admin only. Body: any subset of PUT fields.
  Returns: updated DoctorObject (200)

DELETE /api/doctors/:id/
  Admin only. Returns: 204 No Content. (Soft delete — user set inactive.)

GET    /api/doctors/:id/stats/
  Admin, receptionist, or the doctor themselves only (403 otherwise).
  Returns: {
    doctor_id, daily_cases [{date,count}×30], case_types [{type,count}],
    monthly_summary [{month,count}×12], attendance [{date,checkin_time,
    checkout_time,cases,on_time}×30], top_conditions [{condition,count}×5]
  }

GET    /api/doctors/:id/appointments/
  Admin, receptionist, or the doctor themselves only (403 otherwise).
  Query: ?status=scheduled|in_progress|completed|cancelled
         &ordering=-appointment_dt
  Returns: paginated { id, patient_name, patient_age, appointment_dt,
           reason, status, diagnosis, payment_status }

POST   /api/doctors/:id/checkin/
  Admin or receptionist only.
  Body: { "checkin_time": "HH:MM" }
  Returns: { date, checkin_time, on_time: bool }

POST   /api/doctors/:id/checkout/
  Admin or receptionist only.
  Body: { "checkout_time": "HH:MM" }
  Returns: { date, checkin_time, checkout_time }

DoctorObject shape (all list and detail responses):
{
  id, full_name, email, phone, qualification, specializations[],
  experience_years, status, join_date, shift_start, shift_end,
  today_checkin (ISO or null), today_checkout (ISO or null),
  cases_today, cases_this_week, cases_this_month, total_cases,
  avg_cases_per_day
}