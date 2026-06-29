import secrets
import string
from django.contrib.auth.hashers import make_password
from django.conf import settings
from django.contrib.auth import get_user_model
from users.email_service import send_onboarding_email
from access_control.models import Role

User = get_user_model()


def generate_temp_password(length=None):
    """
    Generates a cryptographically secure temporary password.

    Requirements:
    - Min 12 characters
    - At least 1 uppercase letter
    - At least 1 digit
    - At least 1 special character from: !@#$%^&*

    Returns the plaintext password (must be sent to user BEFORE hashing).
    """
    length = length or getattr(settings, "TEMP_PASSWORD_LENGTH", 12)
    special = "!@#$%^&*"
    alphabet = string.ascii_letters + string.digits + special

    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(length))
        has_upper = any(c.isupper() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(c in special for c in password)
        if has_upper and has_digit and has_special:
            return password


def provision_user_account(profile, role_slug, organization):
    """
    Creates or updates a Django User account for a Doctor or StaffMember
    profile, sets a temporary password, links the account to the profile,
    and sends the onboarding email.

    For doctors: the profile IS the User — updates existing record with
    password, force_password_change=True, has_account=True.

    For staff: creates a new User and links it via StaffMember.user FK.

    Parameters:
    profile -- Doctor (User with role=doctor) or StaffMember instance
    role_slug -- str, "doctor" or the custom staff role slug
    organization -- Organization instance

    Returns: dict {
        "user": User instance,
        "temp_password": str (plaintext -- used in email, not stored),
        "email_sent": bool
    }

    Raises: ValueError if profile.email is missing or already registered.
    """
    from staff.models import StaffMember

    is_staff_member = isinstance(profile, StaffMember)

    if is_staff_member:
        email = profile.email
        first_name = profile.full_name.split()[0] if profile.full_name else "User"
        last_name = " ".join(profile.full_name.split()[1:]) if profile.full_name else ""
    else:
        email = profile.email
        first_name = profile.first_name
        last_name = profile.last_name

    if not email:
        raise ValueError("Email is required to provision an account.")

    if is_staff_member:
        if User.objects.filter(email__iexact=email).exists():
            raise ValueError(f"Email {email} is already registered.")

    temp_password = generate_temp_password()

    try:
        role_obj = Role.objects.get(slug=role_slug, is_system=True)
    except Role.DoesNotExist:
        role_obj = Role.objects.filter(
            slug=role_slug, organization=organization
        ).first()

    if is_staff_member:
        user = User.objects.create_user(
            username=email.lower(),
            email=email.lower(),
            first_name=first_name,
            last_name=last_name,
            role=User.Role.PATIENT if not role_obj else User.Role.RECEPTIONIST,
            organization=organization,
            role_obj=role_obj,
            is_active=True,
            force_password_change=True,
            has_account=True,
        )
        user.set_password(temp_password)
        user.save(update_fields=["password"])

        profile.user = user
        profile.has_account = True
        profile.save(update_fields=["user", "has_account"])
    else:
        user = profile
        user.set_password(temp_password)
        user.role_obj = role_obj or user.role_obj
        user.force_password_change = True
        user.has_account = True
        user.save(update_fields=["password", "role_obj", "force_password_change", "has_account"])

    email_sent = send_onboarding_email(
        first_name=first_name,
        email=email,
        temp_password=temp_password,
    )

    return {
        "user": user,
        "temp_password": temp_password,
        "email_sent": email_sent,
    }
