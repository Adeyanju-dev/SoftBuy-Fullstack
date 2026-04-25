from django.urls import path
from .views import (
    register_user,
    verify_email,
    login_user,
    request_password_reset,
    verify_reset_code,
    reset_password,
    resend_verification_email,
    send_verification_email,
    become_seller,
    UserProfileView,
    SellerProfileView,
    AddressListCreateView,
    AddressDetailView,
)

urlpatterns = [
    # Authentication
    path("register/", register_user, name="register"),
    path("login/", login_user, name="login"),
    path("verify-email/<uidb64>/<token>/", verify_email, name="verify-email"),
    path("resend-verification/", resend_verification_email, name="resend-verification"),
    path("send-verification/", send_verification_email, name="send-verification-email"),

    # Password Reset
    path("password-reset/request/", request_password_reset, name="request-password-reset"),
    path("password-reset/verify-code/", verify_reset_code, name="verify-reset-code"),
    path("password-reset/confirm/", reset_password, name="reset-password"),

    # Profile
    path("profile/", UserProfileView.as_view(), name="user-profile"),
    path("become-seller/", become_seller, name="become-seller"),
    path("seller/profile/", SellerProfileView.as_view(), name="seller-profile"),

    # Address
    path("addresses/", AddressListCreateView.as_view(), name="address-list-create"),
    path("addresses/<int:pk>/", AddressDetailView.as_view(), name="address-detail"),
]
