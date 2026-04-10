from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    TYPE_ORDER = "order"
    TYPE_PAYMENT = "payment"
    TYPE_PRODUCT = "product"
    TYPE_REVIEW = "review"
    TYPE_SYSTEM = "system"

    TYPE_CHOICES = (
        (TYPE_ORDER, "Order"),
        (TYPE_PAYMENT, "Payment"),
        (TYPE_PRODUCT, "Product"),
        (TYPE_REVIEW, "Review"),
        (TYPE_SYSTEM, "System"),
    )

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications"
    )
    notification_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default=TYPE_SYSTEM
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    data = models.JSONField(blank=True, null=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} -> {self.recipient.email}"

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at"])

    def mark_as_unread(self):
        if self.is_read:
            self.is_read = False
            self.read_at = None
            self.save(update_fields=["is_read", "read_at"])