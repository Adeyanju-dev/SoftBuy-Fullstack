from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from users.models import User
from .models import Notification


class NotificationAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()

        self.user = User.objects.create_user(
            email="user@example.com",
            password="TestPass123!",
        )
        self.other_user = User.objects.create_user(
            email="other@example.com",
            password="TestPass123!",
        )

        self.notification_1 = Notification.objects.create(
            recipient=self.user,
            notification_type="order",
            title="Order placed",
            message="Your order has been placed successfully.",
            is_read=False,
        )
        self.notification_2 = Notification.objects.create(
            recipient=self.user,
            notification_type="payment",
            title="Payment received",
            message="Your payment was successful.",
            is_read=True,
        )
        self.notification_3 = Notification.objects.create(
            recipient=self.other_user,
            notification_type="system",
            title="Other user notification",
            message="This should not be visible to the first user.",
            is_read=False,
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_user_can_list_only_own_notifications(self):
        self.authenticate(self.user)
        url = reverse("notifications:notification-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data["results"] if "results" in response.data else response.data
        returned_ids = {item["id"] for item in data}

        self.assertIn(self.notification_1.id, returned_ids)
        self.assertIn(self.notification_2.id, returned_ids)
        self.assertNotIn(self.notification_3.id, returned_ids)

    def test_user_can_filter_unread_notifications(self):
        self.authenticate(self.user)
        url = reverse("notifications:notification-list")
        response = self.client.get(url, {"is_read": "false"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["results"] if "results" in response.data else response.data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], self.notification_1.id)

    def test_user_can_get_unread_count(self):
        self.authenticate(self.user)
        url = reverse("notifications:notification-unread-count")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["unread_count"], 1)

    def test_user_can_mark_single_notification_as_read(self):
        self.authenticate(self.user)
        url = reverse(
            "notifications:notification-mark-read",
            kwargs={"pk": self.notification_1.pk}
        )
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.notification_1.refresh_from_db()
        self.assertTrue(self.notification_1.is_read)
        self.assertIsNotNone(self.notification_1.read_at)

    def test_user_can_mark_all_notifications_as_read(self):
        self.authenticate(self.user)
        Notification.objects.create(
            recipient=self.user,
            notification_type="review",
            title="New review",
            message="A new review was added.",
            is_read=False,
        )

        url = reverse("notifications:notification-mark-all-read")
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            Notification.objects.filter(recipient=self.user, is_read=False).count(),
            0
        )

    def test_user_can_update_notification_read_state_from_detail_endpoint(self):
        self.authenticate(self.user)
        url = reverse(
            "notifications:notification-detail",
            kwargs={"pk": self.notification_1.pk}
        )
        response = self.client.patch(url, {"is_read": True}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.notification_1.refresh_from_db()
        self.assertTrue(self.notification_1.is_read)

    def test_user_cannot_access_another_users_notification(self):
        self.authenticate(self.user)
        url = reverse(
            "notifications:notification-detail",
            kwargs={"pk": self.notification_3.pk}
        )
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_can_delete_own_notification(self):
        self.authenticate(self.user)
        url = reverse(
            "notifications:notification-detail",
            kwargs={"pk": self.notification_1.pk}
        )
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Notification.objects.filter(pk=self.notification_1.pk).exists())