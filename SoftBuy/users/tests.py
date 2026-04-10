from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.tokens import default_token_generator
from django.urls import reverse
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from users.models import User, UserProfile, SellerProfile, Address, PasswordResetCode


class UsersAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()

        self.user = User.objects.create_user(
            email="user@example.com",
            password="StrongPass123!",
            first_name="John",
            last_name="Doe",
            is_buyer=True,
            is_seller=False,
            email_verified=True,
        )
        self.profile = UserProfile.objects.create(user=self.user, bio="Hello")

        self.seller_user = User.objects.create_user(
            email="seller@example.com",
            password="StrongPass123!",
            first_name="Seller",
            last_name="One",
            is_buyer=False,
            is_seller=True,
            email_verified=True,
        )
        self.seller_profile = UserProfile.objects.create(user=self.seller_user)
        self.seller_business = SellerProfile.objects.create(
            user=self.seller_user,
            business_name="Seller Store",
        )

        self.other_user = User.objects.create_user(
            email="other@example.com",
            password="StrongPass123!",
            first_name="Other",
            last_name="User",
            is_buyer=True,
            email_verified=True,
        )
        self.other_profile = UserProfile.objects.create(user=self.other_user)

        self.inactive_user = User.objects.create_user(
            email="inactive@example.com",
            password="StrongPass123!",
            first_name="Inactive",
            last_name="User",
            is_active=False,
            email_verified=True,
        )
        self.inactive_profile = UserProfile.objects.create(user=self.inactive_user)

        self.unverified_user = User.objects.create_user(
            email="unverified@example.com",
            password="StrongPass123!",
            first_name="Unverified",
            last_name="User",
            email_verified=False,
        )
        self.unverified_profile = UserProfile.objects.create(user=self.unverified_user)

        self.register_url = reverse("register")
        self.login_url = reverse("login")
        self.resend_verification_url = reverse("resend-verification")
        self.request_reset_url = reverse("request-password-reset")
        self.verify_code_url = reverse("verify-reset-code")
        self.reset_password_url = reverse("reset-password")
        self.profile_url = reverse("user-profile")
        self.seller_profile_url = reverse("seller-profile")
        self.address_list_url = reverse("address-list-create")
        self.send_seller_verification_url = reverse("send-verification-email")

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    # Registration

    @patch("users.views.auth_views.send_verification_email_to_user")
    def test_user_can_register(self, mock_send_email):
        payload = {
            "email": "newuser@example.com",
            "first_name": "New",
            "last_name": "User",
            "password": "StrongPass123!",
            "password2": "StrongPass123!",
        }

        response = self.client.post(self.register_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email="newuser@example.com").exists())

        user = User.objects.get(email="newuser@example.com")
        self.assertFalse(user.email_verified)
        self.assertTrue(UserProfile.objects.filter(user=user).exists())
        self.assertFalse(hasattr(user, "seller_profile"))
        mock_send_email.assert_called_once()

    @patch("users.views.auth_views.send_verification_email_to_user")
    def test_seller_can_register_and_get_seller_profile(self, mock_send_email):
        payload = {
            "email": "newseller@example.com",
            "first_name": "New",
            "last_name": "Seller",
            "password": "StrongPass123!",
            "password2": "StrongPass123!",
            "is_seller": True,
            "is_buyer": False,
        }

        response = self.client.post(self.register_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="newseller@example.com")
        self.assertTrue(user.is_seller)
        self.assertTrue(SellerProfile.objects.filter(user=user).exists())
        mock_send_email.assert_called_once()

    def test_register_rejects_password_mismatch(self):
        payload = {
            "email": "bad@example.com",
            "first_name": "Bad",
            "last_name": "User",
            "password": "StrongPass123!",
            "password2": "WrongPass123!",
        }

        response = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_register_rejects_duplicate_email(self):
        payload = {
            "email": self.user.email,
            "first_name": "John",
            "last_name": "Doe",
            "password": "StrongPass123!",
            "password2": "StrongPass123!",
        }

        response = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # Email verification

    def test_verify_email_success(self):
        uid = urlsafe_base64_encode(force_bytes(self.unverified_user.pk))
        token = default_token_generator.make_token(self.unverified_user)
        url = reverse("verify-email", kwargs={"uidb64": uid, "token": token})

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.unverified_user.refresh_from_db()
        self.assertTrue(self.unverified_user.email_verified)

    def test_verify_email_invalid_token(self):
        uid = urlsafe_base64_encode(force_bytes(self.unverified_user.pk))
        url = reverse("verify-email", kwargs={"uidb64": uid, "token": "bad-token"})

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # Login

    def test_verified_user_can_login(self):
        response = self.client.post(
            self.login_url,
            {"email": self.user.email, "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], self.user.email)

    def test_login_rejects_bad_credentials(self):
        response = self.client.post(
            self.login_url,
            {"email": self.user.email, "password": "WrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_rejects_inactive_user(self):
        response = self.client.post(
            self.login_url,
            {"email": self.inactive_user.email, "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_login_rejects_unverified_user(self):
        response = self.client.post(
            self.login_url,
            {"email": self.unverified_user.email, "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # User profile

    def test_authenticated_user_can_get_profile(self):
        self.authenticate(self.user)
        response = self.client.get(self.profile_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], self.user.email)

    def test_authenticated_user_can_update_profile_fields(self):
        self.authenticate(self.user)
        response = self.client.patch(
            self.profile_url,
            {"first_name": "Updated", "phone_number": "08012345678"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Updated")
        self.assertEqual(self.user.phone_number, "08012345678")

    def test_anonymous_cannot_access_profile(self):
        response = self.client.get(self.profile_url)
        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )

    # Seller profile

    def test_seller_can_get_seller_profile(self):
        self.authenticate(self.seller_user)
        response = self.client.get(self.seller_profile_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["business_name"],
            self.seller_business.business_name,
        )

    def test_buyer_cannot_get_seller_profile(self):
        self.authenticate(self.user)
        response = self.client.get(self.seller_profile_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_seller_can_update_allowed_seller_profile_fields(self):
        self.authenticate(self.seller_user)
        response = self.client.patch(
            self.seller_profile_url,
            {
                "business_name": "Updated Store",
                "business_phone": "09000000000",
                "business_description": "New description",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.seller_business.refresh_from_db()
        self.assertEqual(self.seller_business.business_name, "Updated Store")
        self.assertEqual(self.seller_business.business_phone, "09000000000")

    def test_seller_cannot_update_read_only_fields(self):
        self.authenticate(self.seller_user)
        response = self.client.patch(
            self.seller_profile_url,
            {"verified": True, "kyc_status": "approved"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.seller_business.refresh_from_db()
        self.assertFalse(self.seller_business.verified)
        self.assertEqual(self.seller_business.kyc_status, "pending")

    # Addresses

    def test_user_can_list_only_own_addresses(self):
        Address.objects.create(
            user=self.user,
            street_address="123 Main St",
            city="Lagos",
            state="Lagos",
            country="Nigeria",
            postal_code="100001",
            address_type="shipping",
        )
        Address.objects.create(
            user=self.other_user,
            street_address="999 Elsewhere",
            city="Abuja",
            state="FCT",
            country="Nigeria",
            postal_code="900001",
            address_type="billing",
        )

        self.authenticate(self.user)
        response = self.client.get(self.address_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"] if "results" in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["city"], "Lagos")

    def test_user_can_create_address(self):
        self.authenticate(self.user)
        response = self.client.post(
            self.address_list_url,
            {
                "street_address": "123 Main St",
                "city": "Lagos",
                "state": "Lagos",
                "country": "Nigeria",
                "postal_code": "100001",
                "address_type": "shipping",
                "is_default": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Address.objects.filter(user=self.user, city="Lagos").exists())

    def test_only_one_default_address_per_user(self):
        a1 = Address.objects.create(
            user=self.user,
            street_address="123 Main St",
            city="Lagos",
            state="Lagos",
            country="Nigeria",
            postal_code="100001",
            is_default=True,
        )
        a2 = Address.objects.create(
            user=self.user,
            street_address="456 New St",
            city="Ibadan",
            state="Oyo",
            country="Nigeria",
            postal_code="200001",
            is_default=True,
        )

        a1.refresh_from_db()
        a2.refresh_from_db()

        self.assertFalse(a1.is_default)
        self.assertTrue(a2.is_default)

    def test_user_can_retrieve_update_delete_own_address(self):
        address = Address.objects.create(
            user=self.user,
            street_address="123 Main St",
            city="Lagos",
            state="Lagos",
            country="Nigeria",
            postal_code="100001",
            address_type="shipping",
        )
        url = reverse("address-detail", kwargs={"pk": address.pk})

        self.authenticate(self.user)

        get_response = self.client.get(url)
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)

        patch_response = self.client.patch(url, {"city": "Abuja"}, format="json")
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        address.refresh_from_db()
        self.assertEqual(address.city, "Abuja")

        delete_response = self.client.delete(url)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Address.objects.filter(pk=address.pk).exists())

    def test_user_cannot_access_other_users_address(self):
        address = Address.objects.create(
            user=self.other_user,
            street_address="999 Elsewhere",
            city="Abuja",
            state="FCT",
            country="Nigeria",
            postal_code="900001",
            address_type="billing",
        )
        url = reverse("address-detail", kwargs={"pk": address.pk})

        self.authenticate(self.user)
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # Seller verification email endpoint

    @patch("users.views.profile_views.send_verification_email_to_user")
    def test_seller_can_send_verification_email(self, mock_send_email):
        self.authenticate(self.seller_user)
        response = self.client.post(self.send_seller_verification_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_send_email.assert_called_once_with(self.seller_user)

    def test_buyer_cannot_send_seller_verification_email(self):
        self.authenticate(self.user)
        response = self.client.post(self.send_seller_verification_url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # Password reset

    @patch("users.views.auth_views.send_mail")
    def test_request_password_reset_sends_code(self, mock_send_mail):
        response = self.client.post(
            self.request_reset_url,
            {"email": self.user.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(PasswordResetCode.objects.filter(user=self.user).exists())
        reset_code = PasswordResetCode.objects.get(user=self.user)
        sent_message = mock_send_mail.call_args[0][1]
        sent_code = sent_message.split(" is ")[1].split(".")[0]
        self.assertNotEqual(reset_code.code, sent_code)
        self.assertTrue(reset_code.check_code(sent_code))
        mock_send_mail.assert_called_once()

    def test_request_password_reset_hides_unknown_email(self):
        response = self.client.post(
            self.request_reset_url,
            {"email": "missing@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["message"],
            "If the email is registered, a password reset code has been sent.",
        )

    def test_verify_reset_code_success(self):
        reset_code = PasswordResetCode(user=self.user)
        reset_code.set_code("123456")
        reset_code.save()

        response = self.client.post(
            self.verify_code_url,
            {"email": self.user.email, "code": "123456"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_verify_reset_code_invalid(self):
        response = self.client.post(
            self.verify_code_url,
            {"email": self.user.email, "code": "000000"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_reset_code_expired(self):
        reset_code = PasswordResetCode(user=self.user)
        reset_code.set_code("123456")
        reset_code.save()
        PasswordResetCode.objects.filter(pk=reset_code.pk).update(
            created_at=timezone.now() - timedelta(minutes=11)
        )

        response = self.client.post(
            self.verify_code_url,
            {"email": self.user.email, "code": "123456"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reset_password_success(self):
        reset_code = PasswordResetCode(user=self.user)
        reset_code.set_code("123456")
        reset_code.save()

        response = self.client.post(
            self.reset_password_url,
            {
                "email": self.user.email,
                "code": "123456",
                "password": "NewStrongPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewStrongPass123!"))
        self.assertFalse(PasswordResetCode.objects.filter(user=self.user).exists())

    def test_reset_password_invalid_code(self):
        response = self.client.post(
            self.reset_password_url,
            {
                "email": self.user.email,
                "code": "999999",
                "password": "NewStrongPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reset_password_expired_code(self):
        reset_code = PasswordResetCode(user=self.user)
        reset_code.set_code("123456")
        reset_code.save()
        PasswordResetCode.objects.filter(pk=reset_code.pk).update(
            created_at=timezone.now() - timedelta(minutes=11)
        )

        response = self.client.post(
            self.reset_password_url,
            {
                "email": self.user.email,
                "code": "123456",
                "password": "NewStrongPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # Resend verification

    @patch("users.views.auth_views.send_verification_email_to_user")
    def test_resend_verification_email_success(self, mock_send_email):
        self.unverified_user.last_verification_sent = timezone.now() - timedelta(minutes=2)
        self.unverified_user.save(update_fields=["last_verification_sent"])

        response = self.client.post(
            self.resend_verification_url,
            {"email": self.unverified_user.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_send_email.assert_called_once()

    @patch("users.views.auth_views.send_verification_email_to_user")
    def test_resend_verification_email_rate_limited(self, mock_send_email):
        self.unverified_user.last_verification_sent = timezone.now()
        self.unverified_user.save(update_fields=["last_verification_sent"])

        response = self.client.post(
            self.resend_verification_url,
            {"email": self.unverified_user.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        mock_send_email.assert_not_called()

    def test_resend_verification_email_user_not_found(self):
        response = self.client.post(
            self.resend_verification_url,
            {"email": "missing@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_resend_verification_email_for_already_verified_user(self):
        response = self.client.post(
            self.resend_verification_url,
            {"email": self.user.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "This email address has already been verified.")
