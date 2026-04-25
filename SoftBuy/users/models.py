from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.tokens import default_token_generator
from django.db import models
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.utils.translation import gettext_lazy as _
from urllib.parse import urlparse

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(_("email address"), unique=True)
    first_name = models.CharField(_("first name"), max_length=150, blank=True)
    last_name = models.CharField(_("last name"), max_length=150, blank=True)

    phone_number = models.CharField(_("phone number"), max_length=20, blank=True, null=True)
    is_seller = models.BooleanField(_("is seller"), default=False)
    is_buyer = models.BooleanField(_("is buyer"), default=True)

    phone_verified = models.BooleanField(default=False)
    email_verified = models.BooleanField(default=False)
    last_verification_sent = models.DateTimeField(blank=True, null=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        db_table = "users"

    def get_email_verification_link(self, frontend_url=None):
        uid = urlsafe_base64_encode(force_bytes(self.pk))
        token = default_token_generator.make_token(self)
        configured_url = frontend_url or getattr(settings, "FRONTEND_URL", "")
        normalized_url = str(configured_url or "").strip().rstrip("/")
        parsed_url = urlparse(normalized_url)

        if not parsed_url.scheme or not parsed_url.netloc:
            normalized_url = str(getattr(settings, "FRONTEND_URL", "") or "").strip().rstrip("/")

        return f"{normalized_url}/verify-email/{uid}/{token}/"

    def __str__(self):
        return self.email


class UserProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    bio = models.TextField(blank=True)
    profile_picture = models.URLField(blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    preferred_currency = models.CharField(max_length=3, default="NGN")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_profiles"

    def __str__(self):
        return f"{self.user.email} Profile"


class SellerProfile(models.Model):
    KYC_STATUS_PENDING = "pending"
    KYC_STATUS_APPROVED = "approved"
    KYC_STATUS_REJECTED = "rejected"

    KYC_STATUS_CHOICES = [
        (KYC_STATUS_PENDING, "Pending"),
        (KYC_STATUS_APPROVED, "Approved"),
        (KYC_STATUS_REJECTED, "Rejected"),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="seller_profile",
    )
    business_name = models.CharField(_("business name"), max_length=255, blank=True, null=True)
    business_description = models.TextField(blank=True)
    business_address = models.TextField(blank=True)
    business_phone = models.CharField(_("business phone"), max_length=20, blank=True, null=True)
    verified = models.BooleanField(_("verified"), default=False)
    kyc_status = models.CharField(
        max_length=20,
        choices=KYC_STATUS_CHOICES,
        default=KYC_STATUS_PENDING,
    )
    kyc_documents = models.JSONField(default=dict, blank=True)
    payout_info = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "seller_profiles"

    def __str__(self):
        return f"{self.business_name or 'Seller'} - {self.user.email}"


class Address(models.Model):
    ADDRESS_TYPE_BILLING = "billing"
    ADDRESS_TYPE_SHIPPING = "shipping"
    ADDRESS_TYPE_BOTH = "both"

    ADDRESS_TYPE_CHOICES = [
        (ADDRESS_TYPE_BILLING, "Billing"),
        (ADDRESS_TYPE_SHIPPING, "Shipping"),
        (ADDRESS_TYPE_BOTH, "Both"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="addresses",
    )
    address_type = models.CharField(
        max_length=20,
        choices=ADDRESS_TYPE_CHOICES,
        default=ADDRESS_TYPE_SHIPPING,
    )
    street_address = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "addresses"
        verbose_name_plural = "addresses"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_default:
            Address.objects.filter(user=self.user).exclude(pk=self.pk).update(is_default=False)

    def __str__(self):
        return f"{self.street_address}, {self.city}, {self.country}"


class PasswordResetCode(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reset_codes")
    code = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    attempts = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "password_reset_codes"
        ordering = ["-created_at"]

    def is_expired(self):
        expiry_candidates = []
        if self.expires_at:
            expiry_candidates.append(self.expires_at)
        if self.created_at:
            expiry_candidates.append(self.created_at + timedelta(minutes=10))

        effective_expiry = min(expiry_candidates) if expiry_candidates else timezone.now()
        return timezone.now() > effective_expiry

    def save(self, *args, **kwargs):
        if not self.expires_at:
            base_time = self.created_at if self.created_at else timezone.now()
            self.expires_at = base_time + timedelta(minutes=10)
        super().save(*args, **kwargs)

    def set_code(self, raw_code):
        self.code = make_password(raw_code)

    def check_code(self, raw_code):
        return check_password(raw_code, self.code)

    def register_failed_attempt(self):
        self.attempts += 1
        self.save(update_fields=["attempts"])

    def __str__(self):
        return f"{self.user.email} password reset"
