from decimal import Decimal
from io import BytesIO
import shutil
import tempfile
from unittest.mock import patch

import cloudinary
from cloudinary import CloudinaryResource
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from products.models import Category, Product, ProductImage, ProductVariant, Tag, Wishlist
from users.models import User, SellerProfile


TEST_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class ProductAPITests(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cloudinary.config(
            cloud_name="test-cloud",
            api_key="test-key",
            api_secret="test-secret",
            secure=True,
        )
        cls.cloudinary_upload_patcher = patch(
            "cloudinary.models.uploader.upload_resource",
            side_effect=cls.mock_cloudinary_upload,
        )
        cls.cloudinary_upload_patcher.start()

    @classmethod
    def tearDownClass(cls):
        cls.cloudinary_upload_patcher.stop()
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    @staticmethod
    def mock_cloudinary_upload(file_obj, **kwargs):
        file_name = getattr(file_obj, "name", "test-image.jpg")
        public_id = f"test-products/{file_name.rsplit('.', 1)[0]}"
        return CloudinaryResource(
            public_id,
            version="1",
            format="jpg",
            type=kwargs.get("type", "upload"),
            resource_type=kwargs.get("resource_type", "image"),
            metadata={"public_id": public_id},
        )

    def setUp(self):
        self.client = APIClient()

        self.buyer = User.objects.create_user(
            email="buyer@example.com",
            password="TestPass123!",
            first_name="Buyer",
            last_name="User",
            is_buyer=True,
            is_seller=False,
        )

        self.seller_user = User.objects.create_user(
            email="seller@example.com",
            password="TestPass123!",
            first_name="Seller",
            last_name="One",
            is_buyer=False,
            is_seller=True,
        )
        self.seller_profile = SellerProfile.objects.create(
            user=self.seller_user,
            business_name="Seller One Store",
            verified=True,
        )

        self.other_seller_user = User.objects.create_user(
            email="seller2@example.com",
            password="TestPass123!",
            first_name="Seller",
            last_name="Two",
            is_buyer=False,
            is_seller=True,
        )
        self.other_seller_profile = SellerProfile.objects.create(
            user=self.other_seller_user,
            business_name="Seller Two Store",
            verified=False,
        )

        self.admin_user = User.objects.create_user(
            email="admin@example.com",
            password="AdminPass123!",
            is_staff=True,
            is_superuser=True,
        )

        self.parent_category = Category.objects.create(
            name="Computers",
            description="Parent category",
            is_active=True,
        )
        self.category = Category.objects.create(
            name="Electronics",
            description="Electronic items",
            parent=self.parent_category,
            is_active=True,
        )
        self.inactive_category = Category.objects.create(
            name="Inactive Category",
            description="Should not be usable",
            is_active=False,
        )

        self.tag = Tag.objects.create(name="New Arrival")
        self.tag2 = Tag.objects.create(name="Featured")

        self.published_product = Product.objects.create(
            seller=self.seller_profile,
            category=self.category,
            title="Dell Laptop",
            description="A very good laptop",
            price=Decimal("450000.00"),
            compare_price=Decimal("500000.00"),
            currency="NGN",
            sku="DELL-001",
            stock=10,
            status=Product.STATUS_PUBLISHED,
            attributes={"brand": "Dell"},
            dimensions={"length": "30", "width": "20", "height": "2"},
            weight=Decimal("2.50"),
            weight_unit="kg",
        )
        self.published_product.tags.add(self.tag)

        self.draft_product = Product.objects.create(
            seller=self.seller_profile,
            category=self.category,
            title="Private Draft Product",
            description="Draft product",
            price=Decimal("10000.00"),
            currency="NGN",
            sku="DRAFT-001",
            stock=5,
            status=Product.STATUS_DRAFT,
        )

        self.other_seller_product = Product.objects.create(
            seller=self.other_seller_profile,
            category=self.category,
            title="HP Laptop",
            description="Another laptop",
            price=Decimal("350000.00"),
            currency="NGN",
            sku="HP-001",
            stock=7,
            status=Product.STATUS_PUBLISHED,
        )

        self.other_seller_draft = Product.objects.create(
            seller=self.other_seller_profile,
            category=self.category,
            title="Hidden Draft",
            description="Other seller private draft",
            price=Decimal("20000.00"),
            currency="NGN",
            sku="HIDDEN-001",
            stock=2,
            status=Product.STATUS_DRAFT,
        )

        self.product_image = ProductImage.objects.create(
            product=self.published_product,
            image=self.generate_test_image("seed.jpg"),
            alt_text="Seed image",
            order=1,
            is_primary=True,
        )

        self.variant = ProductVariant.objects.create(
            product=self.published_product,
            sku="DELL-001-BLACK",
            attributes={"color": "Black", "storage": "256GB"},
            stock=4,
            price=Decimal("455000.00"),
        )

        self.other_variant = ProductVariant.objects.create(
            product=self.other_seller_product,
            sku="HP-001-SILVER",
            attributes={"color": "Silver"},
            stock=3,
            price=Decimal("355000.00"),
        )

        self.product_list_url = reverse("products:product-list-create")
        self.category_list_url = reverse("products:category-list-create")
        self.tag_list_url = reverse("products:tag-list-create")
        self.wishlist_url = reverse("products:wishlist-list-create")
        self.wishlist_toggle_url = reverse("products:wishlist-toggle")

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def unauthenticate(self):
        self.client.force_authenticate(user=None)

    def extract_results(self, response):
        if isinstance(response.data, dict) and "results" in response.data:
            return response.data["results"]
        return response.data

    def generate_test_image(self, name="test.jpg"):
        file_obj = BytesIO()
        image = Image.new("RGB", (100, 100), "white")
        image.save(file_obj, "JPEG")
        file_obj.seek(0)
        return SimpleUploadedFile(name, file_obj.read(), content_type="image/jpeg")

    def product_payload(self, **kwargs):
        data = {
            "category": self.category.id,
            "title": "MacBook Pro",
            "description": "A powerful laptop",
            "price": "1200000.00",
            "compare_price": "1300000.00",
            "currency": "NGN",
            "sku": "MAC-001",
            "stock": 4,
            "status": Product.STATUS_PUBLISHED,
            "attributes": {"brand": "Apple", "ram": "16GB"},
            "dimensions": {"length": "31", "width": "22", "height": "1.5"},
            "weight": "1.40",
            "weight_unit": "kg",
            "seo_title": "MacBook Pro",
            "seo_description": "Top quality laptop",
            "tag_ids": [self.tag.id],
        }
        data.update(kwargs)
        return data

    # -----------------------------
    # PRODUCTS
    # -----------------------------

    def test_public_can_list_only_published_products(self):
        response = self.client.get(self.product_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_titles = [item["title"] for item in self.extract_results(response)]

        self.assertIn(self.published_product.title, returned_titles)
        self.assertIn(self.other_seller_product.title, returned_titles)
        self.assertNotIn(self.draft_product.title, returned_titles)
        self.assertNotIn(self.other_seller_draft.title, returned_titles)

    def test_authenticated_user_sees_wishlist_state_on_product_list(self):
        Wishlist.objects.create(user=self.buyer, product=self.published_product)
        self.authenticate(self.buyer)

        response = self.client.get(self.product_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self.extract_results(response)
        published = next(item for item in results if item["id"] == self.published_product.id)
        other = next(item for item in results if item["id"] == self.other_seller_product.id)
        self.assertTrue(published["is_wishlisted"])
        self.assertFalse(other["is_wishlisted"])

    def test_public_can_retrieve_published_product_detail(self):
        url = reverse("products:product-detail", kwargs={"slug": self.published_product.slug})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], self.published_product.title)
        self.assertEqual(response.data["slug"], self.published_product.slug)
        self.assertFalse(response.data["is_wishlisted"])

    def test_authenticated_user_sees_wishlist_state_on_product_detail(self):
        Wishlist.objects.create(user=self.buyer, product=self.published_product)
        self.authenticate(self.buyer)

        url = reverse("products:product-detail", kwargs={"slug": self.published_product.slug})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_wishlisted"])

    def test_public_cannot_retrieve_draft_product_detail(self):
        url = reverse("products:product-detail", kwargs={"slug": self.draft_product.slug})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_authenticated_user_can_add_product_to_wishlist(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.wishlist_url,
            {"product_id": self.published_product.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Wishlist.objects.filter(user=self.buyer, product=self.published_product).exists())
        self.assertEqual(response.data["product"]["id"], self.published_product.id)
        self.assertTrue(response.data["product"]["is_wishlisted"])

    def test_authenticated_user_cannot_add_duplicate_product_to_wishlist(self):
        Wishlist.objects.create(user=self.buyer, product=self.published_product)
        self.authenticate(self.buyer)

        response = self.client.post(
            self.wishlist_url,
            {"product_id": self.published_product.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.data)

    def test_authenticated_user_can_list_their_wishlist(self):
        Wishlist.objects.create(user=self.buyer, product=self.published_product)
        Wishlist.objects.create(user=self.buyer, product=self.other_seller_product)
        Wishlist.objects.create(user=self.seller_user, product=self.published_product)
        self.authenticate(self.buyer)

        response = self.client.get(self.wishlist_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self.extract_results(response)
        self.assertEqual(len(results), 2)
        product_ids = {item["product"]["id"] for item in results}
        self.assertIn(self.published_product.id, product_ids)
        self.assertIn(self.other_seller_product.id, product_ids)

    def test_wishlist_hides_products_that_are_no_longer_publicly_visible(self):
        Wishlist.objects.create(user=self.buyer, product=self.other_seller_draft)
        self.authenticate(self.buyer)

        response = self.client.get(self.wishlist_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self.extract_results(response)
        self.assertEqual(results, [])

    def test_authenticated_user_can_remove_product_from_wishlist(self):
        Wishlist.objects.create(user=self.buyer, product=self.published_product)
        self.authenticate(self.buyer)
        url = reverse("products:wishlist-detail", kwargs={"product_id": self.published_product.id})

        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Wishlist.objects.filter(user=self.buyer, product=self.published_product).exists())

    def test_removing_missing_wishlist_product_returns_not_found(self):
        self.authenticate(self.buyer)
        url = reverse("products:wishlist-detail", kwargs={"product_id": self.published_product.id})

        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_authenticated_user_can_toggle_wishlist_on_and_off(self):
        self.authenticate(self.buyer)

        add_response = self.client.post(
            self.wishlist_toggle_url,
            {"product_id": self.published_product.id},
            format="json",
        )
        self.assertEqual(add_response.status_code, status.HTTP_200_OK)
        self.assertTrue(add_response.data["is_wishlisted"])
        self.assertTrue(Wishlist.objects.filter(user=self.buyer, product=self.published_product).exists())

        remove_response = self.client.post(
            self.wishlist_toggle_url,
            {"product_id": self.published_product.id},
            format="json",
        )
        self.assertEqual(remove_response.status_code, status.HTTP_200_OK)
        self.assertFalse(remove_response.data["is_wishlisted"])
        self.assertFalse(Wishlist.objects.filter(user=self.buyer, product=self.published_product).exists())

    def test_public_cannot_list_images_for_draft_product(self):
        image = ProductImage.objects.create(
            product=self.draft_product,
            image=self.generate_test_image("draft-image.jpg"),
            alt_text="Draft image",
            order=1,
            is_primary=True,
        )
        url = reverse("products:product-image-list-create", kwargs={"product_pk": self.draft_product.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(ProductImage.objects.filter(pk=image.pk).exists())

    def test_public_cannot_retrieve_variant_for_draft_product(self):
        variant = ProductVariant.objects.create(
            product=self.draft_product,
            sku="DRAFT-001-VAR",
            attributes={"color": "Gray"},
            stock=1,
            price=Decimal("10500.00"),
        )
        url = reverse(
            "products:product-variant-detail",
            kwargs={"product_pk": self.draft_product.id, "pk": variant.id},
        )
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_owner_can_retrieve_own_draft_product_detail(self):
        self.authenticate(self.seller_user)
        url = reverse("products:product-detail", kwargs={"slug": self.draft_product.slug})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["slug"], self.draft_product.slug)

    def test_other_seller_cannot_retrieve_another_sellers_draft(self):
        self.authenticate(self.other_seller_user)
        url = reverse("products:product-detail", kwargs={"slug": self.draft_product.slug})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_staff_can_retrieve_any_draft_product(self):
        self.authenticate(self.admin_user)
        url = reverse("products:product-detail", kwargs={"slug": self.draft_product.slug})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_seller_can_create_product(self):
        self.authenticate(self.seller_user)
        payload = self.product_payload()

        response = self.client.post(self.product_list_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Product.objects.filter(sku="MAC-001").exists())

        product = Product.objects.get(sku="MAC-001")
        self.assertEqual(product.seller, self.seller_profile)
        self.assertEqual(product.currency, "NGN")
        self.assertEqual(product.title, "MacBook Pro")
        self.assertEqual(product.tags.count(), 1)

    def test_buyer_cannot_create_product(self):
        self.authenticate(self.buyer)
        payload = self.product_payload(sku="MAC-002")

        response = self.client.post(self.product_list_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_create_product(self):
        payload = self.product_payload(sku="MAC-003")
        response = self.client.post(self.product_list_url, payload, format="json")

        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_seller_can_update_own_product(self):
        self.authenticate(self.seller_user)
        url = reverse("products:product-detail", kwargs={"slug": self.published_product.slug})

        response = self.client.patch(url, {"price": "470000.00", "stock": 3}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.published_product.refresh_from_db()
        self.assertEqual(self.published_product.price, Decimal("470000.00"))
        self.assertEqual(self.published_product.stock, 3)

    def test_buyer_cannot_update_product(self):
        self.authenticate(self.buyer)
        url = reverse("products:product-detail", kwargs={"slug": self.published_product.slug})

        response = self.client.patch(url, {"price": "440000.00"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_seller_cannot_update_another_sellers_product(self):
        self.authenticate(self.seller_user)
        url = reverse("products:product-detail", kwargs={"slug": self.other_seller_product.slug})

        response = self.client.patch(url, {"price": "340000.00"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_seller_can_delete_own_product(self):
        self.authenticate(self.seller_user)
        product = Product.objects.create(
            seller=self.seller_profile,
            category=self.category,
            title="Delete Me",
            description="Delete this product",
            price=Decimal("1000.00"),
            currency="NGN",
            sku="DELETE-001",
            stock=1,
            status=Product.STATUS_PUBLISHED,
        )
        url = reverse("products:product-detail", kwargs={"slug": product.slug})

        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Product.objects.filter(id=product.id).exists())

    def test_other_seller_cannot_delete_another_sellers_product(self):
        self.authenticate(self.other_seller_user)
        url = reverse("products:product-detail", kwargs={"slug": self.published_product.slug})

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_product_filter_by_seller_business_name(self):
        response = self.client.get(self.product_list_url, {"seller": "Seller One"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in self.extract_results(response)]
        self.assertIn(self.published_product.title, titles)
        self.assertNotIn(self.other_seller_product.title, titles)

    def test_product_filter_by_seller_id(self):
        response = self.client.get(self.product_list_url, {"seller": str(self.seller_profile.id)})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in self.extract_results(response)]
        self.assertIn(self.published_product.title, titles)
        self.assertNotIn(self.other_seller_product.title, titles)

    def test_product_filter_by_category_slug(self):
        response = self.client.get(self.product_list_url, {"category": self.category.slug})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in self.extract_results(response)]
        self.assertIn(self.published_product.title, titles)

    def test_product_filter_by_category_id(self):
        response = self.client.get(self.product_list_url, {"category": self.category.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in self.extract_results(response)]
        self.assertIn(self.published_product.title, titles)

    def test_product_filter_by_min_price(self):
        response = self.client.get(self.product_list_url, {"min_price": "400000"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in self.extract_results(response)]
        self.assertIn(self.published_product.title, titles)
        self.assertNotIn(self.other_seller_product.title, titles)

    def test_product_filter_by_max_price(self):
        response = self.client.get(self.product_list_url, {"max_price": "400000"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in self.extract_results(response)]
        self.assertIn(self.other_seller_product.title, titles)
        self.assertNotIn(self.published_product.title, titles)

    def test_product_filter_by_in_stock(self):
        self.other_seller_product.stock = 0
        self.other_seller_product.save(update_fields=["stock"])

        response = self.client.get(self.product_list_url, {"in_stock": "true"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in self.extract_results(response)]
        self.assertIn(self.published_product.title, titles)
        self.assertNotIn(self.other_seller_product.title, titles)

    def test_product_filter_by_out_of_stock(self):
        self.other_seller_product.stock = 0
        self.other_seller_product.save(update_fields=["stock"])

        response = self.client.get(self.product_list_url, {"in_stock": "false"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in self.extract_results(response)]
        self.assertIn(self.other_seller_product.title, titles)
        self.assertNotIn(self.published_product.title, titles)

    def test_product_ordering_by_price(self):
        response = self.client.get(self.product_list_url, {"ordering": "price"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self.extract_results(response)
        prices = [Decimal(str(item["price"])) for item in results]
        self.assertEqual(prices, sorted(prices))

    def test_invalid_ordering_falls_back_safely(self):
        response = self.client.get(self.product_list_url, {"ordering": "invalid_field"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_public_status_filter_does_not_expose_drafts(self):
        response = self.client.get(self.product_list_url, {"status": Product.STATUS_DRAFT})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in self.extract_results(response)]
        self.assertNotIn(self.draft_product.title, titles)

    def test_seller_status_filter_can_include_own_draft(self):
        self.authenticate(self.seller_user)
        response = self.client.get(self.product_list_url, {"status": Product.STATUS_DRAFT})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in self.extract_results(response)]
        self.assertIn(self.draft_product.title, titles)
        self.assertIn(self.published_product.title, titles)

    def test_staff_status_filter_can_target_drafts(self):
        self.authenticate(self.admin_user)
        response = self.client.get(self.product_list_url, {"status": Product.STATUS_DRAFT})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in self.extract_results(response)]
        self.assertIn(self.draft_product.title, titles)
        self.assertIn(self.other_seller_draft.title, titles)

    def test_product_search_works(self):
        response = self.client.get(self.product_list_url, {"q": "Dell"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in self.extract_results(response)]
        self.assertIn(self.published_product.title, titles)

    def test_invalid_currency_is_rejected(self):
        self.authenticate(self.seller_user)
        payload = self.product_payload(sku="MAC-004", currency="ABC")

        response = self.client.post(self.product_list_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("currency", response.data)

    def test_short_title_is_rejected(self):
        self.authenticate(self.seller_user)
        payload = self.product_payload(sku="MAC-005", title="hp")

        response = self.client.post(self.product_list_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.data)

    def test_compare_price_less_than_price_is_rejected(self):
        self.authenticate(self.seller_user)
        payload = self.product_payload(sku="MAC-006", price="10000.00", compare_price="9000.00")

        response = self.client.post(self.product_list_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("compare_price", response.data)

    def test_inactive_category_is_rejected(self):
        self.authenticate(self.seller_user)
        payload = self.product_payload(sku="MAC-007", category=self.inactive_category.id)

        response = self.client.post(self.product_list_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", response.data)

    def test_negative_stock_is_rejected(self):
        self.authenticate(self.seller_user)
        payload = self.product_payload(sku="MAC-008", stock=-1)

        response = self.client.post(self.product_list_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("stock", response.data)

    def test_published_product_requires_description(self):
        self.authenticate(self.seller_user)
        payload = self.product_payload(sku="MAC-009", description="", status=Product.STATUS_PUBLISHED)

        response = self.client.post(self.product_list_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("description", response.data)

    def test_attributes_must_be_json_object(self):
        self.authenticate(self.seller_user)
        payload = self.product_payload(sku="MAC-010", attributes="not-a-dict")

        response = self.client.post(self.product_list_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("attributes", response.data)

    def test_dimensions_must_be_json_object(self):
        self.authenticate(self.seller_user)
        payload = self.product_payload(sku="MAC-011", dimensions="not-a-dict")

        response = self.client.post(self.product_list_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("dimensions", response.data)

    def test_product_create_sets_tags_from_tag_ids(self):
        self.authenticate(self.seller_user)
        payload = self.product_payload(sku="MAC-012", tag_ids=[self.tag.id, self.tag2.id])

        response = self.client.post(self.product_list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        product = Product.objects.get(sku="MAC-012")
        self.assertEqual(product.tags.count(), 2)

    def test_product_update_replaces_tags_from_tag_ids(self):
        self.authenticate(self.seller_user)
        url = reverse("products:product-detail", kwargs={"slug": self.published_product.slug})

        response = self.client.patch(url, {"tag_ids": [self.tag2.id]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.published_product.refresh_from_db()
        self.assertEqual(list(self.published_product.tags.values_list("id", flat=True)), [self.tag2.id])

    # -----------------------------
    # PRODUCT IMAGES
    # -----------------------------

    def test_public_can_list_product_images(self):
        url = reverse("products:product-image-list-create", kwargs={"product_pk": self.published_product.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self.extract_results(response)
        self.assertGreaterEqual(len(results), 1)

    def test_public_can_retrieve_product_image(self):
        url = reverse(
            "products:product-image-detail",
            kwargs={"product_pk": self.published_product.id, "pk": self.product_image.id},
        )
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.product_image.id)

    def test_owner_can_upload_product_image(self):
        self.authenticate(self.seller_user)
        url = reverse("products:product-image-list-create", kwargs={"product_pk": self.published_product.id})

        payload = {
            "image": self.generate_test_image(),
            "alt_text": "Laptop front image",
            "order": 1,
            "is_primary": True,
        }

        response = self.client.post(url, payload, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.published_product.images.count(), 2)

    def test_non_owner_cannot_upload_product_image(self):
        self.authenticate(self.other_seller_user)
        url = reverse("products:product-image-list-create", kwargs={"product_pk": self.published_product.id})

        payload = {
            "image": self.generate_test_image("forbidden.jpg"),
            "alt_text": "Forbidden upload",
            "order": 1,
            "is_primary": True,
        }

        response = self.client.post(url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_only_one_primary_image_per_product(self):
        self.authenticate(self.seller_user)
        url = reverse("products:product-image-list-create", kwargs={"product_pk": self.published_product.id})

        first_response = self.client.post(
            url,
            {
                "image": self.generate_test_image("img1.jpg"),
                "alt_text": "First image",
                "order": 1,
                "is_primary": True,
            },
            format="multipart",
        )
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)

        second_response = self.client.post(
            url,
            {
                "image": self.generate_test_image("img2.jpg"),
                "alt_text": "Second image",
                "order": 2,
                "is_primary": True,
            },
            format="multipart",
        )
        self.assertEqual(second_response.status_code, status.HTTP_201_CREATED)

        primary_images_count = ProductImage.objects.filter(product=self.published_product, is_primary=True).count()
        self.assertEqual(primary_images_count, 1)

    def test_owner_can_update_product_image(self):
        self.authenticate(self.seller_user)
        url = reverse(
            "products:product-image-detail",
            kwargs={"product_pk": self.published_product.id, "pk": self.product_image.id},
        )

        response = self.client.patch(url, {"alt_text": "Updated alt text"}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.product_image.refresh_from_db()
        self.assertEqual(self.product_image.alt_text, "Updated alt text")

    def test_non_owner_cannot_update_product_image(self):
        self.authenticate(self.other_seller_user)
        url = reverse(
            "products:product-image-detail",
            kwargs={"product_pk": self.published_product.id, "pk": self.product_image.id},
        )

        response = self.client.patch(url, {"alt_text": "Blocked"}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_delete_product_image(self):
        self.authenticate(self.seller_user)
        image = ProductImage.objects.create(
            product=self.published_product,
            image=self.generate_test_image("delete-image.jpg"),
            alt_text="Delete me",
            order=10,
            is_primary=False,
        )

        url = reverse(
            "products:product-image-detail",
            kwargs={"product_pk": self.published_product.id, "pk": image.id},
        )

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ProductImage.objects.filter(id=image.id).exists())

    def test_non_owner_cannot_delete_product_image(self):
        self.authenticate(self.other_seller_user)
        url = reverse(
            "products:product-image-detail",
            kwargs={"product_pk": self.published_product.id, "pk": self.product_image.id},
        )

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -----------------------------
    # PRODUCT VARIANTS
    # -----------------------------

    def test_public_can_list_variants(self):
        url = reverse("products:product-variant-list-create", kwargs={"product_pk": self.published_product.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self.extract_results(response)
        self.assertGreaterEqual(len(results), 1)

    def test_public_can_retrieve_variant(self):
        url = reverse(
            "products:product-variant-detail",
            kwargs={"product_pk": self.published_product.id, "pk": self.variant.id},
        )
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.variant.id)

    def test_owner_can_create_variant(self):
        self.authenticate(self.seller_user)
        url = reverse("products:product-variant-list-create", kwargs={"product_pk": self.published_product.id})

        payload = {
            "sku": "DELL-001-WHITE",
            "attributes": {"color": "White", "storage": "512GB"},
            "stock": 4,
            "price": "465000.00",
        }

        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(ProductVariant.objects.filter(sku="DELL-001-WHITE").exists())

    def test_non_owner_cannot_create_variant(self):
        self.authenticate(self.other_seller_user)
        url = reverse("products:product-variant-list-create", kwargs={"product_pk": self.published_product.id})

        payload = {
            "sku": "DELL-001-WHITE2",
            "attributes": {"color": "White"},
            "stock": 2,
            "price": "450000.00",
        }

        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_update_variant(self):
        self.authenticate(self.seller_user)
        url = reverse(
            "products:product-variant-detail",
            kwargs={"product_pk": self.published_product.id, "pk": self.variant.id},
        )

        response = self.client.patch(url, {"stock": 8, "price": "470000.00"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 8)
        self.assertEqual(self.variant.price, Decimal("470000.00"))

    def test_non_owner_cannot_update_variant(self):
        self.authenticate(self.other_seller_user)
        url = reverse(
            "products:product-variant-detail",
            kwargs={"product_pk": self.published_product.id, "pk": self.variant.id},
        )

        response = self.client.patch(url, {"stock": 99}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_negative_variant_stock_is_rejected(self):
        self.authenticate(self.seller_user)
        url = reverse(
            "products:product-variant-detail",
            kwargs={"product_pk": self.published_product.id, "pk": self.variant.id},
        )

        response = self.client.patch(url, {"stock": -5}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("stock", response.data)

    def test_owner_can_delete_variant(self):
        self.authenticate(self.seller_user)
        variant = ProductVariant.objects.create(
            product=self.published_product,
            sku="DELL-DELETE-001",
            attributes={"color": "Green"},
            stock=1,
            price=Decimal("430000.00"),
        )

        url = reverse(
            "products:product-variant-detail",
            kwargs={"product_pk": self.published_product.id, "pk": variant.id},
        )

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ProductVariant.objects.filter(id=variant.id).exists())

    def test_non_owner_cannot_delete_variant(self):
        self.authenticate(self.other_seller_user)
        url = reverse(
            "products:product-variant-detail",
            kwargs={"product_pk": self.published_product.id, "pk": self.variant.id},
        )

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -----------------------------
    # CATEGORIES
    # -----------------------------

    def test_public_can_list_categories(self):
        response = self.client.get(self.category_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [item["name"] for item in self.extract_results(response)]
        self.assertIn(self.category.name, names)
        self.assertIn(self.parent_category.name, names)
        self.assertNotIn(self.inactive_category.name, names)

    def test_public_can_retrieve_active_category_detail(self):
        url = reverse("products:category-detail", kwargs={"slug": self.category.slug})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["slug"], self.category.slug)

    def test_public_cannot_retrieve_inactive_category_detail(self):
        url = reverse("products:category-detail", kwargs={"slug": self.inactive_category.slug})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_seller_can_create_category(self):
        self.authenticate(self.seller_user)

        response = self.client.post(
            self.category_list_url,
            {
                "name": "Accessories",
                "description": "Accessories items",
                "parent": self.parent_category.id,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Category.objects.filter(name="Accessories").exists())

    def test_buyer_cannot_create_category(self):
        self.authenticate(self.buyer)

        response = self.client.post(
            self.category_list_url,
            {
                "name": "Blocked Category",
                "description": "No access",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_update_category(self):
        self.authenticate(self.admin_user)
        url = reverse("products:category-detail", kwargs={"slug": self.category.slug})

        response = self.client.patch(url, {"description": "Updated category"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.category.refresh_from_db()
        self.assertEqual(self.category.description, "Updated category")

    def test_admin_can_delete_category(self):
        self.authenticate(self.admin_user)
        category = Category.objects.create(name="Delete Category", is_active=True)
        url = reverse("products:category-detail", kwargs={"slug": category.slug})

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Category.objects.filter(id=category.id).exists())

    def test_category_cannot_be_its_own_parent(self):
        self.authenticate(self.admin_user)
        url = reverse("products:category-detail", kwargs={"slug": self.category.slug})

        response = self.client.patch(url, {"parent": self.category.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("parent", response.data)

    # -----------------------------
    # TAGS
    # -----------------------------

    def test_public_can_list_tags(self):
        response = self.client.get(self.tag_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [item["name"] for item in self.extract_results(response)]
        self.assertIn(self.tag.name, names)

    def test_public_can_retrieve_tag_detail(self):
        url = reverse("products:tag-detail", kwargs={"slug": self.tag.slug})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["slug"], self.tag.slug)

    def test_seller_can_create_tag(self):
        self.authenticate(self.seller_user)

        response = self.client.post(
            self.tag_list_url,
            {"name": "On Sale"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Tag.objects.filter(name="On Sale").exists())

    def test_buyer_cannot_create_tag(self):
        self.authenticate(self.buyer)

        response = self.client.post(self.tag_list_url, {"name": "Blocked Tag"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_update_tag(self):
        self.authenticate(self.admin_user)
        url = reverse("products:tag-detail", kwargs={"slug": self.tag.slug})

        response = self.client.patch(url, {"name": "Updated Tag Name"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.tag.refresh_from_db()
        self.assertEqual(self.tag.name, "Updated Tag Name")

    def test_admin_can_delete_tag(self):
        self.authenticate(self.admin_user)
        tag = Tag.objects.create(name="Delete Tag")
        url = reverse("products:tag-detail", kwargs={"slug": tag.slug})

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Tag.objects.filter(id=tag.id).exists())
