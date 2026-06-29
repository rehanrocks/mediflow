MediFlow — User Account Provisioning & Onboarding: Backend Implementation Plan

Sequential prompts for your coding agent · Django + DRF + PostgreSQL

Feed each prompt one at a time · Commit after each · Do not skip ahead

Existing codebase assumed: all previous modules built and working —
organizations, users, appointments, patients, doctors, staff, access_control.
User model exists with role_obj FK, role_slug property, organization FK.
Doctor model exists in users app. StaffMember model exists in staff app.
JWT login with custom TokenObtainPairSerializer already returns role + permissions.

Execution Order

#PromptWhat it buildsB1Model fieldsAdd email, has_account, user FK, force_password_changeB2Email infrastructureDjango email backend + template + async sendingB3Credential generationSecure temp password generator + account creation serviceB4Doctor creation updateUpdate POST /api/doctors/ to provision account + send emailB5Staff creation updateUpdate POST /api/staff/ to provision account + send emailB6Login response updateAdd force_password_change to JWT + login responseB7Change password endpointPOST /api/auth/change-password/ with rate limitingB8Access level normalisationRename "write"/"both" → "full_access" in permissionsB9Seed data updateDemo credentials for seeded doctors and staffB-QATests + checklistFull QA

B1 — Model fields

Make the following model changes. Run makemigrations and migrate after
ALL field additions below are done — batch them into one migration per model.

─────────────────────────────────────────
User model (users/models.py)
─────────────────────────────────────────
Add one field:
force_password_change BooleanField, default=False
— Set to True when a temporary password is auto-generated for a new
doctor or staff member account.
— Set to False when the user successfully changes their password
via /api/auth/change-password/.
— Never exposed to the client as writable — only readable via the
login response and JWT payload.

─────────────────────────────────────────
User model in users/models.py — existing Doctor fields (B1 of Doctors plan)
─────────────────────────────────────────
The User model already has doctor-specific fields (qualification,
specializations, shift_start, shift_end, join_date, status, etc.)
added in the Doctors module plan. Add these two additional fields
to that same User model (role=doctor users):
has_account BooleanField, default=False
— True once the Django User account has been created and an
onboarding email has been sent. Default False for existing doctors.
— Note: for doctor users, the User record IS the account — has_account
means the account has been formally provisioned with a temp password
and the onboarding email has been sent. Before provisioning, the doctor
user exists but has not received credentials.

─────────────────────────────────────────
StaffMember model (staff/models.py)
─────────────────────────────────────────
Add three fields:
email EmailField, unique=True within org (validated in serializer,
not at DB level since uniqueness is per-org not global)
blank=False, null=False — required on creation.
has_account BooleanField, default=False
— True once Django User account created and onboarding email sent.
user OneToOneField → User, SET_NULL, null=True, blank=True,
related_name="staff_profile"
— Links the StaffMember record to the Django User account created
during provisioning. Null until account is provisioned.

─────────────────────────────────────────
Migrations
─────────────────────────────────────────
Run:
python manage.py makemigrations users --name add_force_password_change_has_account
python manage.py makemigrations staff --name add_email_has_account_user_fk
python manage.py migrate

Verify:
User table has force_password_change column (boolean, default False)
User table has has_account column (boolean, default False)
StaffMember table has email, has_account, user_id columns
No existing rows broken (all new columns have safe defaults)

B2 — Email infrastructure

─────────────────────────────────────────
Settings configuration
─────────────────────────────────────────
In settings.py add:

# Portal URL — used in onboarding emails

PORTAL_URL = env("PORTAL_URL", default="http://localhost:5173")

# Email backend

# Development: print to console (no real emails sent)

EMAIL_BACKEND = env(
"EMAIL_BACKEND",
default="django.core.mail.backends.console.EmailBackend"
)

# Production: swap to SMTP or anymail:

# EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

# EMAIL_HOST = env("EMAIL_HOST")

# EMAIL_PORT = env.int("EMAIL_PORT", default=587)

# EMAIL_USE_TLS = True

# EMAIL_HOST_USER = env("EMAIL_HOST_USER")

# EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD")

DEFAULT_FROM_EMAIL = env(
"DEFAULT_FROM_EMAIL",
default="MediFlow <noreply@mediflow.com>"
)

# Temp password length

TEMP_PASSWORD_LENGTH = 12

─────────────────────────────────────────
Email templates
─────────────────────────────────────────
Create directory: templates/emails/

Create templates/emails/onboarding_subject.txt:
Your MediFlow Portal Access

Create templates/emails/onboarding_body.txt (plain text):
Hello {{ first_name }},

Your MediFlow account has been created. Here are your login credentials:

Portal: {{ portal_url }}
Username: {{ email }}
Password: {{ temp_password }}

Please log in and change your password immediately.
Your temporary password must be changed on first login.

If you did not expect this email, please contact your administrator.

— The MediFlow Team

Create templates/emails/onboarding_body.html (HTML version):

  <!DOCTYPE html>
  <html>
  <body style="font-family: 'Outfit', Arial, sans-serif; background: #F6F8F9;
               margin: 0; padding: 32px;">
    <div style="max-width: 520px; margin: 0 auto; background: #FFFFFF;
                border-radius: 12px; padding: 40px;
                box-shadow: 0 1px 2px rgba(20,24,31,.04),
                            0 8px 24px rgba(20,24,31,.04);">
      <h2 style="color: #14181F; font-size: 20px; margin-bottom: 8px;">
        Welcome to MediFlow
      </h2>
      <p style="color: #5B6472; font-size: 14px; margin-bottom: 24px;">
        Hello {{ first_name }}, your account has been created.
      </p>

      <div style="background: #F6F8F9; border-radius: 8px; padding: 20px;
                  margin-bottom: 24px;">
        <p style="margin: 0 0 8px 0; color: #5B6472; font-size: 12px;
                  text-transform: uppercase; letter-spacing: 0.07em;">
          Your Credentials
        </p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #5B6472; font-size: 13px; padding: 6px 0;
                       width: 100px;">Portal</td>
            <td>
              <a href="{{ portal_url }}"
                 style="color: #4338CA; font-size: 13px;
                        text-decoration: none;">
                {{ portal_url }}
              </a>
            </td>
          </tr>
          <tr>
            <td style="color: #5B6472; font-size: 13px; padding: 6px 0;">
              Username
            </td>
            <td style="font-family: 'JetBrains Mono', monospace;
                       font-size: 13px; color: #14181F;">
              {{ email }}
            </td>
          </tr>
          <tr>
            <td style="color: #5B6472; font-size: 13px; padding: 6px 0;">
              Password
            </td>
            <td style="font-family: 'JetBrains Mono', monospace;
                       font-size: 14px; color: #14181F; font-weight: 600;">
              {{ temp_password }}
            </td>
          </tr>
        </table>
      </div>

      <div style="background: #FEF3C7; border: 1px solid #F59E0B;
                  border-radius: 8px; padding: 14px; margin-bottom: 24px;">
        <p style="color: #B45309; font-size: 13px; margin: 0;">
          ⚠ You will be required to change your password immediately after
          your first login.
        </p>
      </div>

      <p style="color: #5B6472; font-size: 12px; margin: 0;">
        If you did not expect this email, please contact your administrator.
      </p>
    </div>

  </body>
  </html>

─────────────────────────────────────────
Email sending service
─────────────────────────────────────────
Create users/email_service.py:

from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
import threading
import logging

logger = logging.getLogger(**name**)

def send_onboarding_email(first_name, email, temp_password):
"""
Send onboarding credentials email to a newly provisioned user.
Runs in a background thread so the HTTP response is not delayed.

Parameters:
first_name str — recipient's first name for greeting
email str — recipient's email address (also their username)
temp_password str — the plaintext temporary password (send BEFORE hashing)

Returns: None (fire and forget)
"""
context = {
"first_name": first_name,
"email": email,
"temp_password": temp_password,
"portal_url": settings.PORTAL_URL,
}

subject = render_to_string("emails/onboarding_subject.txt", context).strip()
body_txt = render_to_string("emails/onboarding_body.txt", context)
body_html = render_to_string("emails/onboarding_body.html", context)

def \_send():
try:
msg = EmailMultiAlternatives(
subject=subject,
body=body_txt,
from_email=settings.DEFAULT_FROM_EMAIL,
to=[email],
)
msg.attach_alternative(body_html, "text/html")
msg.send()
logger.info(f"Onboarding email sent to {email}")
except Exception as e:
logger.error(f"Failed to send onboarding email to {email}: {e}") # Do not re-raise — email failure must not roll back account creation.

thread = threading.Thread(target=\_send, daemon=True)
thread.start()

# Return whether the thread started (not whether the email succeeded —

# we cannot know that synchronously in this design).

# The caller uses this to set email_sent in the response.

return True

Note on Celery: If the project has Celery configured, replace the thread
approach with a Celery task. The function signature stays identical.
The thread approach is sufficient for MVP and requires no extra infrastructure.

Add "templates" to TEMPLATES[0]["DIRS"] in settings.py:
BASE_DIR / "templates"

B3 — Credential generation + account creation service

Create users/provisioning.py:

import secrets
import string
from django.contrib.auth.hashers import make_password
from django.conf import settings

─────────────────────────────────────────
generate_temp_password()
─────────────────────────────────────────
def generate_temp_password(length=None):
"""
Generates a cryptographically secure temporary password.
Requirements (also enforced on change-password endpoint): - Min 12 characters - At least 1 uppercase letter - At least 1 digit - At least 1 special character from: !@#$%^&*
  Returns the plaintext password (must be sent to user BEFORE hashing).
  """
  length = length or getattr(settings, "TEMP_PASSWORD_LENGTH", 12)
  special = "!@#$%^&\*"
alphabet = string.ascii_letters + string.digits + special

while True:
password = "".join(secrets.choice(alphabet) for \_ in range(length)) # Verify requirements are met
has_upper = any(c.isupper() for c in password)
has_digit = any(c.isdigit() for c in password)
has_special = any(c in special for c in password)
if has_upper and has_digit and has_special:
return password

─────────────────────────────────────────
provision_user_account(profile, role_slug, organization)
─────────────────────────────────────────
from django.contrib.auth import get_user_model
from users.email_service import send_onboarding_email
from access_control.models import Role

User = get_user_model()

def provision_user_account(profile, role_slug, organization):
"""
Creates a Django User account for a Doctor or StaffMember profile,
sets a temporary password, links the account to the profile, and
sends the onboarding email.

Parameters:
profile Doctor (User with role=doctor) or StaffMember instance
role_slug str — "doctor" or the custom staff role slug
organization Organization instance

Returns: dict {
"user": User instance (newly created),
"temp_password": str (plaintext — used in email, not stored),
"email_sent": bool
}

Raises: ValueError if profile.email is missing or already registered.
"""
from staff.models import StaffMember

is_staff_member = isinstance(profile, StaffMember)

# Determine email + name

if is_staff_member:
email = profile.email
first_name = profile.full_name.split()[0] if profile.full_name else "User"
last_name = " ".join(profile.full_name.split()[1:]) if profile.full_name else ""
else: # Doctor is a User instance directly
email = profile.email
first_name = profile.first_name
last_name = profile.last_name

if not email:
raise ValueError("Email is required to provision an account.")

# Check uniqueness across all users (not just in org)

if User.objects.filter(email\_\_iexact=email).exists():
raise ValueError(f"Email {email} is already registered.")

# Generate temp password

temp_password = generate_temp_password()

# Find the Role object for the role_slug

try:
role_obj = Role.objects.get(slug=role_slug, is_system=True)
except Role.DoesNotExist: # Custom role — look up in org
role_obj = Role.objects.filter(
slug=role_slug, organization=organization
).first()

# Create the User account

user = User.objects.create(
username=email.lower(),
email=email.lower(),
first_name=first_name,
last_name=last_name,
organization=organization,
role_obj=role_obj,
is_active=True,
force_password_change=True,
has_account=True, # Set legacy role CharField too (for backward compat during transition)
role=role_slug,
)
user.set_password(temp_password) # hashes and stores the password
user.save(update_fields=["password"])

# Link the User to the profile

if is_staff_member:
profile.user = user
profile.has_account = True
profile.save(update_fields=["user", "has_account"])
else: # Doctor is the User itself — just set has_account
profile.has_account = True
profile.save(update_fields=["has_account"])

# Send onboarding email (non-blocking)

email_sent = send_onboarding_email(
first_name=first_name,
email=email,
temp_password=temp_password,
)

return {
"user": user,
"temp_password": temp_password, # NOT stored after this point
"email_sent": email_sent,
}

B4 — Doctor creation: update POST /api/doctors/

In users/serializers.py, update DoctorWriteSerializer:

─────────────────────────────────────────
Add email to writable fields
─────────────────────────────────────────
Add "email" to the fields list in DoctorWriteSerializer.

Validation:
validate_email(value):
if not value:
raise serializers.ValidationError("Email is required.")
value = value.lower().strip() # Check format (DRF EmailField handles this, but confirm it's in the fields) # Check uniqueness across all users:
from django.contrib.auth import get_user_model
User = get_user_model()
qs = User.objects.filter(email\_\_iexact=value)
if self.instance:
qs = qs.exclude(pk=self.instance.pk)
if qs.exists():
raise serializers.ValidationError(
"This email is already registered to another user."
)
return value

─────────────────────────────────────────
Update DoctorListSerializer and DoctorDetailSerializer
─────────────────────────────────────────
Add to fields:
has_account (read-only, source from User model)

─────────────────────────────────────────
Update DoctorViewSet.create() in users/views.py
─────────────────────────────────────────
Override create() in DoctorViewSet:

def create(self, request, \*args, \*\*kwargs):
serializer = self.get_serializer(data=request.data)
serializer.is_valid(raise_exception=True)

    # Save the doctor (User with role=doctor)
    doctor = serializer.save(
      organization=request.user.organization,
      role="doctor",
    )

    # Provision account and send email
    email_sent = True
    try:
      from users.provisioning import provision_user_account
      result = provision_user_account(
        profile=doctor,
        role_slug="doctor",
        organization=request.user.organization,
      )
      email_sent = result["email_sent"]
    except ValueError as e:
      # Email conflict after serializer validation — rare edge case.
      # Profile is created, account is not. Log and return with warning.
      import logging
      logging.getLogger(__name__).error(
        f"Account provisioning failed for doctor {doctor.id}: {e}"
      )
      email_sent = False

    headers = self.get_success_headers(serializer.data)
    response_data = serializer.data.copy()
    response_data["has_account"] = doctor.has_account
    response_data["email_sent"]  = email_sent

    return Response(response_data, status=201, headers=headers)

Note: for doctors, the User IS the profile — provision_user_account
sets has_account=True on the same User object. The account is not a
"second" user — it is the same doctor User gaining a proper password
and force_password_change=True flag.

─────────────────────────────────────────
Response shape for POST /api/doctors/
─────────────────────────────────────────
{
...all existing DoctorObject fields...,
has_account: true,
email_sent: true // false if email backend failed — not a blocking error
}

B5 — Staff creation: update POST /api/staff/

In staff/serializers.py, update StaffWriteSerializer:

─────────────────────────────────────────
Email is already a required field from B1
─────────────────────────────────────────
email is already added to StaffMember model in B1.
Add it to StaffWriteSerializer writable fields.

Validation in StaffWriteSerializer:
validate_email(value):
if not value:
raise serializers.ValidationError("Email is required.")
value = value.lower().strip() # Uniqueness within org:
org = self.context["request"].user.organization
qs = StaffMember.objects.filter(
organization=org, email**iexact=value
)
if self.instance:
qs = qs.exclude(pk=self.instance.pk)
if qs.exists():
raise serializers.ValidationError(
"This email is already registered to another staff member."
) # Also check across all Users (since we create a User from this email):
from django.contrib.auth import get_user_model
User = get_user_model()
if User.objects.filter(email**iexact=value).exists():
raise serializers.ValidationError(
"This email is already registered as a portal user."
)
return value

─────────────────────────────────────────
Update StaffListSerializer and StaffDetailSerializer
─────────────────────────────────────────
Add to fields:
email (read + write on create, read-only on edit after provisioning)
has_account (read-only)

─────────────────────────────────────────
Update StaffMemberViewSet.perform_create() in staff/views.py
─────────────────────────────────────────
Replace the existing perform_create() and \_ensure_role_exists() with:

def perform_create(self, serializer):
staff = serializer.save(
organization=self.request.user.organization
) # Auto-save role to Role table if it's a new role (existing logic)
self.\_ensure_role_exists(staff.role, self.request.user.organization) # Store provisioning result for use in create() response
self.\_last_provision_result = self.\_provision_staff_account(staff)

def create(self, request, \*args, \*\*kwargs):
serializer = self.get_serializer(data=request.data)
serializer.is_valid(raise_exception=True)
self.perform_create(serializer)

    result    = getattr(self, "_last_provision_result", {})
    headers   = self.get_success_headers(serializer.data)
    response_data = serializer.data.copy()
    response_data["has_account"] = result.get("has_account", False)
    response_data["email_sent"]  = result.get("email_sent", False)

    return Response(response_data, status=201, headers=headers)

def \_provision_staff_account(self, staff):
"""
Creates a User account for the staff member and sends onboarding email.
Returns dict with has_account and email_sent booleans.
Never raises — errors are logged and returned as flags in the response.
"""
try:
from users.provisioning import provision_user_account # Use a role slug based on the staff member's role string
from django.utils.text import slugify
role_slug = slugify(staff.role) if staff.role else "staff"
result = provision_user_account(
profile=staff,
role_slug=role_slug,
organization=staff.organization,
)
return {
"has_account": True,
"email_sent": result["email_sent"],
}
except ValueError as e:
import logging
logging.getLogger(**name**).error(
f"Account provisioning failed for staff {staff.id}: {e}"
)
return {"has_account": False, "email_sent": False}

─────────────────────────────────────────
StaffObject response shape — updated
─────────────────────────────────────────
{
id, full_name, age, phone, email, ← email now included
address, role, status,
joining_date, created_at, notes,
has_account: true, ← NEW
email_sent: true, ← NEW (only on create response)
}

B6 — Login response: add force_password_change

In the existing custom TokenObtainPairSerializer, in validate() or get_token():

─────────────────────────────────────────
Add to JWT payload:
─────────────────────────────────────────
token["force_password_change"] = user.force_password_change

─────────────────────────────────────────
Add to JSON response body:
─────────────────────────────────────────
response_data["force_password_change"] = user.force_password_change

─────────────────────────────────────────
Behaviour contract:
─────────────────────────────────────────
When force_password_change = True:

- Token IS issued (user is authenticated — do not return 401 or 403)
- Frontend reads the flag and restricts navigation to /change-password only
- All other API endpoints still return normally if hit directly —
  the restriction is enforced on the frontend, not via a separate
  backend middleware (middleware-based enforcement is out of scope for MVP)
- Once user changes their password, force_password_change becomes False
  and the next login or token refresh will return False for this flag

When force_password_change = False:

- Normal login — no restriction

─────────────────────────────────────────
Update TokenRefreshSerializer override:
─────────────────────────────────────────
When refreshing the token, re-read force_password_change from DB:
user = User.objects.get(pk=decoded_user_id)
token["force_password_change"] = user.force_password_change

This ensures that after a user changes their password, the next refresh
token exchange returns force_password_change=False without requiring
a full re-login.

─────────────────────────────────────────
Updated login response shape:
─────────────────────────────────────────
{
access: "eyJ...",
refresh: "eyJ...",
role: { id, name, slug, is_system },
permissions: { patients: "both", ... },
organization_id: 1,
organization_name: "Downtown Clinic",
organization_logo: "http://..." | null,
enabled_features: ["appointments", "patients", ...],
first_name: "Ahmed",
last_name: "Khan",
force_password_change: true | false ← NEW
}

B7 — Change password endpoint

Create users/auth_views.py (separate from main views.py to keep it clean):

─────────────────────────────────────────
Rate limiting setup
─────────────────────────────────────────
Install: pip install django-ratelimit
Add "django_ratelimit" to INSTALLED_APPS (if not already present).

─────────────────────────────────────────
ChangePasswordView
─────────────────────────────────────────
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers as drf_serializers
from django.contrib.auth.hashers import check_password
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator

class ChangePasswordSerializer(drf_serializers.Serializer):
new_password = drf_serializers.CharField(write_only=True)
confirm_password = drf_serializers.CharField(write_only=True)

def validate_new_password(self, value): # Min length
if len(value) < 8:
raise drf_serializers.ValidationError(
"Password must be at least 8 characters."
) # Must contain uppercase
if not any(c.isupper() for c in value):
raise drf_serializers.ValidationError(
"Password must contain at least one uppercase letter."
) # Must contain digit
if not any(c.isdigit() for c in value):
raise drf_serializers.ValidationError(
"Password must contain at least one number."
) # Must contain special character
special = "!@#$%^&\*"
if not any(c in special for c in value):
raise drf_serializers.ValidationError(
f"Password must contain at least one special character ({special})."
)
return value

def validate(self, data): # Passwords must match
if data["new_password"] != data["confirm_password"]:
raise drf_serializers.ValidationError(
{"confirm_password": "Passwords do not match."}
) # New password must not equal the current (temporary) password
user = self.context["request"].user
if check_password(data["new_password"], user.password):
raise drf_serializers.ValidationError(
{"new_password": "New password must be different from your current password."}
)
return data

@method_decorator(
ratelimit(key="user", rate="5/15m", method="POST", block=True),
name="dispatch"
)
class ChangePasswordView(APIView):
permission_classes = [IsAuthenticated]

def post(self, request):
serializer = ChangePasswordSerializer(
data=request.data, context={"request": request}
)
serializer.is_valid(raise_exception=True)

    user = request.user
    user.set_password(serializer.validated_data["new_password"])
    user.force_password_change = False
    user.save(update_fields=["password", "force_password_change"])

    # Invalidate existing refresh tokens (optional but good security practice):
    # If using simplejwt's token blacklist app, blacklist the current token.
    # If blacklist app is not installed, skip this step.
    try:
      from rest_framework_simplejwt.tokens import RefreshToken
      from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
      # Blacklist all outstanding tokens for this user
      for token in OutstandingToken.objects.filter(user=user):
        try:
          token.blacklist()
        except Exception:
          pass
    except ImportError:
      pass  # Blacklist app not installed — skip

    return Response(
      {"detail": "Password updated successfully. Please log in again."},
      status=200
    )

─────────────────────────────────────────
Wire in mediflow/urls.py:
─────────────────────────────────────────
from users.auth_views import ChangePasswordView
path("api/auth/change-password/", ChangePasswordView.as_view()),

─────────────────────────────────────────
Rate limit behaviour:
─────────────────────────────────────────
Max 5 POST attempts per 15 minutes per user (keyed by authenticated user).
On exceeding the limit: 429 Too Many Requests
{ "detail": "Too many attempts. Try again in 15 minutes." }
django-ratelimit handles this automatically with block=True.

B8 — Access level normalisation

The existing ModulePermission model uses ACCESS_CHOICES with values:
("none", "No Access")
("read", "Read Only")
("write", "Write Only") ← RENAME to "full_access"
("both", "Read & Write") ← RENAME to "full_access"

Both "write" and "both" are consolidated into "full_access"
because the concept of "write-only without read" is not meaningful
in a clinical portal — you cannot add patients without seeing them.

─────────────────────────────────────────
Step 1: Update ACCESS_CHOICES in access_control/models.py
─────────────────────────────────────────
Replace:
ACCESS_CHOICES = [
("none", "No Access"),
("read", "Read Only"),
("write", "Write Only"),
("both", "Read & Write"),
]

With:
ACCESS_CHOICES = [
("no_access", "No Access"),
("read", "Read"),
("full_access", "Full Access"),
]

Also update the can_read and can_write properties on ModulePermission:
@property
def can_read(self):
return self.access in ["read", "full_access"]

@property
def can_write(self):
return self.access == "full_access"

─────────────────────────────────────────
Step 2: Data migration
─────────────────────────────────────────
Create:
python manage.py makemigrations access_control --empty
--name normalise_access_levels

In the migration's forwards function:
def forwards(apps, schema_editor):
ModulePermission = apps.get_model("access_control", "ModulePermission") # Consolidate "write" and "both" → "full_access"
ModulePermission.objects.filter(
access\_\_in=["write", "both", "read_write"]
).update(access="full_access") # Rename "none" → "no_access"
ModulePermission.objects.filter(access="none").update(access="no_access")

def backwards(apps, schema_editor):
ModulePermission = apps.get_model("access_control", "ModulePermission")
ModulePermission.objects.filter(access="full_access").update(access="both")
ModulePermission.objects.filter(access="no_access").update(access="none")

Run: python manage.py migrate

─────────────────────────────────────────
Step 3: Update HasModuleAccess permission class
─────────────────────────────────────────
In access_control/permissions.py update HasModuleAccess.has_permission():

access = perms.get(self.module, "no_access")

if self.required_access == "read":
return access in ["read", "full_access"]
if self.required_access == "write":
return access == "full_access"
if self.required_access == "full_access":
return access == "full_access"
return False

─────────────────────────────────────────
Step 4: Update seed data in B9
─────────────────────────────────────────
All seed data must use new values:
"none" → "no_access"
"both" → "full_access"
"write" → "full_access"
"read" → "read" (unchanged)

─────────────────────────────────────────
Step 5: Update set_permissions API validation
─────────────────────────────────────────
In access_control/views.py set_permissions action:
valid_access = ["no_access", "read", "full_access"]

─────────────────────────────────────────
Step 6: Update serializer normalisation (safety net)
─────────────────────────────────────────
In ModulePermissionSerializer, add a get_access method to normalise
any legacy values that may exist in the DB:

def to_representation(self, instance):
data = super().to_representation(instance) # Safety normalisation — should not be needed after migration
if data["access"] in ["write", "both", "read_write"]:
data["access"] = "full_access"
if data["access"] == "none":
data["access"] = "no_access"
return data

─────────────────────────────────────────
Run makemigrations and migrate after all steps above.
─────────────────────────────────────────

B9 — Seed data update

Update the existing seed_demo management command.

─────────────────────────────────────────
Update system role permissions to use new access level values:
─────────────────────────────────────────
SYSTEM_PERMISSIONS = {
"admin": {
"patients": "full_access",
"appointments": "full_access",
"doctors": "full_access",
"staff": "full_access",
"reports": "full_access",
},
"receptionist": {
"patients": "full_access",
"appointments": "full_access",
"doctors": "full_access",
"staff": "no_access",
"reports": "read",
},
"doctor": {
"patients": "read",
"appointments": "read",
"doctors": "read",
"staff": "no_access",
"reports": "no_access",
},
}

─────────────────────────────────────────
Add email addresses to seeded doctors:
─────────────────────────────────────────
For each seeded doctor user, set a demo email:
Doctor 1 (Ahmed Khan): email="dr.ahmed@downtown-demo.com"
Doctor 2 (Sana Malik): email="dr.sana@downtown-demo.com"

Do NOT trigger account provisioning in seed (no emails sent during seeding).
Instead just set the email field and has_account=False — provisioning is
triggered by the actual POST /api/doctors/ endpoint in production/manual QA.

─────────────────────────────────────────
Add email addresses to seeded staff:
─────────────────────────────────────────
For each seeded staff member, set a demo email:
Rashid Ali: email="rashid@downtown-demo.com"
Nazia Bibi: email="nazia@downtown-demo.com"
Tariq Mehmood: email="tariq@downtown-demo.com"
Shabana Kausar: email="shabana@downtown-demo.com"
Imran Hassan: email="imran@downtown-demo.com"

Same — set email only, has_account=False, no provisioning in seed.

─────────────────────────────────────────
Update Head Nurse role permissions:
─────────────────────────────────────────
patients: "full_access"
appointments: "full_access"
doctors: "read"
staff: "no_access"
reports: "read"

─────────────────────────────────────────
Print summary:
─────────────────────────────────────────
"Seed complete. Emails set on doctors and staff (has_account=False)."
"To test provisioning: POST /api/doctors/ or /api/staff/ with email field."

B-QA — Tests and manual checklist

Test prompt

Write Django TestCase classes in users/tests_provisioning.py.
Use APIClient + force_authenticate throughout.
Use django.test.override_settings to set EMAIL_BACKEND to
"django.core.mail.backends.locmem.EmailBackend" in all tests —
this captures sent emails in django.core.mail.outbox without actually sending.

─── Model fields ───

1.  User.force_password_change exists, defaults to False.
    User.has_account exists, defaults to False.
    StaffMember.email exists, required (blank=False).
    StaffMember.has_account exists, defaults to False.
    StaffMember.user FK exists, null=True.

─── generate_temp_password ─── 2. generate_temp_password() returns a string of length 12+.
Contains at least 1 uppercase, 1 digit, 1 special char from !@#$%^&\*.
Two consecutive calls return different values (not deterministic).

─── provision_user_account ─── 3. provision_user_account(doctor_profile, "doctor", org):
Creates a User with username=email, is_active=True.
User.force_password_change = True.
User.has_account = True.
doctor profile has_account = True.
Returns dict with keys: user, temp_password, email_sent.

4.  provision_user_account with already-used email raises ValueError.

5.  After provision, User.check_password(temp_password) returns True
    (password is set correctly before hashing).

─── Doctor creation with provisioning ─── 6. POST /api/doctors/ with valid payload including email →
201 response.
Response body includes has_account=true and email_sent=true.
django.core.mail.outbox has exactly 1 email.
Email subject = "Your MediFlow Portal Access".
Email to = [submitted email].
Email body contains the portal URL from settings.PORTAL_URL.
Email body contains the submitted email as username.

7.  POST /api/doctors/ with email already registered to another user →
    400 { email: ["This email is already registered to another user."] }
    No User created. No email sent.

8.  POST /api/doctors/ without email field →
    400 { email: ["Email is required."] }

9.  POST /api/doctors/ success → created User has force_password_change=True.

─── Staff creation with provisioning ─── 10. POST /api/staff/ with valid payload including email →
201, has_account=true, email_sent=true.
django.core.mail.outbox has 1 email to that address.
StaffMember.user_id is not null (linked to created User).

11. POST /api/staff/ with email already used by a doctor User →
    400 { email: ["This email is already registered as a portal user."] }

12. POST /api/staff/ without email →
    400 { email: ["Email is required."] }

─── Login with force_password_change ─── 13. Login as a provisioned user (force_password_change=True) →
200, response body has force_password_change: true.
JWT payload decoded also has force_password_change: true.

14. Login as a normal admin (force_password_change=False) →
    200, force_password_change: false in response.

─── Change password endpoint ─── 15. POST /api/auth/change-password/
{ new_password: "NewPass@123", confirm_password: "NewPass@123" } →
200 { detail: "Password updated successfully. Please log in again." }
User.force_password_change = False in DB.
User.check_password("NewPass@123") = True.

16. POST /api/auth/change-password/ with non-matching passwords →
    400 { confirm_password: ["Passwords do not match."] }

17. POST /api/auth/change-password/ with new_password = current temp password →
    400 { new_password: ["New password must be different from your current password."] }

18. POST /api/auth/change-password/ with short password (<8 chars) →
    400 { new_password: ["Password must be at least 8 characters."] }

19. POST /api/auth/change-password/ with no uppercase →
    400 { new_password: ["...uppercase..."] }

20. POST /api/auth/change-password/ with no digit →
    400 { new_password: ["...number..."] }

21. POST /api/auth/change-password/ with no special char →
    400 { new_password: ["...special character..."] }

22. After successful change-password, login with new password →
    200, force_password_change: false.

23. Rate limiting: 6 rapid POST /api/auth/change-password/ calls
    with wrong data → 6th returns 429.
    (Test requires django-ratelimit installed and RATELIMIT_ENABLE=True.)

─── Access level normalisation ─── 24. ModulePermission with access="both" → serializer returns "full_access".
ModulePermission with access="write" → serializer returns "full_access".
ModulePermission with access="none" → serializer returns "no_access".
ModulePermission with access="read" → serializer returns "read" (unchanged).

25. POST /api/access-control/roles/:id/set-permissions/ with
    access="full_access" → 200, stored as "full_access".
    access="no_access" → 200, stored as "no_access".
    access="write" → 400 (no longer a valid value).
    access="both" → 400 (no longer a valid value).

─── Email content ─── 26. Email sent during doctor creation: - Subject: "Your MediFlow Portal Access" - Contains first_name of the doctor - Contains PORTAL_URL from settings - Contains the submitted email as username - Has both plain text and HTML alternatives

Run: python manage.py test users.tests_provisioning
Run: python manage.py test (full suite — no regressions)

Manual QA checklist

─── Setup ───
[ ] python manage.py seed_demo → no errors, doctors and staff have email set
[ ] python manage.py migrate → all migrations apply cleanly
[ ] EMAIL_BACKEND=console in .env for development (emails print to terminal)

─── Doctor provisioning ───
[ ] POST /api/doctors/ with email="testdoctor@clinic.com" and all required fields
→ 201, response has has_account:true and email_sent:true
[ ] Check Django console: onboarding email printed with correct fields
(portal URL, username=email, temp password)
[ ] GET /api/doctors/:id/ → has_account:true in response
[ ] Django Admin → Users → new user exists with username=testdoctor@clinic.com
[ ] Django Admin → that User → force_password_change=True visible
[ ] POST /api/doctors/ with same email again →
400 { email: ["This email is already registered..."] }

─── Staff provisioning ───
[ ] POST /api/staff/ with email="testnurse@clinic.com" and all required fields
→ 201, has_account:true, email_sent:true
[ ] Console shows onboarding email for testnurse@clinic.com
[ ] Django Admin → StaffMember → user_id field populated (not null)
[ ] Django Admin → User → force_password_change=True for this staff user

─── Force password change flow ───
[ ] Login with the provisioned doctor credentials (email + temp password)
→ 200, force_password_change:true in response
[ ] POST /api/auth/change-password/
{ new_password: "Secure@2025", confirm_password: "Secure@2025" }
→ 200 { detail: "Password updated successfully..." }
[ ] Login again with new password → 200, force_password_change:false
[ ] Login with old temp password → 401 (password no longer valid)
[ ] POST /api/auth/change-password/ with same password as current → 400
[ ] POST /api/auth/change-password/ with "password" (no uppercase, etc.) → 400
[ ] POST /api/auth/change-password/ 6 times rapidly → 6th returns 429

─── Access level normalisation ───
[ ] GET /api/access-control/roles/ → no response contains "write" or "both"
— all full access shown as "full_access", no access shown as "no_access"
[ ] POST /api/access-control/roles/:id/set-permissions/
with { permissions: [{ module: "patients", access: "full_access" }] } → 200
[ ] POST same endpoint with access:"write" → 400 (invalid value)
[ ] POST same endpoint with access:"none" → 400 (invalid value, use "no_access")
[ ] Django Admin → ModulePermission list → no "write", "both", "none" values visible
— all migrated to "full_access" or "no_access"

─── Regression ───
[ ] python manage.py test → full suite passes
[ ] GET /api/appointments/ as doctor → still scoped to own appointments
[ ] GET /api/patients/ as admin → still returns all org patients
[ ] Login as existing admin (no force_password_change) → normal flow, flag=false
[ ] Branding still in login response (organization_name, organization_logo)

API Contract Summary

(Hand to frontend engineer)

─── Updated endpoints ───

POST /api/doctors/
email: string — REQUIRED (was optional before)
Response now includes:
has_account: boolean (true after provisioning)
email_sent: boolean (false if email backend failed — not blocking)

GET /api/doctors/:id/
Response now includes:
has_account: boolean

POST /api/staff/
email: string — REQUIRED (new field)
Response now includes:
email_sent: boolean
has_account: boolean

GET /api/staff/:id/
Response now includes:
email: string
has_account: boolean

POST /api/auth/login/
Response now includes:
force_password_change: boolean
If true: frontend must restrict user to /change-password only.
If false: normal portal access.

POST /api/auth/change-password/ ← NEW
Auth: Bearer token required (user must be logged in)
Body: {
new_password: string (min 8, uppercase + digit + special required)
confirm_password: string (must match new_password)
}
Success: 200 { detail: "Password updated successfully. Please log in again." }
Errors: 400 { new_password: ["..."] } or { confirm_password: ["..."] }
Rate limited: 5 requests per 15 minutes per user → 429 on exceed

─── Access level values (CHANGED) ───
Valid values in all permission-related API fields:
"no_access" — was "none" — user has no access to this module
"read" — unchanged — user can read, not write
"full_access" — was "both" or "write" — user can read and write

Any component that was sending or comparing "write", "both", or "none"
must be updated to use the new values.

─── Frontend behaviour for force_password_change ───
On login success:
if (response.force_password_change) {
// Store token normally (user is authenticated)
// Redirect to /change-password
// Block all sidebar navigation until password is changed
// Allow ONLY POST /api/auth/change-password/ to be called
} else {
// Normal portal load
}

On successful change-password response:
// Show success toast
// Clear stored user, force fresh login with new password
// Redirect to /login
