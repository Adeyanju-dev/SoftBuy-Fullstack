from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.timezone import now
from urllib.parse import urlparse


def normalize_frontend_url(value):
    raw_value = str(value or "").strip().rstrip("/")
    if not raw_value:
        return ""

    parsed_value = urlparse(raw_value)
    if parsed_value.scheme not in {"http", "https"} or not parsed_value.netloc:
        return ""

    return f"{parsed_value.scheme}://{parsed_value.netloc}"


def get_frontend_url_from_request(request):
    for header_name in ("HTTP_ORIGIN", "HTTP_REFERER"):
        header_value = request.META.get(header_name, "")
        normalized_value = normalize_frontend_url(header_value)
        if normalized_value:
            return normalized_value

    return normalize_frontend_url(getattr(settings, "FRONTEND_URL", ""))


def send_verification_email_to_user(user, frontend_url=None):
    verification_link = user.get_email_verification_link(frontend_url=frontend_url)

    subject = "Verify your email address"
    from_email = settings.DEFAULT_FROM_EMAIL
    to = [user.email]

    context = {
        "user": user,
        "verification_link": verification_link,
        "year": now().year,
    }

    text_content = f"""
Hello {user.first_name or "there"},

Thanks for signing up on SoftBuy.

Please verify your email using the link below:
{verification_link}

If you did not create this account, ignore this email.
"""

    html_content = render_to_string("emails/verify_email.html", context)

    email = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=from_email,
        to=to,
    )
    email.attach_alternative(html_content, "text/html")
    email.send()
