from decimal import Decimal
from unittest.mock import Mock, patch

import requests
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from users.models import User, SellerProfile
from products.models import Category, Product, ProductVariant
from orders.models import Order, OrderItem
from payments.models import Payment, Refund, Payout, Transaction


class PaymentAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()

        self.buyer = User.objects.create_user(
            email="buyer@example.com",
            password="TestPass123!",
            is_buyer=True,
            is_seller=False,
        )

        self.other_buyer = User.objects.create_user(
            email="otherbuyer@example.com",
            password="TestPass123!",
            is_buyer=True,
            is_seller=False,
        )

        self.staff_user = User.objects.create_user(
            email="admin@example.com",
            password="AdminPass123!",
            is_staff=True,
            is_superuser=True,
        )

        self.seller_user = User.objects.create_user(
            email="seller@example.com",
            password="SellerPass123!",
            is_buyer=False,
            is_seller=True,
        )

        self.other_seller_user = User.objects.create_user(
            email="otherseller@example.com",
            password="SellerPass123!",
            is_buyer=False,
            is_seller=True,
        )

        self.seller_profile = SellerProfile.objects.create(
            user=self.seller_user,
            business_name="Tech Store",
            verified=True,
        )

        self.other_seller_profile = SellerProfile.objects.create(
            user=self.other_seller_user,
            business_name="Other Store",
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

        self.other_product = Product.objects.create(
            seller=self.other_seller_profile,
            category=self.category,
            title="Tablet",
            description="Tablet device",
            price=Decimal("300000.00"),
            currency="NGN",
            sku="TAB-001",
            stock=8,
            status=Product.STATUS_PUBLISHED,
        )

        self.order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("520000.00"),
            subtotal_amount=Decimal("520000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        self.other_order = Order.objects.create(
            buyer=self.other_buyer,
            total_amount=Decimal("300000.00"),
            subtotal_amount=Decimal("300000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        # Needed for seller transaction filtering through payment__order__items__product__seller
        OrderItem.objects.create(
            order=self.order,
            product=self.product,
            variant=self.variant,
            quantity=1,
            price=self.variant.price,
            total_amount=self.variant.price,
            product_name=self.product.title,
            product_sku=self.variant.sku,
            attributes=self.variant.attributes,
        )

        OrderItem.objects.create(
            order=self.other_order,
            product=self.other_product,
            variant=None,
            quantity=1,
            price=self.other_product.price,
            total_amount=self.other_product.price,
            product_name=self.other_product.title,
            product_sku=self.other_product.sku,
            attributes=getattr(self.other_product, "attributes", None),
        )

        self.payment = Payment.objects.create(
            order=self.order,
            payment_method="card",
            provider_payment_id="pay_001",
            status="completed",
            amount=Decimal("520000.00"),
            currency="NGN",
            fee_amount=Decimal("0.00"),
            net_amount=Decimal("520000.00"),
        )

        self.other_payment = Payment.objects.create(
            order=self.other_order,
            payment_method="card",
            provider_payment_id="pay_002",
            status="completed",
            amount=Decimal("300000.00"),
            currency="NGN",
            fee_amount=Decimal("0.00"),
            net_amount=Decimal("300000.00"),
        )

        self.refund = Refund.objects.create(
            payment=self.payment,
            order=self.order,
            amount=Decimal("100000.00"),
            status="requested",
            reason={"message": "Customer request"},
        )

        self.payout = Payout.objects.create(
            seller=self.seller_profile,
            amount=Decimal("150000.00"),
            status="pending",
            currency="NGN",
            payment_method="bank_transfer",
            payment_details={"bank": "Test Bank"},
        )

        self.other_payout = Payout.objects.create(
            seller=self.other_seller_profile,
            amount=Decimal("120000.00"),
            status="pending",
            currency="NGN",
            payment_method="bank_transfer",
            payment_details={"bank": "Other Bank"},
        )

        self.sale_txn = Transaction.objects.create(
            payment=self.payment,
            transaction_type="sale",
            amount=self.payment.amount,
            currency=self.payment.currency,
            payment_method=self.payment.payment_method,
            metadata={"source": "seed"},
            description=f"Payment for Order {self.order.order_number}",
        )

        self.payout_txn = Transaction.objects.create(
            payout=self.payout,
            transaction_type="payout",
            amount=self.payout.amount,
            currency=self.payout.currency,
            payment_method=self.payout.payment_method,
            metadata=self.payout.payment_details,
            description=f"Payout to seller {self.payout.seller.business_name}",
        )

        self.payment_list_url = reverse("payments:payment-list-create")
        self.payment_detail_url = reverse("payments:payment-detail", kwargs={"pk": self.payment.pk})

        self.refund_list_url = reverse("payments:refund-list-create")
        self.refund_detail_url = reverse("payments:refund-detail", kwargs={"pk": self.refund.pk})

        self.payout_list_url = reverse("payments:payout-list-create")
        self.payout_detail_url = reverse("payments:payout-detail", kwargs={"pk": self.payout.pk})

        self.transaction_list_url = reverse("payments:transaction-list")
        self.paystack_init_url = reverse("payments:paystack-init")
        self.paystack_verify_url = reverse("payments:paystack-verify")

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def extract_results(self, response):
        if isinstance(response.data, dict) and "results" in response.data:
            return response.data["results"]
        return response.data

    # -----------------------------
    # PAYMENT LIST / CREATE / DETAIL
    # -----------------------------

    def test_buyer_can_list_only_their_payments(self):
        self.authenticate(self.buyer)
        response = self.client.get(self.payment_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self.extract_results(response)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["order"], self.order.id)

    def test_staff_can_list_all_payments(self):
        self.authenticate(self.staff_user)
        response = self.client.get(self.payment_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self.extract_results(response)
        self.assertEqual(len(results), 2)

    def test_buyer_can_create_payment_for_own_order_with_matching_amount(self):
        self.authenticate(self.buyer)

        new_order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("100000.00"),
            subtotal_amount=Decimal("100000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        response = self.client.post(
            self.payment_list_url,
            {
                "order": new_order.id,
                "payment_method": "card",
                "amount": "100000.00",
                "currency": "NGN",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payment = Payment.objects.get(order=new_order)
        self.assertEqual(payment.status, "pending")
        self.assertEqual(payment.net_amount, Decimal("100000.00"))
        self.assertTrue(payment.reference)

    def test_buyer_cannot_create_payment_for_another_users_order(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.payment_list_url,
            {
                "order": self.other_order.id,
                "payment_method": "card",
                "amount": "300000.00",
                "currency": "NGN",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_payment_create_requires_order_or_order_number(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.payment_list_url,
            {
                "payment_method": "card",
                "amount": "1000.00",
                "currency": "NGN",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("order", response.data)

    def test_payment_create_rejects_wrong_amount(self):
        self.authenticate(self.buyer)

        new_order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("250000.00"),
            subtotal_amount=Decimal("250000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        response = self.client.post(
            self.payment_list_url,
            {
                "order": new_order.id,
                "payment_method": "card",
                "amount": "200000.00",
                "currency": "NGN",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("amount", response.data)

    def test_buyer_can_retrieve_own_payment(self):
        self.authenticate(self.buyer)
        response = self.client.get(self.payment_detail_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.payment.id)

    def test_buyer_cannot_retrieve_another_users_payment(self):
        self.authenticate(self.buyer)
        url = reverse("payments:payment-detail", kwargs={"pk": self.other_payment.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_staff_cannot_update_payment(self):
        self.authenticate(self.buyer)
        response = self.client.patch(
            self.payment_detail_url,
            {"status": "failed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "completed")

    def test_staff_can_update_payment(self):
        self.authenticate(self.staff_user)
        response = self.client.patch(
            self.payment_detail_url,
            {"status": "failed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "failed")

    # -----------------------------
    # REFUND LIST / CREATE / DETAIL
    # -----------------------------

    def test_buyer_can_list_only_their_refunds(self):
        other_refund = Refund.objects.create(
            payment=self.other_payment,
            order=self.other_order,
            amount=Decimal("50000.00"),
            status="requested",
        )

        self.authenticate(self.buyer)
        response = self.client.get(self.refund_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self.extract_results(response)
        refund_ids = {item["id"] for item in results}
        self.assertIn(self.refund.id, refund_ids)
        self.assertNotIn(other_refund.id, refund_ids)

    def test_staff_can_list_all_refunds(self):
        Refund.objects.create(
            payment=self.other_payment,
            order=self.other_order,
            amount=Decimal("50000.00"),
            status="requested",
        )

        self.authenticate(self.staff_user)
        response = self.client.get(self.refund_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self.extract_results(response)
        self.assertEqual(len(results), 2)

    def test_buyer_can_create_refund_for_own_payment(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.refund_list_url,
            {
                "payment": self.payment.id,
                "amount": "25000.00",
                "reason": {"message": "Need refund"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Refund.objects.filter(payment=self.payment, amount=Decimal("25000.00")).exists()
        )

    def test_refund_create_requires_payment(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.refund_list_url,
            {
                "amount": "25000.00",
                "reason": {"message": "Need refund"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("payment", response.data)

    def test_buyer_cannot_create_refund_for_another_users_payment(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.refund_list_url,
            {
                "payment": self.other_payment.id,
                "amount": "10000.00",
                "reason": {"message": "Unauthorized"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_refund_create_rejects_amount_above_remaining_refundable(self):
        Refund.objects.create(
            payment=self.payment,
            order=self.order,
            amount=Decimal("500000.00"),
            status="processed",
        )

        self.authenticate(self.buyer)
        response = self.client.post(
            self.refund_list_url,
            {
                "payment": self.payment.id,
                "amount": "30000.00",
                "reason": {"message": "Too much"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("amount", response.data)

    def test_buyer_can_retrieve_own_refund(self):
        self.authenticate(self.buyer)
        response = self.client.get(self.refund_detail_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.refund.id)

    def test_non_staff_cannot_update_refund_status(self):
        self.authenticate(self.buyer)
        response = self.client.patch(
            self.refund_detail_url,
            {"status": "processed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_processing_partial_refund_updates_payment_and_creates_transaction(self):
        self.authenticate(self.staff_user)

        response = self.client.patch(
            self.refund_detail_url,
            {"status": "processed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.refund.refresh_from_db()
        self.payment.refresh_from_db()
        self.order.refresh_from_db()

        self.assertEqual(self.refund.status, "processed")
        self.assertEqual(self.payment.status, "partially_refunded")
        self.assertEqual(self.order.status, "pending_payment")
        self.assertTrue(
            Transaction.objects.filter(payment=self.payment, transaction_type="refund").exists()
        )

    def test_staff_processing_full_refund_marks_order_refunded(self):
        full_refund = Refund.objects.create(
            payment=self.payment,
            order=self.order,
            amount=self.payment.amount,
            status="requested",
            reason={"message": "Full refund"},
        )

        self.authenticate(self.staff_user)
        url = reverse("payments:refund-detail", kwargs={"pk": full_refund.pk})
        response = self.client.patch(
            url,
            {"status": "processed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        full_refund.refresh_from_db()

        self.assertEqual(full_refund.status, "processed")
        self.assertEqual(self.payment.status, "refunded")
        self.assertEqual(self.order.status, "refunded")

    # -----------------------------
    # PAYOUT LIST / CREATE / DETAIL
    # -----------------------------

    def test_seller_can_list_only_their_payouts(self):
        self.authenticate(self.seller_user)
        response = self.client.get(self.payout_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self.extract_results(response)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["seller"], self.seller_profile.id)

    def test_staff_can_list_all_payouts(self):
        self.authenticate(self.staff_user)
        response = self.client.get(self.payout_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self.extract_results(response)
        self.assertEqual(len(results), 2)

    def test_seller_can_create_payout(self):
        self.authenticate(self.seller_user)

        response = self.client.post(
            self.payout_list_url,
            {
                "amount": "50000.00",
                "currency": "NGN",
                "payment_method": "bank_transfer",
                "payment_details": {"bank": "GTBank"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Payout.objects.filter(
                seller=self.seller_profile,
                amount=Decimal("50000.00"),
                status="pending",
            ).exists()
        )

    def test_buyer_cannot_create_payout(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.payout_list_url,
            {
                "amount": "50000.00",
                "currency": "NGN",
                "payment_method": "bank_transfer",
                "payment_details": {"bank": "GTBank"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_seller_can_retrieve_own_payout(self):
        self.authenticate(self.seller_user)
        response = self.client.get(self.payout_detail_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.payout.id)

    def test_seller_cannot_retrieve_another_sellers_payout(self):
        self.authenticate(self.seller_user)
        url = reverse("payments:payout-detail", kwargs={"pk": self.other_payout.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_staff_cannot_update_payout(self):
        self.authenticate(self.seller_user)
        response = self.client.patch(
            self.payout_detail_url,
            {"status": "processed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_can_update_payout_and_create_transaction(self):
        self.authenticate(self.staff_user)
        response = self.client.patch(
            self.payout_detail_url,
            {"status": "processed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, "processed")
        self.assertIsNotNone(self.payout.processed_at)
        self.assertTrue(
            Transaction.objects.filter(payout=self.payout, transaction_type="payout").exists()
        )

    # -----------------------------
    # TRANSACTION LIST
    # -----------------------------

    def test_buyer_sees_only_their_transactions(self):
        other_sale = Transaction.objects.create(
            payment=self.other_payment,
            transaction_type="sale",
            amount=self.other_payment.amount,
            currency=self.other_payment.currency,
            payment_method=self.other_payment.payment_method,
            description="Other buyer sale",
        )

        self.authenticate(self.buyer)
        response = self.client.get(self.transaction_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self.extract_results(response)
        txn_ids = {item["id"] for item in results}
        self.assertIn(self.sale_txn.id, txn_ids)
        self.assertNotIn(other_sale.id, txn_ids)

    def test_seller_sees_sale_and_payout_transactions_related_to_them(self):
        other_sale = Transaction.objects.create(
            payment=self.other_payment,
            transaction_type="sale",
            amount=self.other_payment.amount,
            currency=self.other_payment.currency,
            payment_method=self.other_payment.payment_method,
            description="Other seller sale",
        )

        self.authenticate(self.seller_user)
        response = self.client.get(self.transaction_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self.extract_results(response)
        txn_ids = {item["id"] for item in results}

        self.assertIn(self.sale_txn.id, txn_ids)
        self.assertIn(self.payout_txn.id, txn_ids)
        self.assertNotIn(other_sale.id, txn_ids)

    def test_staff_sees_all_transactions(self):
        self.authenticate(self.staff_user)
        response = self.client.get(self.transaction_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self.extract_results(response)
        self.assertGreaterEqual(len(results), 2)

    # -----------------------------
    # PAYSTACK INITIALIZE
    # -----------------------------

    @patch("payments.views.requests.post")
    def test_paystack_initialize_success_for_own_order(self, mock_post):
        self.authenticate(self.buyer)

        payable_order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("75000.00"),
            subtotal_amount=Decimal("75000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        mock_response = Mock()
        mock_response.json.return_value = {
            "status": True,
            "message": "Authorization URL created",
            "data": {
                "authorization_url": "https://checkout.paystack.com/test",
                "access_code": "abc123",
                "reference": f"ORDER-{payable_order.id}-abc1234567",
            },
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        response = self.client.post(
            self.paystack_init_url,
            {"order_id": payable_order.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["status"])
        payment = Payment.objects.get(order=payable_order)
        self.assertTrue(payment.reference)

    @override_settings(
        FRONTEND_URL="https://shop.example.com",
        PAYSTACK_CALLBACK_URL="http://localhost:5173/payment/ver",
        CORS_ALLOWED_ORIGINS=["https://shop.example.com", "https://preview.example.com"],
    )
    @patch("payments.views.requests.post")
    def test_paystack_initialize_uses_allowed_request_origin_for_callback_url(self, mock_post):
        self.authenticate(self.buyer)

        payable_order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("75000.00"),
            subtotal_amount=Decimal("75000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        mock_response = Mock()
        mock_response.json.return_value = {
            "status": True,
            "message": "Authorization URL created",
            "data": {
                "authorization_url": "https://checkout.paystack.com/test",
                "access_code": "abc123",
                "reference": f"ORDER-{payable_order.id}-abc1234567",
            },
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        response = self.client.post(
            self.paystack_init_url,
            {"order_id": payable_order.id},
            format="json",
            HTTP_ORIGIN="https://preview.example.com",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            mock_post.call_args.kwargs["json"]["callback_url"],
            "https://preview.example.com/payment/ver",
        )

    @override_settings(
        FRONTEND_URL="https://shop.example.com",
        PAYSTACK_CALLBACK_URL="/verify-payment",
        CORS_ALLOWED_ORIGINS=["https://shop.example.com"],
    )
    @patch("payments.views.requests.post")
    def test_paystack_initialize_falls_back_to_frontend_url_for_unapproved_origin(self, mock_post):
        self.authenticate(self.buyer)

        payable_order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("75000.00"),
            subtotal_amount=Decimal("75000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        mock_response = Mock()
        mock_response.json.return_value = {
            "status": True,
            "message": "Authorization URL created",
            "data": {
                "authorization_url": "https://checkout.paystack.com/test",
                "access_code": "abc123",
                "reference": f"ORDER-{payable_order.id}-abc1234567",
            },
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        response = self.client.post(
            self.paystack_init_url,
            {"order_id": payable_order.id},
            format="json",
            HTTP_ORIGIN="https://untrusted.example.com",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            mock_post.call_args.kwargs["json"]["callback_url"],
            "https://shop.example.com/verify-payment",
        )

    @patch("payments.views.requests.post")
    def test_paystack_initialize_backfills_missing_reference_on_existing_pending_payment(self, mock_post):
        self.authenticate(self.buyer)

        payable_order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("75000.00"),
            subtotal_amount=Decimal("75000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )
        pending_payment = Payment.objects.create(
            order=payable_order,
            payment_method="card",
            reference="TEMP-REF",
            status="pending",
            amount=Decimal("75000.00"),
            currency="NGN",
            fee_amount=Decimal("0.00"),
            net_amount=Decimal("75000.00"),
        )
        Payment.objects.filter(pk=pending_payment.pk).update(reference=None)

        mock_response = Mock()
        mock_response.json.return_value = {
            "status": True,
            "message": "Authorization URL created",
            "data": {
                "authorization_url": "https://checkout.paystack.com/test",
                "access_code": "abc123",
                "reference": f"ORDER-{payable_order.id}-abc1234567",
            },
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        response = self.client.post(
            self.paystack_init_url,
            {"order_id": payable_order.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pending_payment.refresh_from_db()
        self.assertTrue(pending_payment.reference)

    def test_paystack_initialize_requires_order_id(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.paystack_init_url,
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("order_id", response.data)

    def test_paystack_initialize_rejects_other_users_order(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.paystack_init_url,
            {"order_id": self.other_order.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_paystack_initialize_rejects_paid_order(self):
        self.order.status = "paid"
        self.order.save(update_fields=["status"])

        self.authenticate(self.buyer)
        response = self.client.post(
            self.paystack_init_url,
            {"order_id": self.order.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("awaiting payment", response.data["detail"])

    def test_paystack_initialize_rejects_order_with_completed_payment(self):
        self.authenticate(self.buyer)
        response = self.client.post(
            self.paystack_init_url,
            {"order_id": self.order.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("completed payment", response.data["detail"])

    @patch("payments.views.requests.post")
    def test_paystack_initialize_handles_request_exception(self, mock_post):
        self.authenticate(self.buyer)

        payable_order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("80000.00"),
            subtotal_amount=Decimal("80000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        mock_post.side_effect = requests.exceptions.RequestException("Network down")

        response = self.client.post(
            self.paystack_init_url,
            {"order_id": payable_order.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertIn("Paystack initialization failed", response.data["detail"])

    # -----------------------------
    # PAYSTACK VERIFY
    # -----------------------------

    def test_paystack_verify_requires_reference(self):
        response = self.client.get(self.paystack_verify_url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reference", response.data)

    @patch("payments.views.requests.get")
    def test_paystack_verify_handles_request_exception(self, mock_get):
        mock_get.side_effect = requests.exceptions.RequestException("Timeout")

        response = self.client.get(self.paystack_verify_url, {"reference": "ORDER-1-ABC"})

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertIn("Paystack verification failed", response.data["detail"])

    @patch("payments.views.requests.get")
    def test_paystack_verify_returns_400_when_provider_status_false(self, mock_get):
        mock_response = Mock()
        mock_response.json.return_value = {"status": False, "message": "Verification failed"}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        response = self.client.get(self.paystack_verify_url, {"reference": "ORDER-1-ABC"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["status"])

    @patch("payments.views.requests.get")
    def test_paystack_verify_rejects_unsuccessful_payment_status(self, mock_get):
        mock_response = Mock()
        mock_response.json.return_value = {
            "status": True,
            "data": {
                "status": "failed",
                "reference": f"ORDER-{self.order.id}-ABC",
                "amount": 52000000,
                "currency": "NGN",
            },
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        response = self.client.get(
            self.paystack_verify_url,
            {"reference": f"ORDER-{self.order.id}-ABC"},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not successful", response.data["detail"])

    @patch("payments.views.requests.get")
    def test_paystack_verify_rejects_invalid_reference_format(self, mock_get):
        mock_response = Mock()
        mock_response.json.return_value = {
            "status": True,
            "data": {
                "id": 999001,
                "status": "success",
                "reference": "INVALIDREF",
                "amount": 52000000,
                "currency": "NGN",
            },
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        response = self.client.get(
            self.paystack_verify_url,
            {"reference": "INVALIDREF"},
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("Payment record not found", response.data["detail"])

    @patch("payments.views.requests.get")
    def test_paystack_verify_success_updates_existing_payment_transaction_and_marks_order_paid(self, mock_get):
        unpaid_order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("90000.00"),
            subtotal_amount=Decimal("90000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        reference = f"ORDER-{unpaid_order.id}-XYZ1234567"
        pending_payment = Payment.objects.create(
            order=unpaid_order,
            payment_method="card",
            reference=reference,
            status="pending",
            amount=Decimal("90000.00"),
            currency="NGN",
            fee_amount=Decimal("0.00"),
            net_amount=Decimal("90000.00"),
        )

        mock_response = Mock()
        mock_response.json.return_value = {
            "status": True,
            "data": {
                "id": 888001,
                "status": "success",
                "reference": reference,
                "amount": 9000000,
                "currency": "NGN",
            },
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        response = self.client.get(
            self.paystack_verify_url,
            {"reference": reference},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Payment verified successfully.")

        unpaid_order.refresh_from_db()
        self.assertEqual(unpaid_order.status, "paid")

        payment = Payment.objects.get(pk=pending_payment.pk)
        self.assertEqual(payment.status, "completed")
        self.assertEqual(payment.amount, Decimal("90000.00"))
        self.assertEqual(payment.provider_payment_id, "888001")
        self.assertIsNotNone(payment.paid_at)

        self.assertTrue(
            Transaction.objects.filter(payment=payment, transaction_type="sale").exists()
        )

    @patch("payments.views.requests.get")
    def test_paystack_verify_existing_completed_payment_returns_already_verified(self, mock_get):
        paid_order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("110000.00"),
            subtotal_amount=Decimal("110000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        completed_payment = Payment.objects.create(
            order=paid_order,
            payment_method="card",
            reference=f"ORDER-{paid_order.id}-DUPLICATE01",
            provider_payment_id="pay_existing",
            status="completed",
            amount=Decimal("110000.00"),
            currency="NGN",
            fee_amount=Decimal("0.00"),
            net_amount=Decimal("110000.00"),
        )

        reference = f"ORDER-{paid_order.id}-DUPLICATE01"

        mock_response = Mock()
        mock_response.json.return_value = {
            "status": True,
            "data": {
                "id": 777001,
                "status": "success",
                "reference": reference,
                "amount": 11000000,
                "currency": "NGN",
            },
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        response = self.client.get(
            self.paystack_verify_url,
            {"reference": reference},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Payment already verified.")
        self.assertEqual(response.data["payment_id"], completed_payment.id)

        self.assertEqual(
            Transaction.objects.filter(payment=completed_payment, transaction_type="sale").count(),
            1,
        )

    @patch("payments.views.requests.get")
    def test_paystack_verify_existing_completed_payment_without_sale_transaction_creates_one(self, mock_get):
        paid_order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("130000.00"),
            subtotal_amount=Decimal("130000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        completed_payment = Payment.objects.create(
            order=paid_order,
            payment_method="card",
            reference=f"ORDER-{paid_order.id}-DUPSALE001",
            provider_payment_id="pay_existing_2",
            status="completed",
            amount=Decimal("130000.00"),
            currency="NGN",
            fee_amount=Decimal("0.00"),
            net_amount=Decimal("130000.00"),
        )

        reference = f"ORDER-{paid_order.id}-DUPSALE001"

        mock_response = Mock()
        mock_response.json.return_value = {
            "status": True,
            "data": {
                "id": 777002,
                "status": "success",
                "reference": reference,
                "amount": 13000000,
                "currency": "NGN",
            },
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        response = self.client.get(
            self.paystack_verify_url,
            {"reference": reference},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            Transaction.objects.filter(payment=completed_payment, transaction_type="sale").count(),
            1,
        )

    @patch("payments.views.requests.get")
    def test_paystack_verify_does_not_create_new_payment_when_reference_is_unknown(self, mock_get):
        unpaid_order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("45000.00"),
            subtotal_amount=Decimal("45000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )
        reference = f"ORDER-{unpaid_order.id}-UNKNOWNPAY"

        mock_response = Mock()
        mock_response.json.return_value = {
            "status": True,
            "data": {
                "id": 123456,
                "status": "success",
                "reference": reference,
                "amount": 4500000,
                "currency": "NGN",
            },
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        response = self.client.get(self.paystack_verify_url, {"reference": reference})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(Payment.objects.filter(order=unpaid_order).exists())

    @patch("payments.views.requests.get")
    def test_paystack_verify_rejects_amount_mismatch(self, mock_get):
        unpaid_order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("90000.00"),
            subtotal_amount=Decimal("90000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )
        reference = f"ORDER-{unpaid_order.id}-AMOUNTBAD1"
        payment = Payment.objects.create(
            order=unpaid_order,
            payment_method="card",
            reference=reference,
            status="pending",
            amount=Decimal("90000.00"),
            currency="NGN",
            fee_amount=Decimal("0.00"),
            net_amount=Decimal("90000.00"),
        )

        mock_response = Mock()
        mock_response.json.return_value = {
            "status": True,
            "data": {
                "id": 888002,
                "status": "success",
                "reference": reference,
                "amount": 9100000,
                "currency": "NGN",
            },
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        response = self.client.get(self.paystack_verify_url, {"reference": reference})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("amount", response.data["detail"])
        payment.refresh_from_db()
        self.assertEqual(payment.status, "pending")

    @patch("payments.views.requests.get")
    def test_paystack_verify_rejects_currency_mismatch(self, mock_get):
        unpaid_order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("90000.00"),
            subtotal_amount=Decimal("90000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )
        reference = f"ORDER-{unpaid_order.id}-CURRBAD01"
        payment = Payment.objects.create(
            order=unpaid_order,
            payment_method="card",
            reference=reference,
            status="pending",
            amount=Decimal("90000.00"),
            currency="NGN",
            fee_amount=Decimal("0.00"),
            net_amount=Decimal("90000.00"),
        )

        mock_response = Mock()
        mock_response.json.return_value = {
            "status": True,
            "data": {
                "id": 888003,
                "status": "success",
                "reference": reference,
                "amount": 9000000,
                "currency": "USD",
            },
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        response = self.client.get(self.paystack_verify_url, {"reference": reference})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("currency", response.data["detail"])
        payment.refresh_from_db()
        self.assertEqual(payment.status, "pending")
