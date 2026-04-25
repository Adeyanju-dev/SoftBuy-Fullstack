from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from .models import Order, OrderItem, Cart, CartItem, OrderShipping, ShippingMethod


class OrderItemSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source="product.title", read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True)
    product_image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = "__all__"
        read_only_fields = ("order", "product_name", "product_sku", "price", "total_amount", "created_at")

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_product_image(self, obj):
        primary_image = obj.product.images.filter(is_primary=True).first()
        if primary_image and getattr(primary_image.image, "url", None):
            return primary_image.image.url

        first_image = obj.product.images.first()
        if first_image and getattr(first_image.image, "url", None):
            return first_image.image.url

        return None


class OrderShippingSerializer(serializers.ModelSerializer):
    shipping_method_name = serializers.CharField(source="shipping_method.name", read_only=True)
    order_number = serializers.CharField(source="order.order_number", read_only=True)

    class Meta:
        model = OrderShipping
        fields = "__all__"


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    buyer_email = serializers.EmailField(source="buyer.email", read_only=True)
    shipping_info = serializers.SerializerMethodField()
    payment_reference = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = "__all__"
        read_only_fields = ("order_number", "buyer", "created_at", "updated_at")

    @extend_schema_field(OrderShippingSerializer(allow_null=True))
    def get_shipping_info(self, obj):
        shipping_info = getattr(obj, "shipping_info", None)
        if shipping_info:
            return OrderShippingSerializer(shipping_info).data
        return None

    def _get_latest_payment(self, obj):
        prefetched = getattr(obj, "_prefetched_objects_cache", {}).get("payments")
        if prefetched is not None:
            ordered = sorted(
                prefetched,
                key=lambda payment: (
                    getattr(payment, "created_at", None) is None,
                    getattr(payment, "created_at", None),
                    getattr(payment, "id", 0),
                ),
                reverse=True,
            )
            return ordered[0] if ordered else None

        return obj.payments.order_by("-created_at", "-id").first()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_payment_reference(self, obj):
        payment = self._get_latest_payment(obj)
        return getattr(payment, "reference", None)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_payment_status(self, obj):
        payment = self._get_latest_payment(obj)
        return getattr(payment, "status", None)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_payment_method(self, obj):
        payment = self._get_latest_payment(obj)
        return getattr(payment, "payment_method", None)


class CartItemSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source="product.title", read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True)
    product_image = serializers.SerializerMethodField()
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = CartItem
        fields = "__all__"
        read_only_fields = ("cart", "created_at", "updated_at", "price", "total_price")

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_product_image(self, obj):
        primary_image = obj.product.images.filter(is_primary=True).first()
        if primary_image and getattr(primary_image.image, "url", None):
            return primary_image.image.url

        first_image = obj.product.images.first()
        if first_image and getattr(first_image.image, "url", None):
            return first_image.image.url

        return None


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_items = serializers.IntegerField(read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Cart
        fields = "__all__"
        read_only_fields = ("user", "created_at", "updated_at")


class ShippingMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingMethod
        fields = "__all__"
