from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from orders.models import Order, OrderItem
from products.models import Category, Product
from reviews.models import HelpfulReview, Review, SellerReview
from users.models import SellerProfile, User


class ReviewsAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()

        self.buyer = User.objects.create_user(
            email="buyer@example.com",
            password="TestPass123!",
            is_buyer=True,
            is_seller=False,
        )
        self.other_buyer = User.objects.create_user(
            email="other-buyer@example.com",
            password="TestPass123!",
            is_buyer=True,
            is_seller=False,
        )
        self.seller_user = User.objects.create_user(
            email="seller@example.com",
            password="TestPass123!",
            is_seller=True,
            is_buyer=False,
        )
        self.other_seller_user = User.objects.create_user(
            email="seller-two@example.com",
            password="TestPass123!",
            is_seller=True,
            is_buyer=False,
        )
        self.admin_user = User.objects.create_user(
            email="admin@example.com",
            password="AdminPass123!",
            is_staff=True,
            is_superuser=True,
        )

        self.seller_profile = SellerProfile.objects.create(
            user=self.seller_user,
            business_name="Seller One",
        )
        self.other_seller_profile = SellerProfile.objects.create(
            user=self.other_seller_user,
            business_name="Seller Two",
        )

        self.category = Category.objects.create(
            name="Electronics",
            description="Electronics category",
            is_active=True,
        )

        self.product = Product.objects.create(
            seller=self.seller_profile,
            category=self.category,
            title="Laptop",
            description="Good laptop",
            price=Decimal("500000.00"),
            compare_price=Decimal("550000.00"),
            currency="NGN",
            sku="LP-001",
            stock=10,
            status=Product.STATUS_PUBLISHED,
        )
        self.other_seller_product = Product.objects.create(
            seller=self.other_seller_profile,
            category=self.category,
            title="Headphones",
            description="Good headphones",
            price=Decimal("60000.00"),
            compare_price=Decimal("80000.00"),
            currency="NGN",
            sku="HD-001",
            stock=15,
            status=Product.STATUS_PUBLISHED,
        )

        self.order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("500000.00"),
            subtotal_amount=Decimal("500000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )
        self.other_order = Order.objects.create(
            buyer=self.other_buyer,
            total_amount=Decimal("500000.00"),
            subtotal_amount=Decimal("500000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )
        self.unrelated_order = Order.objects.create(
            buyer=self.buyer,
            total_amount=Decimal("60000.00"),
            subtotal_amount=Decimal("60000.00"),
            tax_amount=Decimal("0.00"),
            shipping_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="NGN",
        )

        OrderItem.objects.create(
            order=self.order,
            product=self.product,
            quantity=1,
            price=self.product.price,
            total_amount=self.product.price,
            product_name=self.product.title,
            product_sku=self.product.sku,
        )
        OrderItem.objects.create(
            order=self.other_order,
            product=self.product,
            quantity=1,
            price=self.product.price,
            total_amount=self.product.price,
            product_name=self.product.title,
            product_sku=self.product.sku,
        )
        OrderItem.objects.create(
            order=self.unrelated_order,
            product=self.other_seller_product,
            quantity=1,
            price=self.other_seller_product.price,
            total_amount=self.other_seller_product.price,
            product_name=self.other_seller_product.title,
            product_sku=self.other_seller_product.sku,
        )

        self.review_list_url = reverse("reviews:review-list-create")
        self.seller_review_list_url = reverse("reviews:seller-review-list-create")

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def extract_results(self, response):
        if isinstance(response.data, dict) and "results" in response.data:
            return response.data["results"]
        return response.data

    def test_review_create_requires_product_and_order(self):
        self.authenticate(self.buyer)
        response = self.client.post(self.review_list_url, {"rating": 4}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    def test_admin_can_approve_review(self):
        review = Review.objects.create(
            product=self.product,
            user=self.buyer,
            order=self.order,
            rating=4,
            comment="Solid product",
            is_approved=False,
            is_verified=True,
        )
        self.authenticate(self.admin_user)
        url = reverse("reviews:review-detail", kwargs={"pk": review.pk})
        response = self.client.patch(url, {"is_approved": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertTrue(review.is_approved)

    def test_related_seller_can_only_update_review_approval(self):
        review = Review.objects.create(
            product=self.product,
            user=self.buyer,
            order=self.order,
            rating=4,
            comment="Solid product",
            is_approved=False,
            is_verified=True,
        )
        self.authenticate(self.seller_user)
        url = reverse("reviews:review-detail", kwargs={"pk": review.pk})

        forbidden_response = self.client.patch(
            url,
            {"is_approved": True, "comment": "Seller edited"},
            format="json",
        )
        self.assertEqual(forbidden_response.status_code, status.HTTP_400_BAD_REQUEST)

        allowed_response = self.client.patch(url, {"is_approved": True}, format="json")
        self.assertEqual(allowed_response.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertTrue(review.is_approved)

    def test_review_list_hides_unapproved_from_anonymous(self):
        approved = Review.objects.create(
            product=self.product,
            user=self.other_buyer,
            order=self.other_order,
            rating=5,
            comment="Great",
            is_approved=True,
            is_verified=True,
        )
        Review.objects.create(
            product=self.product,
            user=self.buyer,
            order=self.order,
            rating=3,
            comment="Pending moderation",
            is_approved=False,
            is_verified=True,
        )

        response = self.client.get(self.review_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in self.extract_results(response)}
        self.assertIn(approved.id, returned_ids)
        self.assertEqual(len(returned_ids), 1)

    def test_review_owner_can_see_own_unapproved_review(self):
        owned_pending = Review.objects.create(
            product=self.product,
            user=self.buyer,
            order=self.order,
            rating=3,
            comment="Pending moderation",
            is_approved=False,
            is_verified=True,
        )

        self.authenticate(self.buyer)
        response = self.client.get(self.review_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in self.extract_results(response)}
        self.assertIn(owned_pending.id, returned_ids)

    def test_anonymous_cannot_retrieve_unapproved_review_detail(self):
        review = Review.objects.create(
            product=self.product,
            user=self.buyer,
            order=self.order,
            rating=3,
            comment="Pending moderation",
            is_approved=False,
            is_verified=True,
        )

        url = reverse("reviews:review-detail", kwargs={"pk": review.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_related_seller_can_retrieve_unapproved_review_detail(self):
        review = Review.objects.create(
            product=self.product,
            user=self.buyer,
            order=self.order,
            rating=3,
            comment="Pending moderation",
            is_approved=False,
            is_verified=True,
        )

        self.authenticate(self.seller_user)
        url = reverse("reviews:review-detail", kwargs={"pk": review.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_seller_review_create_requires_order_with_seller_product(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.seller_review_list_url,
            {"seller": self.seller_profile.id, "order": self.unrelated_order.id, "rating": 4},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_seller_review_create_saves_order(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.seller_review_list_url,
            {"seller": self.seller_profile.id, "order": self.order.id, "rating": 5},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        seller_review = SellerReview.objects.get(id=response.data["id"])
        self.assertEqual(seller_review.order, self.order)

    def test_seller_review_list_hides_unapproved_from_anonymous(self):
        approved = SellerReview.objects.create(
            seller=self.seller_profile,
            user=self.other_buyer,
            order=self.other_order,
            rating=5,
            comment="Great seller",
            is_approved=True,
        )
        SellerReview.objects.create(
            seller=self.seller_profile,
            user=self.buyer,
            order=self.order,
            rating=3,
            comment="Pending moderation",
            is_approved=False,
        )

        response = self.client.get(self.seller_review_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in self.extract_results(response)}
        self.assertIn(approved.id, returned_ids)
        self.assertEqual(len(returned_ids), 1)

    def test_anonymous_cannot_retrieve_unapproved_seller_review_detail(self):
        seller_review = SellerReview.objects.create(
            seller=self.seller_profile,
            user=self.buyer,
            order=self.order,
            rating=3,
            comment="Pending moderation",
            is_approved=False,
        )

        url = reverse("reviews:seller-review-detail", kwargs={"pk": seller_review.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_helpful_toggle_updates_count_and_record(self):
        review = Review.objects.create(
            product=self.product,
            user=self.buyer,
            order=self.order,
            rating=4,
            comment="Helpful review",
            is_approved=True,
            is_verified=True,
        )

        self.authenticate(self.other_buyer)
        url = reverse("reviews:review-helpful-toggle", kwargs={"pk": review.pk})

        first = self.client.post(url, {}, format="json")
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertEqual(review.helpful_count, 1)
        self.assertTrue(HelpfulReview.objects.filter(review=review, user=self.other_buyer).exists())

        second = self.client.post(url, {}, format="json")
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertEqual(review.helpful_count, 0)
        self.assertFalse(HelpfulReview.objects.filter(review=review, user=self.other_buyer).exists())

    def test_helpful_toggle_rejects_hidden_unapproved_review(self):
        review = Review.objects.create(
            product=self.product,
            user=self.buyer,
            order=self.order,
            rating=4,
            comment="Hidden review",
            is_approved=False,
            is_verified=True,
        )

        self.authenticate(self.other_buyer)
        url = reverse("reviews:review-helpful-toggle", kwargs={"pk": review.pk})
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
