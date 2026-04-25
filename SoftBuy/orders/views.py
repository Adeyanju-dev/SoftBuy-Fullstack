from decimal import Decimal

from django.db import transaction
from django.db.models import Prefetch
from rest_framework import generics, permissions, status, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from .models import (
    Order,
    OrderItem,
    Cart,
    CartItem,
    ShippingMethod,
    OrderShipping,
)
from .serializers import (
    OrderSerializer,
    CartSerializer,
    ShippingMethodSerializer,
    OrderShippingSerializer,
)
from notifications.utils import create_notification
from products.models import Product, ProductVariant


class AddToCartRequestSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    variant_id = serializers.IntegerField(required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1, default=1)


class UpdateCartItemRequestSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)


class CreateOrderRequestSerializer(serializers.Serializer):
    shipping_address = serializers.CharField(required=False, allow_blank=True)
    billing_address = serializers.CharField(required=False, allow_blank=True)
    customer_note = serializers.CharField(required=False, allow_blank=True)
    currency = serializers.CharField(required=False, max_length=3, default="NGN")
    tax_amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        min_value=Decimal("0.00"),
    )
    shipping_amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        min_value=Decimal("0.00"),
    )
    discount_amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        min_value=Decimal("0.00"),
    )


class UpdateOrderShippingRequestSerializer(serializers.Serializer):
    shipping_method_id = serializers.IntegerField()


class MessageResponseSerializer(serializers.Serializer):
    message = serializers.CharField()


class OrdersErrorResponseSerializer(serializers.Serializer):
    error = serializers.CharField()


class OrderCreateResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    order = OrderSerializer()


def get_available_stock(product, variant=None):
    if variant is not None:
        return variant.stock
    return product.stock


def get_item_unit_price(product, variant=None):
    if variant is not None:
        return variant.price
    return product.price


class CartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses={200: CartSerializer},
        tags=["Cart"],
        summary="Get current user's cart",
    )
    def get(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        serializer = CartSerializer(cart)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        request=AddToCartRequestSerializer,
        responses={
            200: CartSerializer,
            400: OrdersErrorResponseSerializer,
        },
        tags=["Cart"],
        summary="Add item to cart",
    )
    def post(self, request):
        serializer = AddToCartRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        product_id = serializer.validated_data["product_id"]
        variant_id = serializer.validated_data.get("variant_id")
        quantity = serializer.validated_data["quantity"]

        product = Product.objects.filter(
            id=product_id,
            status=Product.STATUS_PUBLISHED,
        ).first()
        if not product:
            return Response(
                {"error": "The selected product is invalid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        variant = None
        if variant_id is not None:
            variant = ProductVariant.objects.filter(
                id=variant_id,
                product=product,
            ).first()
            if not variant:
                return Response(
                    {"error": "The selected variant does not belong to this product."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        cart, _ = Cart.objects.get_or_create(user=user)

        unit_price = get_item_unit_price(product, variant)

        cart_item = CartItem.objects.filter(
            cart=cart,
            product=product,
            variant=variant,
        ).first()

        current_quantity = cart_item.quantity if cart_item else 0
        new_quantity = current_quantity + quantity

        available_stock = get_available_stock(product, variant)
        if new_quantity > available_stock:
            return Response(
                {"error": f"Only {available_stock} item(s) available in stock."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cart_item:
            cart_item.quantity = new_quantity
            cart_item.price = cart_item.unit_price
            cart_item.total_price = cart_item.quantity * cart_item.unit_price
            cart_item.save(update_fields=["quantity", "price", "total_price", "updated_at"])
        else:
            cart_item = CartItem.objects.create(
                cart=cart,
                product=product,
                variant=variant,
                quantity=new_quantity,
                price=unit_price,
                total_price=unit_price * new_quantity,
            )

        return Response(CartSerializer(cart).data, status=status.HTTP_200_OK)


class CartItemUpdateDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=UpdateCartItemRequestSerializer,
        responses={
            200: CartSerializer,
            400: OrdersErrorResponseSerializer,
            404: OrdersErrorResponseSerializer,
        },
        tags=["Cart"],
        summary="Update cart item quantity",
    )
    def put(self, request, pk):
        cart_item = (
            CartItem.objects.select_related("product", "variant", "cart")
            .filter(id=pk, cart__user=request.user)
            .first()
        )
        if not cart_item:
            return Response(
                {"error": "Cart item not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = UpdateCartItemRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        qty = serializer.validated_data["quantity"]
        available_stock = get_available_stock(cart_item.product, cart_item.variant)

        if qty > available_stock:
            return Response(
                {"error": f"Only {available_stock} item(s) available in stock."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart_item.quantity = qty
        cart_item.price = cart_item.unit_price
        cart_item.total_price = qty * cart_item.unit_price
        cart_item.save(update_fields=["quantity", "price", "total_price", "updated_at"])

        return Response(CartSerializer(cart_item.cart).data, status=status.HTTP_200_OK)

    @extend_schema(
        responses={
            200: CartSerializer,
            404: OrdersErrorResponseSerializer,
        },
        tags=["Cart"],
        summary="Remove item from cart",
    )
    def delete(self, request, pk):
        cart_item = CartItem.objects.filter(id=pk, cart__user=request.user).first()
        if not cart_item:
            return Response(
                {"error": "Cart item not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        cart = cart_item.cart
        cart_item.delete()
        return Response(CartSerializer(cart).data, status=status.HTTP_200_OK)


class CreateOrderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=CreateOrderRequestSerializer,
        responses={
            201: OrderCreateResponseSerializer,
            400: OrdersErrorResponseSerializer,
        },
        tags=["Orders"],
        summary="Create order from cart",
    )
    def post(self, request):
        user = request.user

        cart = (
            Cart.objects.prefetch_related(
                Prefetch(
                    "items",
                    queryset=CartItem.objects.select_related("product", "variant"),
                )
            )
            .filter(user=user)
            .first()
        )

        if not cart or not cart.items.exists():
            return Response(
                {"error": "Your cart is empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CreateOrderRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        tax_amount = data.get("tax_amount", Decimal("0.00"))
        shipping_amount = data.get("shipping_amount", Decimal("0.00"))
        discount_amount = data.get("discount_amount", Decimal("0.00"))
        currency = data.get("currency", "NGN")
        shipping_address = data.get("shipping_address", "")
        billing_address = data.get("billing_address", "")
        customer_note = data.get("customer_note", "")

        with transaction.atomic():
            # Lock cart items only. Do not join nullable variant with FOR UPDATE.
            cart_items = list(
                CartItem.objects.select_related("product")
                .select_for_update()
                .filter(cart=cart)
            )

            if not cart_items:
                return Response(
                    {"error": "Your cart is empty."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            variant_ids = [item.variant_id for item in cart_items if item.variant_id]
            product_ids = list({item.product_id for item in cart_items})

            locked_products = {
                product.id: product
                for product in Product.objects.select_for_update().filter(id__in=product_ids)
            }

            locked_variants = {
                variant.id: variant
                for variant in ProductVariant.objects.select_for_update().filter(id__in=variant_ids)
            }

            subtotal = Decimal("0.00")

            for item in cart_items:
                locked_product = locked_products.get(item.product_id)
                locked_variant = locked_variants.get(item.variant_id) if item.variant_id else None

                if not locked_product:
                    return Response(
                        {"error": "A product in your cart no longer exists."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if item.variant_id and not locked_variant:
                    return Response(
                        {"error": f"Variant for {locked_product.title} no longer exists."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                available_stock = get_available_stock(locked_product, locked_variant)
                if item.quantity > available_stock:
                    name = locked_variant.sku if locked_variant else locked_product.title
                    return Response(
                        {"error": f"Insufficient stock for {name}. Only {available_stock} left."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                unit_price = get_item_unit_price(locked_product, locked_variant)
                subtotal += unit_price * item.quantity

            total_amount = subtotal + tax_amount + shipping_amount - discount_amount
            if total_amount < Decimal("0.00"):
                total_amount = Decimal("0.00")

            order = Order.objects.create(
                buyer=request.user,
                subtotal_amount=subtotal,
                shipping_amount=shipping_amount,
                tax_amount=tax_amount,
                discount_amount=discount_amount,
                total_amount=total_amount,
                currency=currency,
                shipping_address=shipping_address,
                billing_address=billing_address,
                customer_note=customer_note,
            )

            for item in cart_items:
                locked_product = locked_products[item.product_id]
                locked_variant = locked_variants.get(item.variant_id) if item.variant_id else None
                unit_price = get_item_unit_price(locked_product, locked_variant)

                if locked_variant:
                    locked_variant.stock -= item.quantity
                    locked_variant.save(update_fields=["stock"])
                else:
                    locked_product.stock -= item.quantity
                    locked_product.save(update_fields=["stock"])

                OrderItem.objects.create(
                    order=order,
                    product=locked_product,
                    variant=locked_variant,
                    quantity=item.quantity,
                    price=unit_price,
                    total_amount=item.quantity * unit_price,
                    product_name=locked_product.title,
                    product_sku=locked_variant.sku if locked_variant else locked_product.sku,
                    attributes=locked_variant.attributes if locked_variant else locked_product.attributes,
                )

            CartItem.objects.filter(cart=cart).delete()

        create_notification(
            recipient=user,
            title="Order created",
            message=f"Your order {order.order_number} was created successfully and is awaiting payment.",
            notification_type="order",
            data={"order_number": order.order_number, "order_id": order.id},
        )

        seller_profiles = {
            item.product.seller_id: item.product.seller
            for item in order.items.select_related("product__seller__user")
        }

        for seller_profile in seller_profiles.values():
            create_notification(
                recipient=seller_profile.user,
                title="New order received",
                message=f"A new order ({order.order_number}) includes one or more of your products.",
                notification_type="order",
                data={"order_number": order.order_number, "order_id": order.id},
            )

        return Response(
            {
                "message": "Order created successfully.",
                "order": OrderSerializer(order).data,
            },
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Orders"], summary="List current user's orders")
class UserOrdersListView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects.filter(buyer=self.request.user)
            .prefetch_related("items", "items__product", "items__variant", "payments")
            .select_related("shipping_info")
        )


@extend_schema(tags=["Orders"], summary="Retrieve a single order")
class OrderDetailView(generics.RetrieveAPIView):
    serializer_class = OrderSerializer
    lookup_field = "order_number"
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects.filter(buyer=self.request.user)
            .prefetch_related("items", "items__product", "items__variant", "payments")
            .select_related("shipping_info")
        )


@extend_schema(tags=["Orders"], summary="List active shipping methods")
class ShippingMethodListView(generics.ListAPIView):
    queryset = ShippingMethod.objects.filter(is_active=True).order_by("id")
    serializer_class = ShippingMethodSerializer
    permission_classes = [permissions.AllowAny]


class UpdateOrderShippingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=UpdateOrderShippingRequestSerializer,
        responses={
            200: OrderShippingSerializer,
            400: OrdersErrorResponseSerializer,
            404: OrdersErrorResponseSerializer,
        },
        tags=["Orders"],
        summary="Update order shipping method",
    )
    def post(self, request, order_number):
        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .filter(
                    order_number=order_number,
                    buyer=request.user,
                )
                .first()
            )
            if not order:
                return Response(
                    {"error": "Order not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            serializer = UpdateOrderShippingRequestSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            method_id = serializer.validated_data["shipping_method_id"]
            method = ShippingMethod.objects.filter(id=method_id, is_active=True).first()

            if not method:
                return Response(
                    {"error": "The selected shipping method was not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            shipping_info, _ = OrderShipping.objects.update_or_create(
                order=order,
                defaults={"shipping_method": method},
            )

            order.shipping_amount = method.price
            order.total_amount = (
                order.subtotal_amount
                + order.tax_amount
                + order.shipping_amount
                - order.discount_amount
            )
            if order.total_amount < Decimal("0.00"):
                order.total_amount = Decimal("0.00")
            order.save(update_fields=["shipping_amount", "total_amount", "updated_at"])

        return Response(
            OrderShippingSerializer(shipping_info).data,
            status=status.HTTP_200_OK,
        )
