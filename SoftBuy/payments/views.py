import uuid
from decimal import Decimal

import requests
from django.conf import settings
from django.db import models, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import OpenApiParameter, extend_schema

from orders.models import Order
from orders.serializers import OrderSerializer
from notifications.utils import create_notification
from .models import Payment, Refund, Payout, Transaction
from .serializers import (
    PaymentSerializer,
    RefundSerializer,
    PayoutSerializer,
    TransactionSerializer,
    PaystackInitializeSerializer,
)


class IsBuyerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        if hasattr(obj, "order") and obj.order:
            return obj.order.buyer == request.user
        return False


class IsSellerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_staff:
            return True
        return getattr(user, "seller_profile", None) is not None

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        seller_profile = getattr(request.user, "seller_profile", None)
        return seller_profile is not None and obj.seller == seller_profile


class PaymentListCreateView(generics.ListCreateAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Payment.objects.select_related("order", "order__buyer")
        if user.is_staff:
            return qs.all()
        return qs.filter(order__buyer=user)

    def perform_create(self, serializer):
        order_id = self.request.data.get("order")
        order_number = self.request.data.get("order_number")

        if order_id:
            order = get_object_or_404(Order, id=order_id)
        elif order_number:
            order = get_object_or_404(Order, order_number=order_number)
        else:
            raise ValidationError({"order": "Either order or order_number is required."})

        if not (self.request.user.is_staff or order.buyer == self.request.user):
            raise PermissionDenied("You do not have permission to create a payment for this order.")

        if order.status != Order.STATUS_PENDING_PAYMENT:
            raise ValidationError({"order": "Only orders awaiting payment can receive a new payment."})

        if Payment.objects.filter(order=order, status__in=["pending", "processing", "completed"]).exists():
            raise ValidationError({"order": "A pending, processing, or completed payment already exists for this order."})

        amount = serializer.validated_data.get("amount")
        if amount != order.total_amount:
            raise ValidationError({"amount": "Payment amount must match the order total amount."})

        serializer.save(
            order=order,
            fee_amount=Decimal("0.00"),
            net_amount=amount,
            status=Payment.STATUS_PENDING,
        )


class PaymentDetailView(generics.RetrieveUpdateAPIView):
    queryset = Payment.objects.select_related("order", "order__buyer").all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsBuyerOrAdmin]

    def update(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return Response({"detail": "Only staff members can modify payments."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class RefundListCreateView(generics.ListCreateAPIView):
    serializer_class = RefundSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Refund.objects.select_related("payment", "order", "processed_by")
        if user.is_staff:
            return qs.all()
        return qs.filter(order__buyer=user)

    def perform_create(self, serializer):
        payment_id = self.request.data.get("payment")
        if not payment_id:
            raise ValidationError({"payment": "A payment ID is required."})

        payment = get_object_or_404(Payment, id=payment_id)
        order = payment.order

        if order.buyer != self.request.user:
            raise PermissionDenied("You can only request refunds for your own orders.")

        if payment.status not in [Payment.STATUS_COMPLETED, Payment.STATUS_PARTIALLY_REFUNDED]:
            raise ValidationError({"payment": "Refund can only be requested for completed or partially refunded payments."})

        amount = serializer.validated_data.get("amount")

        already_refunded = payment.refunds.filter(status="processed").aggregate(
            total=models.Sum("amount")
        )["total"] or Decimal("0.00")

        remaining_refundable = payment.amount - already_refunded
        if amount > remaining_refundable:
            raise ValidationError({
                "amount": f"Refund amount cannot exceed remaining refundable amount of {remaining_refundable}."
            })

        refund = serializer.save(payment=payment, order=order, status="requested")
        create_notification(
            recipient=self.request.user,
            title="Refund requested",
            message=f"Your refund request for order {order.order_number} has been submitted.",
            notification_type="payment",
            data={"refund_id": refund.id, "order_number": order.order_number},
        )


class RefundDetailView(generics.RetrieveUpdateAPIView):
    queryset = Refund.objects.select_related("payment", "order", "processed_by").all()
    serializer_class = RefundSerializer
    permission_classes = [permissions.IsAuthenticated, IsBuyerOrAdmin]

    def update(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return Response({"detail": "Only staff members can modify refund status."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        instance = self.get_object()
        old_status = instance.status

        refund = serializer.save(
            processed_by=self.request.user if serializer.validated_data.get("status") in ["approved", "processed", "rejected"] else instance.processed_by,
            processed_at=timezone.now() if serializer.validated_data.get("status") == "processed" else instance.processed_at,
        )

        # Guard against re-processing the same refund
        if old_status == "processed":
            return

        if refund.status == "processed":
            payment = refund.payment

            total_processed_refunds = payment.refunds.filter(status="processed").aggregate(
                total=models.Sum("amount")
            )["total"] or Decimal("0.00")

            if total_processed_refunds >= payment.amount:
                payment.status = Payment.STATUS_REFUNDED
                refund.order.status = Order.STATUS_REFUNDED
                refund.order.save(update_fields=["status"])
            else:
                payment.status = Payment.STATUS_PARTIALLY_REFUNDED

            payment.save(update_fields=["status", "updated_at"])

            Transaction.objects.get_or_create(
                payment=payment,
                transaction_type=Transaction.TYPE_REFUND,
                amount=refund.amount,
                currency=payment.currency,
                defaults={
                    "payment_method": payment.payment_method,
                    "metadata": {"refund_id": refund.id, "reason": refund.reason},
                    "description": f"Refund for Order {refund.order.order_number}",
                },
            )

            create_notification(
                recipient=refund.order.buyer,
                title="Refund processed",
                message=f"Your refund for order {refund.order.order_number} has been processed.",
                notification_type="payment",
                data={"refund_id": refund.id, "order_number": refund.order.order_number},
            )


class PayoutListCreateView(generics.ListCreateAPIView):
    serializer_class = PayoutSerializer
    permission_classes = [permissions.IsAuthenticated, IsSellerOrAdmin]

    def get_queryset(self):
        user = self.request.user
        qs = Payout.objects.select_related("seller", "seller__user")
        if user.is_staff:
            return qs.all()

        seller_profile = getattr(user, "seller_profile", None)
        if not seller_profile:
            return Payout.objects.none()

        return qs.filter(seller=seller_profile)

    def perform_create(self, serializer):
        user = self.request.user
        seller_profile = getattr(user, "seller_profile", None)

        if not seller_profile and not user.is_staff:
            raise PermissionDenied("Only sellers can request payouts.")

        if not seller_profile:
            raise PermissionDenied("Seller profile was not found.")

        payout = serializer.save(seller=seller_profile, status="pending")
        create_notification(
            recipient=seller_profile.user,
            title="Payout requested",
            message="Your payout request has been submitted and is awaiting review.",
            notification_type="payment",
            data={"payout_id": payout.id},
        )


class PayoutDetailView(generics.RetrieveUpdateAPIView):
    queryset = Payout.objects.select_related("seller", "seller__user").all()
    serializer_class = PayoutSerializer
    permission_classes = [permissions.IsAuthenticated, IsSellerOrAdmin]

    def update(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return Response({"detail": "Only staff members can modify payout status."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        payout = serializer.save(
            processed_at=timezone.now() if serializer.validated_data.get("status") in ["processed", "completed"] else serializer.instance.processed_at
        )

        if payout.status in ["processed", "completed"]:
            Transaction.objects.get_or_create(
                payout=payout,
                transaction_type=Transaction.TYPE_PAYOUT,
                defaults={
                    "payment": None,
                    "amount": payout.amount,
                    "currency": payout.currency,
                    "payment_method": payout.payment_method,
                    "metadata": payout.payment_details,
                    "description": f"Payout to seller {payout.seller.business_name}",
                },
            )

            create_notification(
                recipient=payout.seller.user,
                title="Payout updated",
                message=f"Your payout request is now marked as {payout.status}.",
                notification_type="payment",
                data={"payout_id": payout.id, "status": payout.status},
            )


class TransactionListView(generics.ListAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Transaction.objects.select_related(
            "payment",
            "payment__order",
            "payment__order__buyer",
            "payout",
            "payout__seller",
            "payout__seller__user",
        )

        if user.is_staff:
            return queryset.all()

        seller_profile = getattr(user, "seller_profile", None)
        if seller_profile:
            return queryset.filter(
                models.Q(payout__seller=seller_profile) |
                models.Q(payment__order__items__product__seller=seller_profile)
            ).distinct()

        return queryset.filter(payment__order__buyer=user).distinct()


class PaystackInitializeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=PaystackInitializeSerializer, responses={200: dict})
    def post(self, request):
        order_id = request.data.get("order_id")
        if not order_id:
            raise ValidationError({"order_id": "order_id is required."})

        order = get_object_or_404(Order, id=order_id)

        if order.buyer != request.user:
            return Response({"detail": "You do not have permission to initialize payment for this order."}, status=status.HTTP_403_FORBIDDEN)

        if order.status != Order.STATUS_PENDING_PAYMENT:
            return Response(
                {"detail": "Only orders awaiting payment can be initialized."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Payment.objects.filter(order=order, status=Payment.STATUS_COMPLETED).exists():
            return Response(
                {"detail": "A completed payment already exists for this order."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # reuse existing pending payment if present
        pending_payment = Payment.objects.filter(
            order=order,
            status__in=[Payment.STATUS_PENDING, Payment.STATUS_PROCESSING],
        ).first()

        if pending_payment and not pending_payment.reference:
            pending_payment.save(update_fields=["reference", "updated_at"])

        reference = pending_payment.reference if pending_payment and pending_payment.reference else f"ORDER-{order.id}-{uuid.uuid4().hex[:10]}"
        amount = int(order.total_amount * 100)

        headers = {
            "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "email": request.user.email,
            "amount": amount,
            "reference": reference,
            "callback_url": settings.PAYSTACK_CALLBACK_URL,
        }
        url = f"{settings.PAYSTACK_BASE_URL}/transaction/initialize"

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            res = response.json()
        except requests.exceptions.RequestException as exc:
            return Response(
                {"detail": f"Paystack initialization failed: {str(exc)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if pending_payment:
            payment = pending_payment
            payment.reference = reference
            payment.payment_method = Payment.METHOD_CARD
            payment.status = Payment.STATUS_PENDING
            payment.amount = order.total_amount
            payment.currency = order.currency
            payment.fee_amount = Decimal("0.00")
            payment.net_amount = order.total_amount
            payment.payment_details = res
            payment.save(
                update_fields=[
                    "reference",
                    "payment_method",
                    "status",
                    "amount",
                    "currency",
                    "fee_amount",
                    "net_amount",
                    "payment_details",
                    "updated_at",
                ]
            )
        else:
            Payment.objects.create(
                order=order,
                reference=reference,
                payment_method=Payment.METHOD_CARD,
                status=Payment.STATUS_PENDING,
                amount=order.total_amount,
                currency=order.currency,
                fee_amount=Decimal("0.00"),
                net_amount=order.total_amount,
                payment_details=res,
            )

        return Response(res, status=status.HTTP_200_OK)


class PaystackVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="reference",
                description="Paystack payment reference",
                required=True,
                type=str,
                location=OpenApiParameter.QUERY,
            )
        ],
        responses={200: dict},
    )
    def get(self, request):
        reference = request.GET.get("reference")
        if not reference:
            raise ValidationError({"reference": "reference is required."})

        headers = {
            "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
        }

        url = f"{settings.PAYSTACK_BASE_URL}/transaction/verify/{reference}"

        try:
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            res = response.json()
        except requests.exceptions.RequestException as exc:
            return Response(
                {"detail": f"Paystack verification failed: {str(exc)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if not res.get("status"):
            return Response(res, status=status.HTTP_400_BAD_REQUEST)

        data = res.get("data", {})
        if data.get("status") != "success":
            return Response(
                {"detail": "Payment is not successful."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reference_value = data.get("reference")
        if not reference_value or reference_value != reference:
            return Response(
                {"detail": "Reference mismatch during payment verification."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            payment = (
                Payment.objects.select_for_update()
                .select_related("order")
                .filter(reference=reference_value)
                .first()
            )
            if not payment:
                return Response(
                    {"detail": "Payment record not found for this reference."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            order = payment.order
            paystack_amount = Decimal(str(data.get("amount", 0))) / Decimal("100")
            paystack_currency = str(data.get("currency", "")).upper()

            if paystack_amount != payment.amount or paystack_amount != order.total_amount:
                return Response(
                    {"detail": "Paystack amount does not match the expected payment amount."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            expected_currency = (payment.currency or order.currency or "").upper()
            if paystack_currency != expected_currency:
                return Response(
                    {"detail": "Paystack currency does not match the expected payment currency."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if payment.status == Payment.STATUS_COMPLETED:
                Transaction.objects.get_or_create(
                    payment=payment,
                    transaction_type=Transaction.TYPE_SALE,
                    amount=payment.amount,
                    currency=payment.currency,
                    defaults={
                        "payment_method": payment.payment_method,
                        "metadata": data,
                        "description": f"Payment for Order {order.order_number}",
                    },
                )

                if order.status != Order.STATUS_PAID:
                    order.status = Order.STATUS_PAID
                    order.save(update_fields=["status"])

                return Response(
                    {
                        "message": "Payment already verified.",
                        "reference": payment.reference,
                        "payment_status": payment.status,
                        "payment_method": payment.payment_method,
                        "order": OrderSerializer(order).data,
                        "payment": PaymentSerializer(payment).data,
                        "order_id": order.id,
                        "payment_id": payment.id,
                    },
                    status=status.HTTP_200_OK,
                )

            payment.provider_payment_id = str(data.get("id")) if data.get("id") is not None else payment.provider_payment_id
            payment.status = Payment.STATUS_COMPLETED
            payment.currency = paystack_currency
            payment.payment_details = data
            if not payment.paid_at:
                payment.paid_at = timezone.now()
            payment.save(
                update_fields=[
                    "provider_payment_id",
                    "status",
                    "currency",
                    "payment_details",
                    "paid_at",
                    "updated_at",
                ]
            )

            Transaction.objects.get_or_create(
                payment=payment,
                transaction_type=Transaction.TYPE_SALE,
                amount=payment.amount,
                currency=payment.currency,
                defaults={
                    "payment_method": payment.payment_method,
                    "metadata": data,
                    "description": f"Payment for Order {order.order_number}",
                },
            )

            if order.status != Order.STATUS_PAID:
                order.status = Order.STATUS_PAID
                order.save(update_fields=["status"])

            create_notification(
                recipient=order.buyer,
                title="Payment successful",
                message=f"Your payment for order {order.order_number} was verified successfully.",
                notification_type="payment",
                data={"order_number": order.order_number, "payment_id": payment.id},
            )

            seller_profiles = {
                item.product.seller_id: item.product.seller
                for item in order.items.select_related("product__seller__user")
            }

            for seller_profile in seller_profiles.values():
                create_notification(
                    recipient=seller_profile.user,
                    title="Order paid",
                    message=f"Order {order.order_number} containing your product(s) has been paid.",
                    notification_type="payment",
                    data={"order_number": order.order_number, "payment_id": payment.id},
                )

        return Response(
            {
                "message": "Payment verified successfully.",
                "reference": payment.reference,
                "payment_status": payment.status,
                "payment_method": payment.payment_method,
                "order": OrderSerializer(order).data,
                "payment": PaymentSerializer(payment).data,
                "order_id": order.id,
                "payment_id": payment.id,
            },
            status=status.HTTP_200_OK,
        )
