from django.contrib import admin
from .models import Payment, Refund, Payout, Transaction


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "order",
        "payment_method",
        "status",
        "amount",
        "currency",
        "fee_amount",
        "net_amount",
        "created_at",
        "updated_at",
        "paid_at",
    )
    list_filter = ("status", "payment_method", "created_at", "updated_at")
    search_fields = ("order__order_number", "provider_payment_id")
    readonly_fields = ("created_at", "updated_at", "paid_at")


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "order",
        "payment",
        "amount",
        "status",
        "created_at",
        "updated_at",
        "processed_at",
    )
    list_filter = ("status", "created_at", "updated_at")
    search_fields = ("order__order_number", "payment__provider_payment_id")
    readonly_fields = ("created_at", "updated_at", "processed_at")


@admin.register(Payout)
class PayoutAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "seller",
        "amount",
        "status",
        "currency",
        "created_at",
        "updated_at",
        "processed_at",
    )
    list_filter = ("status", "created_at", "updated_at")
    search_fields = ("seller__business_name", "seller__user__username", "seller__user__email")
    readonly_fields = ("created_at", "updated_at", "processed_at")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "payment",
        "payout",
        "transaction_type",
        "amount",
        "currency",
        "payment_method",
        "created_at",
        "updated_at",
    )
    list_filter = ("transaction_type", "payment_method", "created_at", "updated_at")
    search_fields = ("payment__order__order_number", "payout__seller__business_name")
    readonly_fields = ("created_at", "updated_at")