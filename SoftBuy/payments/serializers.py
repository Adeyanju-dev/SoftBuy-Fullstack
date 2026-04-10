from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from .models import Payment, Refund, Payout, Transaction


class PaymentSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    buyer_email = serializers.EmailField(source="order.buyer.email", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "order",
            "order_number",
            "buyer_email",
            "payment_method",
            "provider_payment_id",
            "status",
            "amount",
            "currency",
            "fee_amount",
            "net_amount",
            "payment_details",
            "created_at",
            "updated_at",
            "paid_at",
        ]
        read_only_fields = (
            "order",
            "provider_payment_id",
            "fee_amount",
            "net_amount",
            "created_at",
            "updated_at",
            "paid_at",
        )

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        return value


class RefundSerializer(serializers.ModelSerializer):
    payment = serializers.PrimaryKeyRelatedField(
        queryset=Payment.objects.all(),
        write_only=True
    )
    order = serializers.PrimaryKeyRelatedField(read_only=True)
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    payment_details = PaymentSerializer(source="payment", read_only=True)
    processed_by_email = serializers.EmailField(source="processed_by.email", read_only=True)

    class Meta:
        model = Refund
        fields = [
            "id",
            "payment",
            "payment_details",
            "order",
            "order_number",
            "amount",
            "status",
            "reason",
            "provider_refund_id",
            "processed_by",
            "processed_by_email",
            "created_at",
            "updated_at",
            "processed_at",
        ]
        read_only_fields = (
            "order",
            "provider_refund_id",
            "processed_by",
            "created_at",
            "updated_at",
            "processed_at",
        )

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Refund amount must be greater than zero.")
        return value


class PayoutSerializer(serializers.ModelSerializer):
    seller_business_name = serializers.CharField(source="seller.business_name", read_only=True)
    seller_user_email = serializers.EmailField(source="seller.user.email", read_only=True)

    class Meta:
        model = Payout
        fields = [
            "id",
            "seller",
            "seller_business_name",
            "seller_user_email",
            "amount",
            "status",
            "provider_payout_id",
            "processed_at",
            "currency",
            "payment_details",
            "payment_method",
            "created_at",
            "updated_at",
        ]
        read_only_fields = (
            "seller",
            "provider_payout_id",
            "processed_at",
            "created_at",
            "updated_at",
        )

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Payout amount must be greater than zero.")
        return value


class TransactionSerializer(serializers.ModelSerializer):
    payment_order_number = serializers.SerializerMethodField()
    payout_seller_business_name = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            "id",
            "payment",
            "payment_order_number",
            "payout",
            "payout_seller_business_name",
            "transaction_type",
            "amount",
            "currency",
            "payment_method",
            "metadata",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ("created_at", "updated_at")

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_payment_order_number(self, obj):
        if obj.payment and obj.payment.order:
            return obj.payment.order.order_number
        return None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_payout_seller_business_name(self, obj):
        if obj.payout and obj.payout.seller:
            return obj.payout.seller.business_name
        return None

    def validate(self, attrs):
        transaction_type = attrs.get("transaction_type")
        payment = attrs.get("payment")
        payout = attrs.get("payout")

        if transaction_type in ["sale", "refund", "fee"] and not payment:
            raise serializers.ValidationError(
                {"payment": "This transaction type requires a payment."}
            )

        if transaction_type == "payout" and not payout:
            raise serializers.ValidationError(
                {"payout": "Payout transactions require a payout."}
            )

        return attrs


class PaystackInitializeSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
