from decimal import Decimal
import uuid

from django.core.validators import MinValueValidator
from django.db import models

from orders.models import Order
from users.models import User, SellerProfile


class Payment(models.Model):
    STATUS_PENDING = "pending"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_REFUNDED = "refunded"
    STATUS_PARTIALLY_REFUNDED = "partially_refunded"
    STATUS_CANCELLED = "cancelled"
    STATUS_PROCESSING = "processing"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
        (STATUS_REFUNDED, "Refunded"),
        (STATUS_PARTIALLY_REFUNDED, "Partially Refunded"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_PROCESSING, "Processing"),
    ]

    METHOD_CARD = "card"
    METHOD_BANK_TRANSFER = "bank_transfer"
    METHOD_DIGITAL_WALLET = "digital_wallet"

    PAYMENT_METHOD_CHOICES = [
        (METHOD_CARD, "Debit/Credit Card"),
        (METHOD_BANK_TRANSFER, "Bank Transfer"),
        (METHOD_DIGITAL_WALLET, "Digital Wallet"),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="payments")
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default=METHOD_CARD)

    # New: store the merchant reference used during initialize
    reference = models.CharField(max_length=100, blank=True, null=True, unique=True)

    # Paystack transaction id or provider-side payment id
    provider_payment_id = models.CharField(max_length=255, blank=True, null=True, unique=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    currency = models.CharField(max_length=3, default="NGN")
    fee_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        default=Decimal("0.00"),
    )
    net_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    payment_details = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "payments"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.reference:
            order_id = self.order_id or "X"
            self.reference = f"PAY-{order_id}-{uuid.uuid4().hex[:12].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Payment #{self.id} for Order #{self.order.order_number}"


class Refund(models.Model):
    STATUS_REQUESTED = "requested"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_PROCESSED = "processed"

    STATUS_CHOICES = [
        (STATUS_REQUESTED, "Requested"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_PROCESSED, "Processed"),
    ]

    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="refunds")
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="refunds")
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    reason = models.JSONField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_REQUESTED)
    provider_refund_id = models.CharField(max_length=255, blank=True, null=True)
    processed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="processed_refunds",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "refunds"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Refund #{self.id} for Payment #{self.payment.id}"


class Payout(models.Model):
    STATUS_PENDING = "pending"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_PROCESSING = "processing"
    STATUS_CANCELLED = "cancelled"
    STATUS_PROCESSED = "processed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_PROCESSED, "Processed"),
    ]

    seller = models.ForeignKey(SellerProfile, on_delete=models.CASCADE, related_name="payouts")
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    provider_payout_id = models.CharField(max_length=255, blank=True, null=True)
    processed_at = models.DateTimeField(blank=True, null=True)
    currency = models.CharField(max_length=3, default="NGN")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    payment_details = models.JSONField(blank=True, null=True)
    payment_method = models.CharField(
        max_length=20,
        choices=Payment.PAYMENT_METHOD_CHOICES,
        default=Payment.METHOD_BANK_TRANSFER,
    )

    class Meta:
        db_table = "payouts"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Payout #{self.id} for Seller #{self.seller.id}"


class Transaction(models.Model):
    TYPE_REFUND = "refund"
    TYPE_PAYOUT = "payout"
    TYPE_SALE = "sale"
    TYPE_FEE = "fee"

    TYPE_CHOICES = [
        (TYPE_REFUND, "Refund"),
        (TYPE_PAYOUT, "Payout"),
        (TYPE_SALE, "Sale"),
        (TYPE_FEE, "Fee"),
    ]

    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name="transactions",
        blank=True,
        null=True,
    )
    payout = models.ForeignKey(
        Payout,
        on_delete=models.CASCADE,
        related_name="transactions",
        blank=True,
        null=True,
    )
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_SALE)
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    currency = models.CharField(max_length=3, default="NGN")
    payment_method = models.CharField(
        max_length=20,
        choices=Payment.PAYMENT_METHOD_CHOICES,
        default=Payment.METHOD_CARD,
    )
    metadata = models.JSONField(blank=True, null=True)
    description = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "transactions"
        ordering = ["-created_at"]

    def __str__(self):
        if self.payment:
            return f"Transaction #{self.id} for Payment #{self.payment.id}"
        if self.payout:
            return f"Transaction #{self.id} for Payout #{self.payout.id}"
        return f"Transaction #{self.id}"
