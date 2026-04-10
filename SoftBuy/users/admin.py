from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _

from .models import User, SellerProfile, Address, UserProfile, PasswordResetCode


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    model = User
    list_display = ("email", "first_name", "last_name", "is_seller", "is_buyer", "is_staff", "is_active")
    list_filter = ("is_seller", "is_buyer", "is_staff", "is_active", "email_verified", "phone_verified")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Personal Info"), {"fields": ("first_name", "last_name", "phone_number")}),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_seller",
                    "is_buyer",
                    "is_staff",
                    "is_active",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                    "email_verified",
                    "phone_verified",
                )
            },
        ),
        (_("Important dates"), {"fields": ("last_login", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "first_name",
                    "last_name",
                    "password1",
                    "password2",
                    "is_seller",
                    "is_buyer",
                    "is_staff",
                    "is_active",
                ),
            },
        ),
    )
    search_fields = ("email", "first_name", "last_name")
    ordering = ("email",)
    readonly_fields = ("created_at", "updated_at", "last_login")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "preferred_currency", "created_at")
    search_fields = ("user__email",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(SellerProfile)
class SellerProfileAdmin(admin.ModelAdmin):
    list_display = ("business_name", "user", "kyc_status", "verified", "created_at")
    list_filter = ("kyc_status", "verified")
    search_fields = ("business_name", "user__email")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ("user", "street_address", "city", "country", "is_default", "address_type")
    list_filter = ("country", "address_type", "is_default")
    search_fields = ("user__email", "street_address", "city")
    readonly_fields = ("created_at", "updated_at")


@admin.register(PasswordResetCode)
class PasswordResetCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "code", "attempts", "expires_at", "created_at")
    search_fields = ("user__email", "code")
    readonly_fields = ("created_at",)
