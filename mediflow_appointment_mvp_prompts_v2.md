# MediFlow — Appointment Booking MVP: Prompt-Wise Build Plan (v2, Multi-Tenant + Feature-Gated)

Stack: Django + DRF + PostgreSQL (backend) / React + Vite (frontend), JWT via simplejwt.
Design reference: SynapCare portal screenshots (icon sidebar, stat cards, data tables). Token system and frontend prompts below are derived from it — see Design Direction.

**v2 changelog (vs original plan):** This revision adds multi-tenancy (`Organization`) and a separate per-org feature subscription layer (`Feature` / `OrganizationFeature`), because the product is sold to multiple clinics with different feature sets enabled per client. Role-based access (who can do what) and feature-based access (what a clinic's subscription includes) are now two independent, composable checks — not one hardcoded permission class. Single-tenant deployments are no longer assumed anywhere; every business query is scoped to `request.user.organization`.

---

## Scope (from MediFlow doc → this MVP)

**In scope:** multi-tenant org model, feature subscription model (admin-toggleable per org, Django Admin only for now), admin/receptionist/doctor roles, RBAC × feature-gating composed together, minimal patient record, appointment booking + status update, doctor sees own appointments only (within their org).

**Out of scope — do not build:** AI Companion, wearable ingestion, InfluxDB, Pinecone, Bull.js nightly jobs, push/SMS alerts, admin revenue dashboard, ML risk scoring, self-serve clinic onboarding/email invites, custom billing-admin UI (Django Admin is the toggle surface for v1), patient self-login/self-booking.

---

## 0. Git Branches

```bash
git init mediflow && cd mediflow
echo "# MediFlow" > README.md
git add . && git commit -m "init" && git push origin main

git checkout -b feature/appointment-backend && git push origin feature/appointment-backend
git checkout main
git checkout -b feature/appointment-frontend && git push origin feature/appointment-frontend
```
Friend stays on `feature/appointment-backend`. You stay on `feature/appointment-frontend`. Merge both into `main` only after smoke test passes.

---

## Procedure (order of execution)

| # | Step | Branch | Who |
|---|------|--------|-----|
| 1 | DB setup | — | either |
| 2 | Backend prompts B1→B9 | feature/appointment-backend | friend |
| 3 | Share API contract (below) | — | friend → you, after B8 |
| 4 | Backend QA prompt | feature/appointment-backend | friend |
| 5 | Frontend prompts F0→F7 | feature/appointment-frontend | you |
| 6 | Frontend QA checklist | feature/appointment-frontend | you |
| 7 | Merge both → main | main | together |
| 8 | Smoke test | main | together |
| 9 | Final QA | main | together |

Frontend doesn't need to wait for backend to fully finish — start as soon as the API contract (step 3) is fixed.

---

## 1. Database Setup

```sql
CREATE DATABASE mediflow_db;
CREATE USER mediflow_user WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE mediflow_db TO mediflow_user;
```

---

# BACKEND — `feature/appointment-backend`

Feed each prompt to your coding agent one at a time, review the diff, commit, move to next.

### B1 — Project scaffold
```
Create a Django project named "mediflow" with DRF. Install: django, djangorestframework,
psycopg2-binary, djangorestframework-simplejwt, django-cors-headers, python-decouple.
Create three apps: "organizations", "users", and "appointments".
Configure settings.py:
- Add rest_framework, rest_framework_simplejwt, corsheaders, organizations, users,
  appointments to INSTALLED_APPS
- corsheaders.middleware.CorsMiddleware first in MIDDLEWARE
- PostgreSQL DATABASES config: mediflow_db / mediflow_user / yourpassword / localhost:5432
- REST_FRAMEWORK default auth class JWTAuthentication, default permission IsAuthenticated
- CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
- AUTH_USER_MODEL = "users.User"
- USE_TZ = True (required — appointment past-date checks compare aware datetimes;
  leaving this off causes naive/aware comparison errors later)
Do not create models yet.
```

### B2 — Organization & Feature models (tenancy + subscription layer)
```
In organizations/models.py create:
1. Organization: name (char 150), slug (slug, unique), is_active (bool, default True),
   created_at (auto_now_add).
2. Feature: key (char 50, unique — e.g. "appointments", "patients", "billing"),
   label (char 100, human-readable), description (text, blank).
   This is a fixed catalog table, not editable per-org — it lists every feature
   that EXISTS in the product, regardless of who has bought it.
3. OrganizationFeature: organization (FK→Organization, CASCADE, related_name=features),
   feature (FK→Feature, CASCADE), is_enabled (bool, default True),
   unique_together = (organization, feature).
   This is the actual "what did this client pay for" toggle.
Register all three in organizations/admin.py with list_display showing the toggle
state clearly (use list_editable for is_enabled on OrganizationFeature so an admin
can flip it without opening each row).
Run makemigrations/migrate for "organizations" before "users" — User will FK into it.
```

### B3 — User model with roles + organization
```
In users/models.py create User(AbstractUser) with:
- organization (FK→organizations.Organization, CASCADE, related_name=users,
  null=True — null only to allow createsuperuser without an org; every real
  staff/doctor/patient user must have one)
- role (CharField, choices: admin, receptionist, doctor, patient — default "receptionist")
Add method is_staff_member() → True if role in [admin, receptionist].
Run makemigrations/migrate for "users" next — it must run before "appointments"
since AUTH_USER_MODEL depends on it, and after "organizations" since it FKs into it.
```

### B4 — Patient & Appointment models (org-scoped)
```
In appointments/models.py create:
1. Patient: organization (FK→organizations.Organization, CASCADE, related_name=patients),
   full_name (char 150), phone (char 20), age (positive int),
   condition (char 200, blank), created_at (auto_now_add).
2. Appointment: organization (FK→organizations.Organization, CASCADE, related_name=appointments),
   patient (FK→Patient, CASCADE, related_name=appointments),
   doctor (FK→User, SET_NULL, null, related_name=appointments),
   booked_by (FK→User, SET_NULL, null, related_name=booked_appointments),
   appointment_dt (DateTimeField), reason (TextField, blank),
   status (CharField, choices: scheduled/in_progress/completed/cancelled, default scheduled),
   notes (TextField, blank), created_at (auto_now_add).
Add clean() on Appointment raising ValidationError if appointment_dt < timezone.now().
Add clean() raising ValidationError if patient.organization_id != self.organization_id,
or if doctor is set and doctor.organization_id != self.organization_id, or if
doctor is set and doctor.role != "doctor" — this stops staff from cross-wiring
patients/doctors from a different organization or assigning a non-doctor user as doctor.
Meta ordering = ['-appointment_dt'].
Run makemigrations and migrate.
```

### B5 — Serializers
```
In appointments/serializers.py:
- PatientSerializer: ModelSerializer, all fields, organization read-only
  (set automatically from request.user.organization in create(), never trust client input).
- DoctorSerializer: ModelSerializer on User, fields id/first_name/last_name/email.
- AppointmentSerializer: ModelSerializer with read-only patient_name (from patient.full_name)
  and doctor_name (first_name+last_name, None if no doctor).
  read_only_fields = organization, booked_by, created_at.
  Override create() to set organization = request.user.organization and
  booked_by = request.user from serializer context.
Call appointment.full_clean() inside create()/update() (or override validate()) so all
the model-level checks from B4 (past-date, cross-org patient/doctor) actually fire
on the API, not just in Django admin.
```

### B6 — Permissions (RBAC layer + Feature layer, composed independently)
```
In appointments/permissions.py create TWO separate kinds of permission class —
do not merge role-checking and feature-checking into one class, they answer
different questions and must compose:

ROLE-BASED (who, within an org):
- IsStaffMember: authenticated AND user.is_staff_member() (admin/receptionist).
- IsDoctor: authenticated AND user.role == "doctor".

FEATURE-BASED (what the org's subscription includes) — in organizations/permissions.py:
- HasFeature(feature_key): a permission class FACTORY, not a fixed class. Usage:
  permission_classes = [IsAuthenticated, IsStaffMember, HasFeature("appointments")].
  has_permission() looks up request.user.organization, queries OrganizationFeature
  for that org + feature_key, returns True only if a row exists AND is_enabled=True.
  If the org has no row for that feature at all, treat as disabled (fail closed,
  not fail open — an unconfigured feature must never default to "on").
  Return a 403 with a clear detail message like "This feature is not included in
  your organization's plan" so the frontend can distinguish "you're not allowed"
  (role) from "your clinic hasn't bought this" (feature) — these need different
  UI treatment later.

Every appointments/patients view must require BOTH an IsStaffMember/IsDoctor check
AND a HasFeature(...) check. Neither layer is sufown — a receptionist whose org
doesn't have "appointments" enabled must be blocked even though their role permits it.
```

### B7 — Views, URLs, JWT (with role, org, and enabled features in login response)
```
In appointments/views.py — all querysets below filter by request.user.organization
FIRST, then apply role-based filtering on top. Cross-org data must never be
reachable even by guessing an ID (test this explicitly in B-QA).

- PatientViewSet (ModelViewSet): permission_classes [IsAuthenticated, IsStaffMember,
  HasFeature("patients")]. get_queryset() returns Patient.objects.filter(
  organization=request.user.organization). SearchFilter on full_name and phone.
- AppointmentViewSet (ModelViewSet): get_permissions() → [IsAuthenticated,
  IsStaffMember, HasFeature("appointments")] for create/update/partial_update/destroy,
  else [IsAuthenticated, HasFeature("appointments")] (doctors still need the
  feature enabled to even view, just not the staff role).
  get_queryset() starts with Appointment.objects.filter(organization=request.user.organization),
  then further filters to doctor=request.user when request.user.role == "doctor".
  Add @action(detail=True, methods=["patch"]) update_status, permission
  [IsAuthenticated, IsStaffMember, HasFeature("appointments")], updates status,
  returns serialized object.
- DoctorListView (ReadOnlyModelViewSet): User.objects.filter(role="doctor",
  organization=request.user.organization), permission IsAuthenticated.

In appointments/urls.py register patients, appointments, doctors via DefaultRouter.
In mediflow/urls.py wire: /admin/, /api/auth/login/, /api/auth/refresh/, /api/ → appointments.urls.

Subclass TokenObtainPairSerializer + TokenObtainPairView so the login response
includes role, first_name, last_name, organization_id, organization_name, and
enabled_features (a list of feature keys where OrganizationFeature.is_enabled=True
for that user's org) alongside access/refresh. Frontend must not guess role OR
which features to show — both come from this response.
```

### B8 — Seed data (org-aware)
```
Write a Django management command "seed_demo"
(appointments/management/commands/seed_demo.py) that creates:
- 2 Organizations: "Downtown Clinic" (slug downtown-clinic), "Riverside Medical"
  (slug riverside-medical)
- Feature catalog rows: appointments, patients (idempotent get_or_create)
- OrganizationFeature: Downtown Clinic gets BOTH features enabled. Riverside Medical
  gets only "patients" enabled, "appointments" explicitly disabled — this exists
  specifically so you can manually verify feature-gating works, not just RBAC.
- Per organization: 1 admin, 2 receptionists, 2 doctors (role + first/last name +
  organization set), 3 patients with realistic name/phone/age/condition, 4
  appointments spread across today/tomorrow with mixed statuses (skip appointment
  creation for Riverside Medical since their appointments feature is off — seeding
  data behind a disabled feature would be misleading).
Make it idempotent — skip creation if usernames/org slugs already exist.
Print a summary at the end listing login credentials per org so manual QA is fast.
```

### B9 — Django Admin for feature management
```
In organizations/admin.py (extending B2's registration):
- OrganizationAdmin: list_display (name, slug, is_active, created_at),
  inline OrganizationFeatureInline (TabularInline) so an admin can see/toggle
  every feature for that org on the Organization's own edit page, not just
  via the separate OrganizationFeature list.
- FeatureAdmin: list_display (key, label), this is the fixed catalog — in
  practice only you (the vendor), not clinic admins, should edit this table.
- OrganizationFeatureAdmin: list_display (organization, feature, is_enabled),
  list_filter on organization and is_enabled, list_editable on is_enabled
  for fast toggling from the list view without opening each row.
This is the ONLY interface for managing what a client has paid for in this MVP —
confirm in B-QA that toggling is_enabled here immediately changes API behavior
on next request (no caching, no restart needed).
```

### API contract — send this to the frontend dev right after B8

| Method | Endpoint | Auth | Body / Notes |
|---|---|---|---|
| POST | `/api/auth/login/` | none | `{username, password}` → `{access, refresh, role, first_name, last_name, organization_id, organization_name, enabled_features: ["appointments","patients"]}` |
| POST | `/api/auth/refresh/` | none | `{refresh}` → `{access}` |
| GET | `/api/patients/?search=` | staff + `patients` feature | list, filtered by name/phone, scoped to own org |
| POST | `/api/patients/` | staff + `patients` feature | `{full_name, phone, age, condition}` |
| GET | `/api/doctors/` | any authed | list, scoped to own org, for dropdown |
| GET | `/api/appointments/` | any authed + `appointments` feature | doctor → own only, staff → all (own org only) |
| POST | `/api/appointments/` | staff + `appointments` feature | `{patient, doctor, appointment_dt, reason}` |
| PATCH | `/api/appointments/{id}/update_status/` | staff + `appointments` feature | `{status}` |

A 403 from any feature-gated endpoint may mean either "wrong role" or "feature not enabled for your org" — the response `detail` text distinguishes them; frontend should not assume role failure when it receives a 403 on these routes.

---

## Backend QA

### B-QA — test prompt
```
Write Django TestCase classes in appointments/tests.py covering:
1. Login returns access/refresh + role + organization_id + enabled_features.
2. Receptionist can POST /api/appointments/; doctor gets 403 on POST.
3. Doctor's GET /api/appointments/ returns only their own; receptionist's GET
   returns all WITHIN THEIR ORG, never another org's rows.
4. POST with appointment_dt in the past returns 400.
5. update_status: staff can PATCH; doctor gets 403.
6. GET /api/patients/?search=<partial> returns only matching patients from the
   caller's own organization, even if another org has a patient with a matching name.
7. Feature gating: a staff user whose org has "appointments" disabled (seed
   Riverside Medical user) gets 403 on GET and POST /api/appointments/, even
   though their role is receptionist/admin — confirm this is independent of
   test #2's role check.
8. Cross-org isolation: create an appointment in Org A, attempt to fetch it by ID
   as a staff user from Org B → 404, not 403 (don't leak existence of the row).
9. Toggling OrganizationFeature.is_enabled in a test (no admin UI needed for
   this) immediately changes whether the next API call to a gated endpoint
   succeeds — confirms no caching issue.
Use APIClient + force_authenticate. Run: python manage.py test
```

### Backend manual checklist
```
[ ] python manage.py test → all pass
[ ] POST /api/auth/login/ (receptionist, Downtown Clinic) → 200, access+refresh+
    role+organization_id+enabled_features present, enabled_features = ["appointments","patients"]
[ ] POST /api/auth/login/ (receptionist, Riverside Medical) → enabled_features = ["patients"] only
[ ] POST /api/auth/login/ (wrong password) → 401
[ ] GET /api/patients/ without token → 401
[ ] POST /api/appointments/ as doctor → 403
[ ] POST /api/appointments/ with past date → 400 + validation message
[ ] GET /api/appointments/ as doctor → only own rows, own org only
[ ] GET /api/appointments/ as Riverside Medical receptionist → 403 ("not included
    in your plan"), even though role allows it for Downtown Clinic
[ ] PATCH update_status as receptionist → 200, status changed
[ ] Django Admin → toggle Riverside Medical's "appointments" OrganizationFeature
    to enabled → re-test GET /api/appointments/ for that user → now 200, no restart needed
[ ] Attempt to fetch another org's appointment/patient by ID → 404
```

---

# FRONTEND — `feature/appointment-frontend`

## Design Direction (reference: SynapCare portal screenshots)

**Keep from the reference:** fixed icon-sidebar with an active-state pill, one restrained accent color (everything else neutral), soft-elevation cards with no heavy borders, uppercase tracked table headers, color-coded status pills, generous 24–32px spacing, zero stock photography — the whole UI is communicated through icon + color + type, never a photo.

**Color — why not teal:** teal/mint is the default reach for "health" (it's literally the reference's accent, and most telehealth apps converge on it). Blue alone is the other cliché — every B2B clinical SaaS (EHR/scheduling tools) defaults to it, so it reads safe but anonymous. Indigo keeps blue's trust association (still reads clinical, not playful) while sitting in the territory healthcare branding research flags as the current differentiator for clinical-SaaS specifically: distinct enough to be recognizable in a screenshot, still cool/desaturated enough not to feel like a consumer wellness app.

**Type — why not Times New Roman:** it renders inconsistently cross-platform and reads dated on screen. Outfit (geometric sans, Google Fonts) replaces it site-wide — used at weight, not style, for hierarchy, which suits a geometric face better than italics would.

### Color tokens
| Token | Hex | Use |
|---|---|---|
| `--brand` | `#4338CA` | active nav, primary buttons, links, chart line, focus ring |
| `--brand-dark` | `#352E9E` | button hover/pressed state |
| `--ink` | `#14181F` | headings, primary text |
| `--slate` | `#5B6472` | secondary text, labels, placeholders |
| `--mist` | `#F6F8F9` | app background |
| `--hairline` | `#E4E8EB` | borders, dividers, table rules |
| `--canvas` | `#FFFFFF` | card / surface background |

Status colors (semantic set, separate from the brand palette above):
| Status | Text | Background |
|---|---|---|
| scheduled | `#1D4ED8` | `#E7EEFF` |
| in_progress | `#B45309` | `#FEF3C7` |
| completed | `#0F9D66` | `#E3F7EC` |
| cancelled | `#C8102E` | `#FCE4E8` |

### Typography
| Role | Font (Google Fonts) | Weights | Where |
|---|---|---|---|
| UI / Display | Outfit | 400, 500, 600, 700 | Everything — nav, buttons, page titles, stat numbers, body, form labels |
| Data / Mono | JetBrains Mono | 400, 500 | Patient ID, phone, timestamps, status codes |

**Hierarchy rule:** Outfit doesn't carry a useful italic for this kind of UI, so hierarchy comes from weight + size + color instead — Outfit 700 for page titles and big stat numbers · Outfit 500 (text-slate) for subtitles directly under a heading · Outfit 600 for active nav + buttons · Outfit 400 for body/table cells · Outfit 600 uppercase + 0.05em tracking for table headers · Mono 500 for anything tabular/numeric-ID. One family, four weights, no second typeface to manage.

### Layout
Fixed 240px icon+label sidebar · 64px topbar (title left, search + avatar right) · 32px content padding · 12px card radius / 8px control radius · card shadow `0 1px 2px rgba(20,24,31,.04), 0 8px 24px rgba(20,24,31,.04)`.

### Images / icons
No stock photography anywhere — matches the reference. Icons: `lucide-react` (layout-dashboard, users, calendar-clock, alert-triangle, settings, log-out, search, bell). Avatars are generated, never uploaded: a colored circle with initials, color deterministically hashed from the name — same pattern as "DT" / "MG" in the reference screenshots, zero image dependency for MVP.

---

### F0 — Design system setup
```
Install Tailwind CSS (with PostCSS/Autoprefixer) and lucide-react. Add Google Fonts
Outfit (400,500,600,700), JetBrains Mono (400,500) via <link> tags in index.html.
In tailwind.config.js extend theme:
- colors: brand #4338CA, brandDark #352E9E, ink #14181F, slate #5B6472, mist #F6F8F9,
  hairline #E4E8EB, canvas #FFFFFF, plus status.scheduled / status.inProgress /
  status.completed / status.cancelled as {text, bg} pairs exactly per the design
  tokens table above.
- fontFamily: sans: ['Outfit','sans-serif'], mono: ['"JetBrains Mono"','monospace'].
- borderRadius: card: '12px', control: '8px'.
- boxShadow: card: '0 1px 2px rgba(20,24,31,.04), 0 8px 24px rgba(20,24,31,.04)'.
Set body default to font-sans, bg-mist, text-ink. Do not build any page yet.
```

### F1 — Scaffold
```
Create a React app with Vite (template react). Install axios, react-router-dom,
react-hook-form, recharts, clsx.
Folder structure: src/services, src/context, src/components, src/pages, src/lib
(for the avatar-color-hash helper).
```

### F2 — API service
```
Create src/services/api.js: axios instance, baseURL http://localhost:8000/api, request
interceptor attaching Bearer token from localStorage key "access".
Add a response interceptor: on any 403, read error.response.data.detail and attach
it to the thrown error as error.featureBlocked = true if the message indicates a
plan/feature restriction (vs role restriction) — pages need to tell these apart
to render "ask your admin to enable this" vs a generic "not allowed" message.
Export: login, getPatients(search), createPatient, getDoctors, getAppointments,
bookAppointment, updateStatus(id, status).
Match this exact contract:
[paste the API contract table from the backend section]
```

### F3 — Auth context, protected routes, login screen
```
Create src/context/AuthContext.jsx: login(username, password) calls the api login
function, stores access/refresh in localStorage, and stores {role, first_name,
last_name, organization_id, organization_name, enabled_features} EXACTLY as
returned by the login response (do not infer/hardcode role or features) under
localStorage key "user". Expose user, login, logout, and a helper
hasFeature(key) => user.enabled_features.includes(key) via useAuth() — every
feature-gated UI element in later prompts uses this helper, never a hardcoded
role check alone.
Create src/components/ProtectedRoute.jsx: redirect to /login if no user in context.
Add a second guard, src/components/FeatureRoute.jsx: wraps a route, takes a
featureKey prop, redirects to a friendly "not available on your plan" page
(not a blank screen or silent redirect to /) if !hasFeature(featureKey).
Create src/pages/Login.jsx styled per the design system: centered card on bg-mist,
"MediFlow" wordmark in font-sans font-bold, Outfit 700 headline ("Welcome back"),
Outfit 500 text-slate subtitle underneath, Outfit-labeled inputs with a brand-colored
focus ring, primary button in --brand (hover --brand-dark). Calls login(), redirects
to "/" on success, shows an inline error on failure. No imagery — keep any unused
screen space a flat brand-tinted panel, not a stock photo.
```

### F4 — Portal shell (sidebar + topbar + routing)
```
Create src/lib/avatarColor.js: deterministic hash from a name string to one of 5
preset brand-adjacent colors, used to render initials avatars.
Create src/components/Sidebar.jsx matching the reference layout: logo mark + "MediFlow"
wordmark (font-sans font-bold) top-left, lucide icons + Outfit 500 labels for
Dashboard / Appointments / Patients — render the Appointments link ONLY if
hasFeature("appointments"), and the Patients link ONLY if hasFeature("patients").
Dashboard always shows (it's derived from whichever data the org actually has).
Active route gets a brand-tinted pill background + brand text color in Outfit 600
(not just bold text). Sign Out pinned at the bottom as a red-tinted ghost button.
Show organization_name in small Outfit 500 text-slate under the wordmark, so it's
visually obvious which clinic's data is on screen — useful once you're demoing
multiple orgs to prospects.
Create src/components/Topbar.jsx: page title (font-sans font-bold) + subtitle
(font-sans font-medium, text-slate) on the left, search input + initials avatar
(avatarColor) on the right.
Create src/App.jsx with BrowserRouter: /login public, everything else behind
ProtectedRoute, with /appointments additionally behind FeatureRoute("appointments")
and /patients behind FeatureRoute("patients"), inside a layout that renders
Sidebar + Topbar + page content.
```

### F5 — Dashboard (derived from existing endpoints, no new backend work)
```
Create src/pages/Dashboard.jsx. On mount, conditionally fetch appointments
(only if hasFeature("appointments")) and patients (only if hasFeature("patients"))
from the already-built endpoints — no backend changes needed, and no fetch call
at all to a feature the org doesn't have (don't rely on the 403 to skip it,
check hasFeature first so there's no console-visible failed request on every load).
Compute client-side, from whichever data was actually fetched: total patients
(if patients enabled), today's appointment count + scheduled-but-not-completed
count (if appointments enabled).
Render a stat card ONLY for each feature that's enabled — if an org has only
"patients", show one stat card, not three with two stuck at zero. Each card:
icon chip in a brand-tinted square, Outfit 500 label, Outfit 700 big number,
small delta/context line underneath in Outfit 400.
Below the cards, render the recharts line chart (appointments booked per day,
last 7 days, grouped client-side from fetched data — brand-colored line, hairline
grid, Outfit 400 axis labels) ONLY if hasFeature("appointments"). If fewer than
2 days of real data exist, render an empty state instead of a flat or fabricated line.
If neither feature is enabled for the org, render a single friendly empty-state
card: "No features enabled yet — contact your administrator."
```

### F6 — Appointments page (core feature)
```
This page is reachable only when hasFeature("appointments") (enforced by
FeatureRoute in F4) — no extra gating needed inside the page itself beyond
the existing role checks below.
Create src/components/StatusBadge.jsx: colored pill per status
(scheduled/in_progress/completed/cancelled), pulling text/bg colors from the
tailwind status tokens — not ad hoc hex values.
Create src/pages/Appointments.jsx, styled with the card/shadow/radius tokens:
- On mount, fetch appointments, patients, doctors in parallel.
- Header (font-sans font-bold title + Outfit 500 text-slate subtitle) + "+ Book
  Appointment" button — render the button ONLY if user.role !== "doctor".
- Toggleable form (react-hook-form): patient select, doctor select, datetime-local
  input, reason text input — all required except reason. On submit call
  bookAppointment; on failure show the backend's error inline (e.g. past-date
  rejection); on success refetch list and close form.
- Table: Patient, Doctor, Date & Time, Reason, Status, Actions. Headers Outfit 600
  uppercase tracked. Date & Time cell in font-mono. Status uses StatusBadge.
  Actions column has a status-change select — render ONLY if user.role !== "doctor"
  — calls updateStatus then refetches.
- Empty state row: "No appointments yet."
```

### F7 — Patients page
```
This page is reachable only when hasFeature("patients") (enforced by FeatureRoute
in F4) — no extra gating needed inside the page itself beyond the existing role
checks below.
Create src/pages/Patients.jsx: table of patients with a debounced search input
(calls getPatients(search)). First column shows an initials avatar (avatarColor) next
to the name, like the reference. Phone and condition columns in font-mono / font-sans
respectively. "+ Add Patient" form (full_name, phone, age, condition) — render ONLY
if user.role !== "doctor".
```

---

## Frontend QA

### F-QA — manual checklist (no test framework needed for MVP scope)
```
[ ] Login as Downtown Clinic receptionist → redirected to dashboard, sidebar shows
    role + organization_name, both Appointments and Patients links visible
[ ] Login as Riverside Medical receptionist → sidebar shows ONLY Patients link
    (Appointments hidden, not just disabled-looking)
[ ] Login wrong password → inline error, no redirect
[ ] Manually navigate to /appointments as Riverside Medical user (type URL
    directly) → FeatureRoute redirects to "not available on your plan" page,
    not a blank screen or crash
[ ] /appointments loads list on mount (Downtown Clinic user)
[ ] "Book Appointment" button hidden for doctor role
[ ] Submit form with empty patient field → validation error, no API call fired
[ ] Submit valid form → new row appears without page refresh
[ ] Submit appointment in the past → backend 400 surfaces visibly, not a silent failure
[ ] Status dropdown change → badge color updates immediately
[ ] Status dropdown hidden for doctor role
[ ] Doctor login → appointments table shows only their own rows, own org only
[ ] Patients page search filters as expected, never shows another org's patients
[ ] Logout → localStorage cleared, redirected to /login, browser back doesn't bypass it
[ ] Backend down → axios error caught, user sees a message, no blank screen/crash
[ ] Dashboard for Riverside Medical (patients-only org) shows one stat card, not
    three with appointment stats stuck at zero

Visual / design system
[ ] DevTools computed-style check: headings/nav/body all render Outfit, IDs/phone/dates
    render JetBrains Mono — not browser fallback fonts
[ ] No stock photography or placeholder images anywhere in the portal
[ ] Status pill colors match the token table exactly, not default red/green
[ ] Active sidebar item shows the brand-tinted pill, not just bold text
[ ] Dashboard stat numbers are computed from real fetched data, never hardcoded
[ ] Dashboard chart shows its empty state with <2 days of data, not a fake flat line
[ ] Responsive down to ~1024px, table doesn't force horizontal scroll at laptop width
[ ] Visible brand-colored keyboard focus ring on every input/button; full tab order
    sidebar → form → table works without a mouse
```

---

# Smoke Test (after merging both branches into main)

```bash
# terminal 1
cd backend && python manage.py runserver
# terminal 2
cd frontend && npm run dev
```

```
[ ] Backend boots with no migration errors
[ ] Frontend boots, /login renders
[ ] Login as Downtown Clinic receptionist (seed_demo creds) → token stored →
    dashboard loads with both stat groups
[ ] Book an appointment end-to-end → appears in table
[ ] Change its status → badge updates
[ ] Log out, log in as a Downtown Clinic doctor → only their appointments
    visible, no Book button
[ ] Log out, log in as Riverside Medical receptionist → no Appointments link
    in sidebar, Patients page works normally
[ ] Logout clears session
```

---

# Final QA

```
RBAC (role layer)
[ ] Receptionist: full access — book, edit status, view all (within own org)
[ ] Doctor: read-only, own appointments only, no Book button, no status select
[ ] Confirm backend, not just the frontend button, blocks doctors — open devtools,
    manually call api.bookAppointment while logged in as doctor → must return 403

Feature gating (subscription layer — independent of role)
[ ] Confirm backend, not just the frontend sidebar, blocks disabled features —
    open devtools, manually call api.getAppointments while logged in as a
    Riverside Medical ADMIN (highest role) → must still return 403, proving
    the feature check isn't bypassable by having a high-privilege role
[ ] Toggle a feature off for Downtown Clinic in Django Admin mid-session →
    next API call from an already-logged-in user reflects the change (no
    server restart, no special cache-bust needed)
[ ] Org with zero features enabled can still log in and see a friendly
    dashboard empty state, not a crash

Multi-tenant isolation
[ ] Two orgs' receptionists searching patients by an overlapping name never
    see each other's results
[ ] Appointment/patient IDs from one org return 404 (not 403, not the actual
    data) when requested by a staff user from a different org
[ ] seed_demo is re-run safely (idempotent) without creating duplicate orgs,
    users, or features

Edge cases
[ ] Past-date booking rejected by backend, not just by frontend validation
[ ] Empty appointments table shows the friendly empty state
[ ] Patient search with no match shows an empty state, not a crash
[ ] Network failure during booking → form stays open with entered data, not cleared
[ ] Two staff booking at once → no crash/race-condition error (overlap prevention
    is out of scope for this MVP, just confirm it doesn't break)
```
