MediFlow — RBAC Module: Backend Implementation Plan

Sequential prompts for your coding agent · Django + DRF · Feed one at a time

Existing codebase assumed: all previous modules built and working —
organizations, users (with role field), appointments, patients, doctors,
staff, branding. JWT login with custom TokenObtainPairSerializer already
returns role in the response. Do not touch any existing code unless a
prompt explicitly says to modify a specific file.

Execution Order

#PromptWhat it buildsB1Login confirmation + token refreshConfirm role is DB-sourced, never client-supplied. Fix refresh if needed.B2Permission class refactorNew composable permission classes for all three rolesB3Patient scoping for doctor roleGET /api/patients/ and GET /api/patients/:id/ doctor-scopedB4Write permission updatesPOST/PUT/PATCH/DELETE on patients, doctors, appointments — correct per roleB5Staff: correct to admin-onlyRemove receptionist access from all /api/staff/\* endpointsB6Dashboard stats endpointNEW: GET /api/dashboard/stats/ — role-aware responseB7Doctors on duty endpointNEW: GET /api/doctors/on-duty/B8Seed data updateAdd receptionist user to seed, verify all roles have demo credentialsB-QATests + checklistFull QA for every changed and new endpoint

B1 — Login: confirm role is DB-sourced, never client-supplied

In the existing custom TokenObtainPairSerializer (wherever the login
response is customised), verify and enforce the following. Make changes
only where any of these are not already true:

1. The login request body accepts only "username" and "password"
   (or "email" and "password" — whichever the existing serializer uses).
   There must be NO "role" field accepted anywhere in the login payload.
   If a client sends a "role" key in the POST body, it must be silently
   ignored — never read, never used.

2. The role in the JWT payload and in the login response is read from
   the User DB row that matched the submitted credentials. It is NEVER
   taken from any client-supplied value. Confirm this is the case in
   get_token() / validate() — the role is always self.user.role, not
   validated_data.get("role") or any similar pattern.

3. Token refresh (POST /api/auth/refresh/): when a refresh token is
   exchanged for a new access token, the new access token's role claim
   must be re-read from the DB (User.objects.get(id=user_id).role),
   not carried forward from the old token's payload.
   This prevents a role change in the DB from taking effect only after
   the access token expires — a receptionist promoted to admin should
   get admin access on next refresh, not only on next full login.
   Implement by subclassing TokenRefreshSerializer:
   override validate(): after calling super().validate(), decode the
   new access token, look up the User by the "user_id" claim, read
   user.role from DB, and inject it as a fresh "role" claim in the
   new access token before returning.
   Wire the custom TokenRefreshView in mediflow/urls.py, replacing the
   existing simplejwt TokenRefreshView if one was registered there.

4. Confirm: the login response already includes "role" in the JSON body
   (not just in the JWT payload) — the frontend reads it from there.
   If it doesn't, add it to the custom TokenObtainPairSerializer's
   validate() return dict alongside access/refresh.

No model changes. No migration needed.

B2 — Permission class refactor

In the existing permissions file (appointments/permissions.py or
organizations/permissions.py — wherever IsStaffMember, IsAdminRole,
HasFeature, CanViewStaffModule currently live), add the following new
classes and update existing ones as specified. Do not remove any
existing class — only add and update.

─────────────────────────────────────────
NEW: IsAdminOrReceptionist
─────────────────────────────────────────
class IsAdminOrReceptionist(BasePermission):
"""
Grants access to admin and receptionist roles.
Blocks doctor role.
Used for: create patients, create appointments, create doctors,
edit patients, edit appointments, view staff... wait — staff is
admin-only (see B5). Use this class on patients and appointments.
"""
message = "You do not have permission to perform this action."

def has_permission(self, request, view):
return (
request.user and
request.user.is_authenticated and
request.user.role in ["admin", "receptionist"]
)

─────────────────────────────────────────
UPDATE: IsAdminRole (already exists)
─────────────────────────────────────────
No change to the class itself — it already checks role == "admin".
It will now be used on delete endpoints and edit-only-by-admin endpoints.
Just confirm it returns 403 with a clear message for receptionist and
doctor roles — not just for unauthenticated users.

─────────────────────────────────────────
NEW: IsReadOnlyForDoctor
─────────────────────────────────────────
class IsReadOnlyForDoctor(BasePermission):
"""
Used on viewsets where doctor can GET but not POST/PUT/PATCH/DELETE.
Safe methods (GET, HEAD, OPTIONS) pass for all authenticated users.
Unsafe methods (POST, PUT, PATCH, DELETE) are blocked for doctor role.
"""
message = "Doctors have read-only access."

def has_permission(self, request, view):
if not request.user or not request.user.is_authenticated:
return False
if request.method in SAFE_METHODS:
return True
return request.user.role != "doctor"

─────────────────────────────────────────
UPDATE: CanViewStaffModule (already exists in staff module)
─────────────────────────────────────────
The existing CanViewStaffModule allows admin + receptionist.
Change it to ADMIN ONLY — receptionist no longer has staff access.

def has_permission(self, request, view):
return (
request.user and
request.user.is_authenticated and
request.user.role == "admin" # ← changed from ["admin","receptionist"]
)

Update the message to: "Only administrators can access the staff module."

This single change propagates to all /api/staff/\* endpoints automatically
since they all use CanViewStaffModule in their permission_classes.
No other staff view changes needed.

─────────────────────────────────────────
No other permission classes needed.
─────────────────────────────────────────
The three classes above (IsAdminOrReceptionist, IsAdminRole,
IsReadOnlyForDoctor) plus the updated CanViewStaffModule cover every
RBAC rule in this module. Do not create per-endpoint one-off classes.

B3 — Patient scoping for doctor role

In appointments/views.py, update PatientViewSet only. No model changes.

─────────────────────────────────────────
GET /api/patients/ — list scoping
─────────────────────────────────────────
Update get_queryset() in PatientViewSet:

def get_queryset(self):
base_qs = Patient.objects.filter(
organization=self.request.user.organization
)
if self.request.user.role == "doctor": # Return only patients who have at least one appointment # where this doctor was assigned — ever, any status.
patient_ids = Appointment.objects.filter(
doctor=self.request.user,
organization=self.request.user.organization
).values_list("patient_id", flat=True).distinct()
return base_qs.filter(id\_\_in=patient_ids)
return base_qs

This uses a subquery (values_list + filter) — two queries total, which is
acceptable. Do NOT use a JOIN that could cause duplicate Patient rows.
.distinct() on patient_ids prevents duplicates in the subquery itself.

─────────────────────────────────────────
GET /api/patients/:id/ — detail access check
─────────────────────────────────────────
Override get_object() in PatientViewSet:

def get_object(self):
obj = super().get_object() # already org-scoped by get_queryset
if self.request.user.role == "doctor":
has_access = Appointment.objects.filter(
doctor=self.request.user,
patient=obj,
organization=self.request.user.organization
).exists()
if not has_access:
raise PermissionDenied(
"You do not have access to this patient."
)
return obj

PermissionDenied from rest_framework.exceptions returns 403 automatically.
The message matches exactly what the frontend spec expects:
{ "detail": "You do not have access to this patient." }

─────────────────────────────────────────
No changes to Patient model or serializer.
Response shape is identical for all roles — the frontend detects scoping
from the role it already has in AuthContext, not from a field in the response.
─────────────────────────────────────────

B4 — Write permission updates: patients, doctors, appointments

Update get_permissions() in three existing ViewSets.
Only the permission_classes per action change — no model, serializer,
or queryset logic changes.

─────────────────────────────────────────
PatientViewSet — appointments/views.py
─────────────────────────────────────────
def get_permissions(self):
if self.action == "destroy": # Admin only
return [IsAuthenticated(), IsAdminRole(), HasFeature("patients")()]

    if self.action in ["create", "update", "partial_update"]:
      # Admin + receptionist. Doctor blocked.
      return [IsAuthenticated(), IsAdminOrReceptionist(), HasFeature("patients")()]

    # list, retrieve — all roles, but queryset is scoped by B3
    return [IsAuthenticated(), HasFeature("patients")()]

─────────────────────────────────────────
DoctorViewSet — users/views.py
─────────────────────────────────────────
def get_permissions(self):
if self.action == "destroy": # Admin only
return [IsAuthenticated(), IsAdminRole(), HasFeature("doctors")()]

    if self.action == "create":
      # NEW: receptionist can now also create doctors (was admin-only before).
      return [IsAuthenticated(), IsAdminOrReceptionist(), HasFeature("doctors")()]

    if self.action in ["update", "partial_update"]:
      # Edit stays admin-only
      return [IsAuthenticated(), IsAdminRole(), HasFeature("doctors")()]

    # list, retrieve — all roles
    return [IsAuthenticated(), HasFeature("doctors")()]

Note: the checkin and checkout @actions remain staff-only (IsStaffMember)
— do not change those action permission classes.

─────────────────────────────────────────
AppointmentViewSet — appointments/views.py
─────────────────────────────────────────
def get_permissions(self):
if self.action == "destroy": # Admin only
return [IsAuthenticated(), IsAdminRole(), HasFeature("appointments")()]

    if self.action in ["create", "update", "partial_update", "update_status"]:
      # Admin + receptionist. Doctor blocked.
      return [IsAuthenticated(), IsAdminOrReceptionist(), HasFeature("appointments")()]

    # list, retrieve — all roles, queryset already scoped for doctor
    return [IsAuthenticated(), HasFeature("appointments")()]

─────────────────────────────────────────
Import IsAdminOrReceptionist at the top of each file where it is used.
─────────────────────────────────────────

B5 — Staff: correct to admin-only

In staff/permissions.py (or wherever CanViewStaffModule is defined),
apply the change described in B2: change role check from
["admin", "receptionist"] to role == "admin" only.

That is the ONLY change needed for the staff module.
All five actions (list, retrieve, create, update, destroy) already
use CanViewStaffModule or IsAdminRole — both now require admin role.
The result:
Admin → full access (unchanged)
Doctor → 403 (was already blocked)
Receptionist → 403 (was allowed before, now blocked)

Verify by checking the existing get_permissions() in StaffMemberViewSet:
list, retrieve → [IsAuthenticated, CanViewStaffModule, HasFeature("staff")]
create/update/destroy → [IsAuthenticated, IsAdminRole, HasFeature("staff")]

Since CanViewStaffModule now requires admin, and IsAdminRole also requires
admin, receptionist is blocked on all actions after this change.
No other file in the staff app needs touching.

B6 — Dashboard stats endpoint (NEW)

Create a new file: appointments/dashboard_views.py
(Keep it separate from the main views.py to avoid making that file larger.)

─────────────────────────────────────────
View: DashboardStatsView
─────────────────────────────────────────
class DashboardStatsView(APIView):
permission_classes = [IsAuthenticated]

# No feature gating on the stats endpoint itself — it responds with

# only the stats for features the org actually has enabled. If the

# org has no "appointments" feature, appointments_today is simply

# omitted or 0 — the endpoint itself is always accessible to any

# authenticated user.

def get(self, request):
user = request.user
org = user.organization
today = timezone.localdate()

    if user.role == "doctor":
      return self._doctor_stats(user, org, today)
    else:
      # admin and receptionist get the same response shape
      return self._admin_stats(user, org, today)

─── \_admin_stats(self, user, org, today) ───
All queries scoped to org. Use a single DB round-trip per aggregate
where possible — do not loop.

from django.db.models import Count, Q
from django.db.models.functions import TruncMonth

appointments_today = Appointment.objects.filter(
organization=org, appointment_dt\_\_date=today
).count()

appointments_scheduled = Appointment.objects.filter(
organization=org, appointment_dt\_\_date=today, status="scheduled"
).count()

appointments_completed = Appointment.objects.filter(
organization=org, appointment_dt\_\_date=today, status="completed"
).count()

total_patients = Patient.objects.filter(organization=org).count()

patients_this_month = Patient.objects.filter(
organization=org,
created_at**year=today.year,
created_at**month=today.month
).count()
Note: use created_at on Patient (auto_now_add) as proxy for
"joined this month" — the field is already on the model.

active_doctors = User.objects.filter(
organization=org, role="doctor", status="active", is_active=True
).count()

total_doctors = User.objects.filter(
organization=org, role="doctor", is_active=True
).count()

active_staff = StaffMember.objects.filter(
organization=org, status="active"
).count()

unique_staff_roles = StaffMember.objects.filter(
organization=org
).values("role").distinct().count()

return Response({
"appointments_today": appointments_today,
"appointments_scheduled": appointments_scheduled,
"appointments_completed": appointments_completed,
"total_patients": total_patients,
"patients_this_month": patients_this_month,
"active_doctors": active_doctors,
"total_doctors": total_doctors,
"active_staff": active_staff,
"unique_staff_roles": unique_staff_roles,
})

─── \_doctor_stats(self, user, org, today) ───
All queries scoped to this specific doctor user.

from django.utils import timezone
from datetime import timedelta

week_start = today - timedelta(days=today.weekday()) # Monday
month_start = today.replace(day=1)

base_appts = Appointment.objects.filter(
doctor=user, organization=org
)

cases_today = base_appts.filter(appointment_dt**date=today).count()
cases_this_week = base_appts.filter(
appointment_dt**date**gte=week_start,
appointment_dt**date**lte=today
).count()
cases_this_month = base_appts.filter(
appointment_dt**date**gte=month_start,
appointment_dt**date\_\_lte=today
).count()

# avg_cases_per_day: total career cases / days since join_date

total_cases = base_appts.count()
join_date = user.join_date
if join_date:
days_active = max((today - join_date).days, 1)
else:
days_active = 1
avg_cases_per_day = round(total_cases / days_active, 1)

# my_patients_total: distinct patients with at least one appointment

# where doctor = me

my_patients_total = base_appts.values("patient_id").distinct().count()

# today_checkin: from DoctorAttendance

from users.models import DoctorAttendance
attendance = DoctorAttendance.objects.filter(
doctor=user, date=today
).first()
today_checkin = (
attendance.checkin_time.strftime("%H:%M") if attendance and attendance.checkin_time
else None
)

return Response({
"cases_today": cases_today,
"cases_this_week": cases_this_week,
"cases_this_month": cases_this_month,
"avg_cases_per_day": avg_cases_per_day,
"my_patients_total": my_patients_total,
"today_checkin": today_checkin,
"shift_start": user.shift_start.strftime("%H:%M") if user.shift_start else None,
"shift_end": user.shift_end.strftime("%H:%M") if user.shift_end else None,
})

─────────────────────────────────────────
Wire the URL in mediflow/urls.py:
─────────────────────────────────────────
from appointments.dashboard_views import DashboardStatsView
path("api/dashboard/stats/", DashboardStatsView.as_view()),

No router needed — this is a single APIView, not a ViewSet.

B7 — Doctors on duty endpoint (NEW)

Add a new @action to the existing DoctorViewSet in users/views.py.

@action(detail=False, methods=["get"], url_path="on-duty")
def on_duty(self, request):
"""
Returns doctors who have checked in today (today_checkin is not null).
RBAC: admin and receptionist only. Doctor role → 403.
"""
if request.user.role == "doctor":
return Response(
{"detail": "Access denied."},
status=403
)

today = timezone.localdate()
org = request.user.organization

# Get today's attendance records where checkin_time is set

from users.models import DoctorAttendance
checked_in_ids = DoctorAttendance.objects.filter(
date=today,
organization=org,
checkin_time\_\_isnull=False
).values_list("doctor_id", flat=True)

# Fetch those doctors

doctors = User.objects.filter(
id\_\_in=checked_in_ids,
role="doctor",
organization=org,
is_active=True
)

# Build case count for today per doctor in one query

from django.db.models import Count
case_counts = Appointment.objects.filter(
doctor**in=doctors,
appointment_dt**date=today,
organization=org
).values("doctor_id").annotate(count=Count("id"))
cases_map = {c["doctor_id"]: c["count"] for c in case_counts}

# Build attendance map for checkin times

attendance_map = {
a.doctor_id: a.checkin_time
for a in DoctorAttendance.objects.filter(
doctor\_\_in=doctors, date=today
)
}

results = []
for doctor in doctors:
checkin = attendance_map.get(doctor.id)
results.append({
"id": doctor.id,
"full_name": f"{doctor.first_name} {doctor.last_name}",
"today_checkin": checkin.strftime("%H:%M") if checkin else None,
"cases_today": cases_map.get(doctor.id, 0),
})

# Sort by checkin time ascending (earliest arrival first)

results.sort(key=lambda x: x["today_checkin"] or "99:99")

# Paginate manually using DRF's built-in paginator

page = self.paginate_queryset(results)
if page is not None:
return self.get_paginated_response(page)
return Response(results)

This @action registers as GET /api/doctors/on-duty/ automatically
via the existing DefaultRouter. No URL change needed.

Note: self.get_queryset() in DoctorViewSet already filters by org,
but since on_duty() uses its own queries (not the ViewSet queryset),
the org filter is applied explicitly in each query above.

B8 — Seed data update

In the existing seed_demo management command, add or update to ensure
all three roles have demo login credentials in Downtown Clinic.

Existing seed already creates:

- 1 admin per org
- 2 receptionists per org
- 2 doctors per org

Verify these exist and print credentials clearly:
Admin: username=admin_downtown, password=demo1234
Receptionist: username=receptionist1_downtown, password=demo1234
Doctor 1: username=dr_ahmed_downtown, password=demo1234
Doctor 2: username=dr_sana_downtown, password=demo1234

If the seed already sets these usernames, just confirm.
If not, update the seed to use these exact username patterns.

Add one additional step: print a clearly formatted role summary at the
end of seed execution showing what each role can and cannot do, so the
manual QA tester knows what to test without reading the spec:

Role access summary for QA:
─────────────────────────────────────────────────────────
ADMIN → full access to all modules
RECEPTIONIST → patients (add/edit), appointments (add/edit),
doctors (view+add, not edit/delete),
NO staff access, NO dashboard/admin
DOCTOR → own appointments (read-only),
own patients (read-only),
own dashboard only
─────────────────────────────────────────────────────────

No model or migration changes — seed data only.

B-QA — Tests and manual checklist

Test prompt

Write Django TestCase classes covering the following.
Place RBAC tests in a new file: appointments/tests_rbac.py
Use APIClient + force_authenticate throughout.

─── Login / Token ───

1.  POST /api/auth/login/ with a valid admin account → 200.
    Response body contains "role": "admin".
    The request body did NOT include a "role" field — confirm server
    reads it from DB only.

2.  POST /api/auth/login/ with a valid doctor account → 200.
    Response body contains "role": "doctor".

3.  POST /api/auth/refresh/ → new access token contains "role" claim
    matching the user's current DB role.
    Test by: (a) login as receptionist, (b) change user.role to "admin"
    in DB mid-test, (c) refresh token, (d) decode new access token and
    confirm role = "admin" (not "receptionist" carried from old token).

─── Patient scoping ─── 4. GET /api/patients/ as doctor → returns ONLY patients linked to
that doctor via appointments. A patient with NO appointment for
this doctor must NOT appear.

5.  GET /api/patients/ as admin → returns all patients in org.

6.  GET /api/patients/:id/ as doctor, where patient has appointment
    with this doctor → 200.

7.  GET /api/patients/:id/ as doctor, where patient has NO appointment
    with this doctor → 403 with detail "You do not have access to this patient."

8.  POST /api/patients/ as doctor → 403.

9.  POST /api/patients/ as receptionist → 201.

10. DELETE /api/patients/:id/ as receptionist → 403 (admin only).

11. DELETE /api/patients/:id/ as admin → 204.

─── Doctor write permissions ─── 12. POST /api/doctors/ as receptionist → 201 (receptionist can now create doctors).

13. POST /api/doctors/ as doctor → 403 "Doctors cannot add other doctors."

14. PUT /api/doctors/:id/ as receptionist → 403 (edit is admin-only).

15. DELETE /api/doctors/:id/ as receptionist → 403.

16. DELETE /api/doctors/:id/ as admin → 204 (soft delete, is_active=False).

─── Appointment write permissions ─── 17. POST /api/appointments/ as doctor → 403 "Doctors cannot book appointments."

18. POST /api/appointments/ as receptionist → 201.

19. PATCH /api/appointments/:id/ (status update) as doctor → 403.

20. DELETE /api/appointments/:id/ as receptionist → 403.

21. DELETE /api/appointments/:id/ as admin → 204.

─── Staff access correction ─── 22. GET /api/staff/ as receptionist → 403 "Only administrators can access
the staff module." (Was previously allowed — must now be blocked.)

23. GET /api/staff/ as admin → 200 (unchanged).

24. GET /api/staff/ as doctor → 403 (unchanged).

─── Dashboard stats ─── 25. GET /api/dashboard/stats/ as admin → 200, response contains keys:
appointments_today, appointments_scheduled, appointments_completed,
total_patients, patients_this_month, active_doctors, total_doctors,
active_staff, unique_staff_roles.
All values are integers >= 0.

26. GET /api/dashboard/stats/ as receptionist → 200, same shape as admin.

27. GET /api/dashboard/stats/ as doctor → 200, response contains keys:
    cases_today, cases_this_week, cases_this_month, avg_cases_per_day,
    my_patients_total, today_checkin, shift_start, shift_end.
    (Completely different shape from admin — confirmed correct role branching.)

28. GET /api/dashboard/stats/ with no token → 401.

29. GET /api/dashboard/stats/ as doctor with no appointments yet →
    all numeric stats = 0, today_checkin = null, no crash.

─── Doctors on duty ─── 30. GET /api/doctors/on-duty/ as admin → 200, returns list of doctors
who have a DoctorAttendance record for today with checkin_time set.
A doctor with no attendance record today must NOT appear.

31. GET /api/doctors/on-duty/ as receptionist → 200 (same access as admin).

32. GET /api/doctors/on-duty/ as doctor → 403 "Access denied."

33. GET /api/doctors/on-duty/ returns paginated response shape:
    { count, next, previous, results }

Run: python manage.py test appointments.tests_rbac
Also run: python manage.py test — full suite must still pass (no regressions).

Manual QA checklist

─── Login behaviour ───
[ ] Login as admin (Downtown Clinic) → response has "role": "admin",
redirected to /dashboard/admin by frontend
[ ] Login as receptionist → response has "role": "receptionist",
redirected to /dashboard/admin by frontend (same dashboard)
[ ] Login as doctor → response has "role": "doctor",
redirected to /dashboard/doctor by frontend
[ ] Login with extra "role": "admin" key in body as a doctor user
→ response still has "role": "doctor" (role is ignored from body)

─── Patient scoping ───
[ ] GET /api/patients/ as doctor → only their own patients returned,
count matches appointments where doctor=this user
[ ] GET /api/patients/ as admin → all org patients returned
[ ] GET /api/patients/:id/ as doctor (own patient) → 200
[ ] GET /api/patients/:id/ as doctor (another doctor's patient) → 403
[ ] POST /api/patients/ as doctor → 403
[ ] POST /api/patients/ as receptionist → 201
[ ] DELETE /api/patients/:id/ as receptionist → 403
[ ] DELETE /api/patients/:id/ as admin → 204

─── Doctor write permissions ───
[ ] POST /api/doctors/ as receptionist → 201 (NEW — was 403 before)
[ ] POST /api/doctors/ as doctor → 403
[ ] PUT /api/doctors/:id/ as receptionist → 403
[ ] DELETE /api/doctors/:id/ as admin → 204

─── Appointment write permissions ───
[ ] POST /api/appointments/ as doctor → 403
[ ] POST /api/appointments/ as receptionist → 201
[ ] PATCH /api/appointments/:id/ as doctor → 403
[ ] DELETE /api/appointments/:id/ as receptionist → 403
[ ] DELETE /api/appointments/:id/ as admin → 204

─── Staff access ───
[ ] GET /api/staff/ as receptionist → 403 "Only administrators can
access the staff module." (CHANGED — was 200 before)
[ ] GET /api/staff/ as doctor → 403 (unchanged)
[ ] GET /api/staff/ as admin → 200 (unchanged)
[ ] POST /api/staff/ as receptionist → 403
[ ] POST /api/staff/ as admin → 201

─── Dashboard stats endpoint ───
[ ] GET /api/dashboard/stats/ (no token) → 401
[ ] GET /api/dashboard/stats/ as admin →
200, all 9 admin keys present, all integers >= 0
[ ] GET /api/dashboard/stats/ as receptionist →
200, same 9 keys as admin (same response shape)
[ ] GET /api/dashboard/stats/ as doctor →
200, 8 doctor keys present (cases_today, cases_this_week,
cases_this_month, avg_cases_per_day, my_patients_total,
today_checkin, shift_start, shift_end)
— none of the admin keys (appointments_today, total_patients, etc.)
[ ] GET /api/dashboard/stats/ as doctor with no appointments →
cases_today=0, cases_this_week=0, no crash
[ ] GET /api/dashboard/stats/ as doctor with no attendance today →
today_checkin=null, no crash
[ ] appointments_today count matches actual appointment rows for today
(create 3 appointments in seed, confirm count=3)
[ ] avg_cases_per_day = 0 for doctor with no join_date set → no
divide-by-zero error (days_active defaults to 1)

─── Doctors on duty ───
[ ] GET /api/doctors/on-duty/ as doctor → 403
[ ] GET /api/doctors/on-duty/ as admin → 200, paginated
[ ] GET /api/doctors/on-duty/ as receptionist → 200
[ ] Result includes only doctors with today's attendance checkin_time set
[ ] A doctor with attendance.date=yesterday does NOT appear
[ ] Response shape per item: { id, full_name, today_checkin, cases_today }
[ ] cases_today = 0 for a checked-in doctor with no appointments today
(not null, not crash)
[ ] Results sorted by checkin time ascending

─── Regression check ───
[ ] python manage.py test → full suite passes, no existing test broken
[ ] GET /api/doctors/ as any role → still works (not broken by on-duty addition)
[ ] GET /api/appointments/ as doctor → still returns own appointments only
[ ] Branding / login response still includes organization_name, organization_logo
[ ] Token refresh still works — POST /api/auth/refresh/ → 200

API Contract Summary

(Hand to frontend engineer)

─── CONFIRMED UNCHANGED (no action needed) ───
POST /api/auth/login/ body: { email, password } — role NEVER in body
GET /api/appointments/ doctor role → own appointments only (already working)

─── CHANGED BEHAVIOUR ───
GET /api/patients/
doctor role → own patients only (those with at least 1 appointment with doctor)
admin/receptionist → all patients (unchanged)

GET /api/patients/:id/
doctor role + not their patient → 403 { detail: "You do not have access to this patient." }
admin/receptionist → unchanged

POST /api/patients/
receptionist → 201 (unchanged)
doctor → 403 { detail: "Doctors cannot add patients." }

PUT/PATCH /api/patients/:id/
admin + receptionist → allowed
doctor → 403

DELETE /api/patients/:id/
admin only → 204
receptionist + doctor → 403

POST /api/doctors/
admin + receptionist → 201 ← receptionist now allowed (was admin-only)
doctor → 403 { detail: "Doctors cannot add other doctors." }

PUT/PATCH /api/doctors/:id/
admin only → 200
receptionist + doctor → 403

DELETE /api/doctors/:id/
admin only → 204

POST /api/appointments/
admin + receptionist → 201
doctor → 403 { detail: "Doctors cannot book appointments." }

PUT/PATCH /api/appointments/:id/
admin + receptionist → 200
doctor → 403

DELETE /api/appointments/:id/
admin only → 204

GET/POST/PUT/DELETE /api/staff/\*
admin only → allowed
receptionist → 403 { detail: "Only administrators can access the staff module." }
doctor → 403 { detail: "Only administrators can access the staff module." }

─── NEW ENDPOINTS ───
GET /api/dashboard/stats/
Auth required. No feature gating.
Admin/receptionist response:
{
appointments_today: number,
appointments_scheduled: number,
appointments_completed: number,
total_patients: number,
patients_this_month: number,
active_doctors: number,
total_doctors: number,
active_staff: number,
unique_staff_roles: number,
}
Doctor response:
{
cases_today: number,
cases_this_week: number,
cases_this_month: number,
avg_cases_per_day: number, float, 1 decimal
my_patients_total: number,
today_checkin: "HH:MM" | null,
shift_start: "HH:MM" | null,
shift_end: "HH:MM" | null,
}

GET /api/doctors/on-duty/
Auth: admin + receptionist only. Doctor → 403.
Paginated { count, next, previous, results }
Each result:
{
id: number,
full_name: string,
today_checkin: "HH:MM",
cases_today: number,
}
Sorted by today_checkin ascending.
Doctor Profile Access

Add a GET /api/doctors/me/ endpoint that allows authenticated doctors to view only their own profile, shift timings, and account details while preventing access to other doctors' private information.

Audit Logging

Implement an audit logging system that automatically records every create, update, delete, status change, and login action with user, role, timestamp, entity type, entity ID, action performed, and previous/new values where applicable.

Soft Delete for Healthcare Records

Replace hard deletion of patients, appointments, doctors, and staff with soft deletion (is_active=False or equivalent) and exclude soft-deleted records from normal API responses while preserving them for audit and compliance purposes.

Clinical Permissions Separation

Introduce a dedicated clinical permissions layer where only doctors can create and modify diagnoses, prescriptions, treatment plans, and clinical notes, while admins have read access and receptionists have no access to clinical records.
