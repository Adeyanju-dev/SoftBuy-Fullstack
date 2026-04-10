from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.timezone import now


def send_verification_email_to_user(user):
    verification_link = user.get_email_verification_link()

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