import random
import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import PasswordResetCode, SellerProfile, UserProfile
from ..serializers import (
    ErrorResponseSerializer,
    LoginResponseSerializer,
    LoginSerializer,
    MessageResponseSerializer,
    RegisterResponseSerializer,
    RequestPasswordResetSerializer,
    ResendVerificationCooldownSerializer,
    ResendVerificationSerializer,
    ResetPasswordSerializer,
    UserRegistrationSerializer,
    UserSerializer,
    VerifyResetCodeSerializer,
)
from ..utils import get_frontend_url_from_request, send_verification_email_to_user

User = get_user_model()
logger = logging.getLogger(__name__)


@extend_schema(
    request=UserRegistrationSerializer,
    responses={201: RegisterResponseSerializer, 400: ErrorResponseSerializer},
    tags=["Authentication"],
    summary="Register a new user",
)
@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def register_user(request):
    serializer = UserRegistrationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    frontend_url = get_frontend_url_from_request(request)

    user = serializer.save()
    user.email_verified = False
    user.save(update_fields=["email_verified"])

    UserProfile.objects.create(user=user)

    if user.is_seller and not hasattr(user, "seller_profile"):
        SellerProfile.objects.create(user=user)

    try:
        send_verification_email_to_user(user, frontend_url=frontend_url)
        user.last_verification_sent = timezone.now()
        user.save(update_fields=["last_verification_sent"])
    except Exception as exc:
        logger.exception("Email sending failed for user_id=%s", user.id)

    return Response(
        {
            "user": UserSerializer(user).data,
            "message": "Account created successfully. Please verify your email before logging in.",
        },
        status=status.HTTP_201_CREATED,
    )


@extend_schema(
    parameters=[
        OpenApiParameter(name="uidb64", location=OpenApiParameter.PATH, required=True, type=str),
        OpenApiParameter(name="token", location=OpenApiParameter.PATH, required=True, type=str),
    ],
    responses={200: MessageResponseSerializer, 400: ErrorResponseSerializer},
    tags=["Authentication"],
    summary="Verify email",
)
@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def verify_email(request, uidb64, token):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user and default_token_generator.check_token(user, token):
        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=["email_verified"])
        return Response(
            {"message": "Email verified successfully."},
            status=status.HTTP_200_OK,
        )

    return Response(
        {"error": "Invalid or expired verification link."},
        status=status.HTTP_400_BAD_REQUEST,
    )


@extend_schema(
    request=LoginSerializer,
    responses={
        200: LoginResponseSerializer,
        401: ErrorResponseSerializer,
        403: ErrorResponseSerializer,
    },
    tags=["Authentication"],
    summary="Login user",
)
@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def login_user(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]
    password = serializer.validated_data["password"]

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {"error": "Invalid email or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.check_password(password):
        return Response(
            {"error": "Invalid email or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_active:
        return Response(
            {"error": "This account is inactive."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if not user.email_verified:
        return Response(
            {"error": "Email is not verified. Please check your email for the verification link."},
            status=status.HTTP_403_FORBIDDEN,
        )

    refresh = RefreshToken.for_user(user)

    return Response(
        {
            "user": UserSerializer(user).data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        },
        status=status.HTTP_200_OK,
    )


@extend_schema(
    request=RequestPasswordResetSerializer,
    responses={200: MessageResponseSerializer, 404: ErrorResponseSerializer},
    tags=["Password Reset"],
    summary="Request password reset",
)
@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def request_password_reset(request):
    serializer = RequestPasswordResetSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]
    user = User.objects.filter(email=email).first()

    if user:
        PasswordResetCode.objects.filter(user=user).delete()

        code = str(random.randint(100000, 999999))
        reset_code = PasswordResetCode(
            user=user,
            attempts=0,
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        reset_code.set_code(code)
        reset_code.save()

        send_mail(
            "Password Reset Code",
            f"Your password reset code is {code}. It expires in 10 minutes.",
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )

    return Response(
        {"message": "If the email is registered, a password reset code has been sent."},
        status=status.HTTP_200_OK,
    )


@extend_schema(
    request=VerifyResetCodeSerializer,
    responses={200: MessageResponseSerializer, 400: ErrorResponseSerializer},
    tags=["Password Reset"],
    summary="Verify reset code",
)
@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def verify_reset_code(request):
    serializer = VerifyResetCodeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]
    code = serializer.validated_data["code"]

    user = User.objects.filter(email=email).first()
    reset_record = (
        PasswordResetCode.objects.filter(user=user).latest("created_at")
        if user is not None and PasswordResetCode.objects.filter(user=user).exists()
        else None
    )

    if user is None or reset_record is None:
        return Response(
            {"error": "The reset code is invalid."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not reset_record.check_code(code):
        reset_record.register_failed_attempt()
        return Response(
            {"error": "The reset code is invalid."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if reset_record.is_expired():
        return Response(
            {"error": "The reset code has expired."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {"message": "Reset code verified successfully."},
        status=status.HTTP_200_OK,
    )


@extend_schema(
    request=ResetPasswordSerializer,
    responses={200: MessageResponseSerializer, 400: ErrorResponseSerializer},
    tags=["Password Reset"],
    summary="Reset password",
)
@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def reset_password(request):
    serializer = ResetPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]
    code = serializer.validated_data["code"]
    new_password = serializer.validated_data["password"]

    user = User.objects.filter(email=email).first()
    reset_record = (
        PasswordResetCode.objects.filter(user=user).latest("created_at")
        if user is not None and PasswordResetCode.objects.filter(user=user).exists()
        else None
    )

    if user is None or reset_record is None:
        return Response(
            {"error": "The reset code is invalid."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not reset_record.check_code(code):
        reset_record.register_failed_attempt()
        return Response(
            {"error": "The reset code is invalid."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if reset_record.is_expired():
        return Response(
            {"error": "The reset code has expired."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(new_password)
    user.save(update_fields=["password"])

    PasswordResetCode.objects.filter(user=user).delete()

    return Response(
        {"message": "Your password has been reset successfully."},
        status=status.HTTP_200_OK,
    )


@extend_schema(
    request=ResendVerificationSerializer,
    responses={
        200: MessageResponseSerializer,
        404: ErrorResponseSerializer,
        429: ResendVerificationCooldownSerializer,
    },
    tags=["Authentication"],
    summary="Resend verification email",
)
@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def resend_verification_email(request):
    serializer = ResendVerificationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    frontend_url = get_frontend_url_from_request(request)

    email = serializer.validated_data["email"]

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {"error": "No account was found for this email address."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if user.email_verified:
        return Response(
            {"message": "This email address has already been verified."},
            status=status.HTTP_200_OK,
        )

    if user.last_verification_sent:
        elapsed = timezone.now() - user.last_verification_sent
        if elapsed < timedelta(seconds=60):
            remaining = 60 - int(elapsed.total_seconds())
            return Response(
                {"error": "Please wait before requesting another verification email.", "remaining": remaining},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

    send_verification_email_to_user(user, frontend_url=frontend_url)
    user.last_verification_sent = timezone.now()
    user.save(update_fields=["last_verification_sent"])

    return Response(
        {"message": "The verification email has been resent successfully."},
        status=status.HTTP_200_OK,
    )
