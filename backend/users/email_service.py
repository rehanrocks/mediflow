from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
import threading
import logging

logger = logging.getLogger(__name__)


def send_onboarding_email(first_name, email, temp_password):
    """
    Send onboarding credentials email to a newly provisioned user.
    Runs in a background thread so the HTTP response is not delayed.

    Parameters:
    first_name str -- recipient's first name for greeting
    email str -- recipient's email address (also their username)
    temp_password str -- the plaintext temporary password (send BEFORE hashing)

    Returns: bool -- True if the background thread was started successfully.
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

    def _send():
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
            logger.error(f"Failed to send onboarding email to {email}: {e}")

    thread = threading.Thread(target=_send, daemon=True)
    thread.start()

    return True
