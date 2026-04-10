from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from users.models import User, SellerProfile
from products.models import Category, Product, ProductVariant
from orders.models import Cart, CartItem, Order, ShippingMethod, OrderShipping


class OrderAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()

        self.buyer = User.objects.create_user(
            email="buyer@example.com",
            password="TestPass123!",
            is_buyer=True,
            is_seller=False,
        )

        self.other_buyer = User.objects.create_user(
            email="buyer2@example.com",
            password="TestPass123!",
            is_buyer=True,
            is_seller=False,
        )

        self.seller_user = User.objects.create_user(
            email="seller@example.com",
            password="TestPass123!",
            is_buyer=False,
            is_seller=True,
        )

        self.seller_profile = SellerProfile.objects.create(
            user=self.seller_user,
            business_name="Tech Store",
            verified=True,
        )

        self.category = Category.objects.create(
            name="Electronics",
            description="Electronic devices",
            is_active=True,
        )

        self.product = Product.objects.create(
            seller=self.seller_profile,
            category=self.category,
            title="Gaming Laptop",
            description="Good laptop",
            price=Decimal("500000.00"),
            compare_price=Decimal("550000.00"),
            currency="NGN",
            sku="LAP-001",
            stock=10,
            status=Product.STATUS_PUBLISHED,
        )

        self.variant = ProductVariant.objects.create(
            product=self.product,
            sku="LAP-001-16GB",
            attributes={"ram": "16GB"},
            stock=5,
            price=Decimal("520000.00"),
        )

        self.no_variant_product = Product.objects.create(
            seller=self.seller_profile,
            category=self.category,
            title="Phone",
            description="Smart phone",
            price=Decimal("200000.00"),
            currency="NGN",
            sku="PHN-001",
            stock=8,
            status=Product.STATUS_PUBLISHED,
        )

        self.other_product = Product.objects.create(
            seller=self.seller_profile,
            category=self.category,
            title="Tablet",
            description="Tablet",
            price=Decimal("300000.00"),
            currency="NGN",
            sku="TAB-001",
            stock=4,
            status=Product.STATUS_PUBLISHED,
        )

        self.other_variant = ProductVariant.objects.create(
            product=self.other_product,
            sku="TAB-001-BLACK",
            attributes={"color": "black"},
            stock=2,
            price=Decimal("310000.00"),
        )

        self.shipping_method = ShippingMethod.objects.create(
            name="Standard Delivery",
            description="3-5 business days",
            price=Decimal("5000.00"),
            is_active=True,
            estimated_days=5,
        )

        self.inactive_shipping_method = ShippingMethod.objects.create(
            name="Old Delivery",
            description="Inactive method",
            price=Decimal("3000.00"),
            is_active=False,
            estimated_days=7,
        )

        self.cart_url = reverse("cart")
        self.create_order_url = reverse("create-order")
        self.my_orders_url = reverse("my-orders")
        self.shipping_methods_url = reverse("shipping-methods")

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def create_cart_with_item(self, user=None, product=None, variant=None, quantity=2):
        user = user or self.buyer
        product = product or self.product
        variant = variant
        cart, _ = Cart.objects.get_or_create(user=user)

        unit_price = variant.price if variant else product.price

        item = CartItem.objects.create(
            cart=cart,
            product=product,
            variant=variant,
            quantity=quantity,
            price=unit_price,
            total_price=unit_price * quantity,
        )
        return cart, item

    def test_authenticated_user_can_get_cart(self):
        self.authenticate(self.buyer)
        response = self.client.get(self.cart_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_items"], 0)

    def test_user_can_add_valid_variant_item_to_cart(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.cart_url,
            {"product_id": self.product.id, "variant_id": self.variant.id, "quantity": 2},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Cart.objects.filter(user=self.buyer).exists())
        self.assertEqual(CartItem.objects.filter(cart__user=self.buyer).count(), 1)

        cart_item = CartItem.objects.get(cart__user=self.buyer)
        self.assertEqual(cart_item.quantity, 2)
        self.assertEqual(cart_item.price, self.variant.price)

    def test_user_can_add_product_without_variant_to_cart(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.cart_url,
            {"product_id": self.no_variant_product.id, "quantity": 2},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cart_item = CartItem.objects.get(cart__user=self.buyer, product=self.no_variant_product)
        self.assertIsNone(cart_item.variant)
        self.assertEqual(cart_item.price, self.no_variant_product.price)

    def test_invalid_product_is_rejected_when_adding_to_cart(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.cart_url,
            {"product_id": 999999, "variant_id": self.variant.id, "quantity": 1},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "The selected product is invalid.")

    def test_invalid_variant_for_product_is_rejected(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.cart_url,
            {"product_id": self.product.id, "variant_id": self.other_variant.id, "quantity": 1},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "The selected variant does not belong to this product.")

    def test_cannot_add_more_than_available_variant_stock_to_cart(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.cart_url,
            {"product_id": self.product.id, "variant_id": self.variant.id, "quantity": 10},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only 5 item(s) available in stock.", response.data["error"])
        self.assertFalse(
            CartItem.objects.filter(
                cart__user=self.buyer,
                product=self.product,
                variant=self.variant,
            ).exists()
        )

    def test_cannot_create_new_cart_item_above_product_stock(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.cart_url,
            {"product_id": self.no_variant_product.id, "quantity": 20},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only 8 item(s) available in stock.", response.data["error"])
        self.assertFalse(
            CartItem.objects.filter(
                cart__user=self.buyer,
                product=self.no_variant_product,
                variant__isnull=True,
            ).exists()
        )

    def test_cannot_update_cart_item_above_stock(self):
        self.authenticate(self.buyer)
        _, item = self.create_cart_with_item(user=self.buyer, product=self.product, variant=self.variant, quantity=2)

        url = reverse("cart-item", kwargs={"pk": item.pk})
        response = self.client.put(url, {"quantity": 20}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only 5 item(s) available in stock.", response.data["error"])

    def test_user_can_update_cart_item_quantity(self):
        self.authenticate(self.buyer)
        _, item = self.create_cart_with_item(user=self.buyer, product=self.product, variant=self.variant, quantity=2)

        url = reverse("cart-item", kwargs={"pk": item.pk})
        response = self.client.put(url, {"quantity": 4}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item.refresh_from_db()
        self.assertEqual(item.quantity, 4)

    def test_user_can_delete_cart_item(self):
        self.authenticate(self.buyer)
        _, item = self.create_cart_with_item(user=self.buyer, product=self.product, variant=self.variant)

        url = reverse("cart-item", kwargs={"pk": item.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(CartItem.objects.filter(pk=item.pk).exists())

    def test_cannot_create_order_from_empty_cart(self):
        self.authenticate(self.buyer)

        response = self.client.post(self.create_order_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Your cart is empty.")

    def test_user_can_create_order_from_cart_and_reduce_variant_stock(self):
        self.authenticate(self.buyer)
        self.create_cart_with_item(user=self.buyer, product=self.product, variant=self.variant, quantity=2)

        response = self.client.post(
            self.create_order_url,
            {
                "shipping_address": "8 Survey Road",
                "billing_address": "8 Survey Road",
                "customer_note": "Please deliver carefully",
                "currency": "NGN",
                "tax_amount": "1000.00",
                "shipping_amount": "5000.00",
                "discount_amount": "0.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["message"], "Order created successfully.")

        order = Order.objects.get(buyer=self.buyer)
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.shipping_address, "8 Survey Road")
        self.assertEqual(order.billing_address, "8 Survey Road")
        self.assertEqual(order.customer_note, "Please deliver carefully")
        self.assertEqual(order.tax_amount, Decimal("1000.00"))
        self.assertEqual(order.shipping_amount, Decimal("5000.00"))

        item = order.items.first()
        self.assertEqual(item.product, self.product)
        self.assertEqual(item.variant, self.variant)
        self.assertEqual(item.quantity, 2)

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 3)

    def test_user_can_create_order_for_product_without_variant_and_reduce_product_stock(self):
        self.authenticate(self.buyer)
        self.create_cart_with_item(user=self.buyer, product=self.no_variant_product, variant=None, quantity=3)

        response = self.client.post(
            self.create_order_url,
            {"currency": "NGN", "tax_amount": "0.00", "shipping_amount": "0.00", "discount_amount": "0.00"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.no_variant_product.refresh_from_db()
        self.assertEqual(self.no_variant_product.stock, 5)

        order = Order.objects.get(buyer=self.buyer)
        item = order.items.first()
        self.assertIsNone(item.variant)
        self.assertEqual(item.product_sku, self.no_variant_product.sku)

    def test_cannot_create_order_if_variant_stock_is_insufficient(self):
        self.authenticate(self.buyer)
        self.create_cart_with_item(user=self.buyer, product=self.product, variant=self.variant, quantity=6)

        response = self.client.post(
            self.create_order_url,
            {"currency": "NGN", "tax_amount": "0.00", "shipping_amount": "0.00", "discount_amount": "0.00"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient stock", response.data["error"])

    def test_order_creation_clears_cart_items(self):
        self.authenticate(self.buyer)
        cart, _ = self.create_cart_with_item(user=self.buyer, product=self.product, variant=self.variant, quantity=2)

        response = self.client.post(
            self.create_order_url,
            {"currency": "NGN", "tax_amount": "0.00", "shipping_amount": "0.00", "discount_amount": "0.00"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(cart.items.count(), 0)

    def test_order_total_is_calculated_correctly(self):
        self.authenticate(self.buyer)
        self.create_cart_with_item(user=self.buyer, product=self.product, variant=self.variant, quantity=2)

        response = self.client.post(
            self.create_order_url,
            {"currency": "NGN", "tax_amount": "1000.00", "shipping_amount": "5000.00", "discount_amount": "2000.00"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        order = Order.objects.get(buyer=self.buyer)
        expected_subtotal = self.variant.price * 2
        expected_total = expected_subtotal + Decimal("1000.00") + Decimal("5000.00") - Decimal("2000.00")

        self.assertEqual(order.subtotal_amount, expected_subtotal)
        self.assertEqual(order.total_amount, expected_total)

    def test_user_can_list_only_their_orders(self):
        Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("1000.00"),
            subtotal_amount=Decimal("1000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )
        Order.objects.create(
            buyer=self.other_buyer,
            total_amount=Decimal("2000.00"),
            subtotal_amount=Decimal("2000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        self.authenticate(self.buyer)
        response = self.client.get(self.my_orders_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

    def test_user_can_retrieve_their_own_order(self):
        order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("1000.00"),
            subtotal_amount=Decimal("1000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        self.authenticate(self.buyer)
        url = reverse("order-detail", kwargs={"order_number": order.order_number})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["order_number"], order.order_number)

    def test_user_cannot_retrieve_another_users_order(self):
        order = Order.objects.create(
            buyer=self.other_buyer,
            total_amount=Decimal("1000.00"),
            subtotal_amount=Decimal("1000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        self.authenticate(self.buyer)
        url = reverse("order-detail", kwargs={"order_number": order.order_number})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_public_can_list_active_shipping_methods(self):
        response = self.client.get(self.shipping_methods_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [item["name"] for item in response.data["results"]]
        self.assertIn(self.shipping_method.name, names)
        self.assertNotIn(self.inactive_shipping_method.name, names)

    def test_user_can_update_shipping_method_for_own_order(self):
        order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("1000.00"),
            subtotal_amount=Decimal("1000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        self.authenticate(self.buyer)
        url = reverse("update-order-shipping", kwargs={"order_number": order.order_number})
        response = self.client.post(url, {"shipping_method_id": self.shipping_method.id}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(OrderShipping.objects.filter(order=order).exists())
        order.refresh_from_db()
        self.assertEqual(order.shipping_amount, self.shipping_method.price)
        self.assertEqual(order.total_amount, Decimal("6000.00"))

    def test_updating_shipping_method_recalculates_existing_order_total(self):
        order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("101000.00"),
            subtotal_amount=Decimal("100000.00"),
            tax_amount=Decimal("3000.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("2000.00"),
            currency="NGN",
        )

        self.authenticate(self.buyer)
        url = reverse("update-order-shipping", kwargs={"order_number": order.order_number})
        response = self.client.post(url, {"shipping_method_id": self.shipping_method.id}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.shipping_amount, Decimal("5000.00"))
        self.assertEqual(order.total_amount, Decimal("106000.00"))

    def test_user_cannot_update_shipping_for_another_users_order(self):
        order = Order.objects.create(
            buyer=self.other_buyer,
            total_amount=Decimal("1000.00"),
            subtotal_amount=Decimal("1000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        self.authenticate(self.buyer)
        url = reverse("update-order-shipping", kwargs={"order_number": order.order_number})
        response = self.client.post(url, {"shipping_method_id": self.shipping_method.id}, format="json")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_update_order_with_inactive_shipping_method(self):
        order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("1000.00"),
            subtotal_amount=Decimal("1000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        self.authenticate(self.buyer)
        url = reverse("update-order-shipping", kwargs={"order_number": order.order_number})
        response = self.client.post(url, {"shipping_method_id": self.inactive_shipping_method.id}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "The selected shipping method was not found.")
