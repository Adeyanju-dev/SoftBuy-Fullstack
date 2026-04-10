from django.urls import path
from .views import (
    PaymentListCreateView,
    PaymentDetailView,
    RefundListCreateView,
    RefundDetailView,
    PayoutListCreateView,
    PayoutDetailView,
    TransactionListView,
    PaystackInitializeView,
    PaystackVerifyView,
)

app_name = "payments"

urlpatterns = [
    path("", PaymentListCreateView.as_view(), name="payment-list-create"),
    path("<int:pk>/", PaymentDetailView.as_view(), name="payment-detail"),

    path("refunds/", RefundListCreateView.as_view(), name="refund-list-create"),
    path("refunds/<int:pk>/", RefundDetailView.as_view(), name="refund-detail"),

    path("payouts/", PayoutListCreateView.as_view(), name="payout-list-create"),
    path("payouts/<int:pk>/", PayoutDetailView.as_view(), name="payout-detail"),

    path("transactions/", TransactionListView.as_view(), name="transaction-list"),

    path("paystack/initialize/", PaystackInitializeView.as_view(), name="paystack-init"),
    path("paystack/verify/", PaystackVerifyView.as_view(), name="paystack-verify"),
]