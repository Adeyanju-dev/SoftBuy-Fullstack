from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from .models import Category, Product, ProductImage, ProductVariant, Tag, Wishlist


class RecursiveCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]


class CategorySerializer(serializers.ModelSerializer):
    children = RecursiveCategorySerializer(many=True, read_only=True)

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "parent",
            "children",
            "image",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["slug", "created_at", "updated_at"]

    def validate_parent(self, value):
        if self.instance and value and self.instance.pk == value.pk:
            raise serializers.ValidationError("A category cannot be its own parent.")

        ancestor = value
        while self.instance and ancestor is not None:
            if ancestor.pk == self.instance.pk:
                raise serializers.ValidationError(
                    "A category cannot be assigned to one of its descendants."
                )
            ancestor = ancestor.parent
        return value


class ProductImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ProductImage
        fields = [
            "id",
            "product",
            "image",
            "image_url",
            "alt_text",
            "order",
            "is_primary",
            "created_at",
        ]
        read_only_fields = ["product", "created_at", "image_url"]

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and hasattr(obj.image, "url"):
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = [
            "id",
            "product",
            "sku",
            "attributes",
            "stock",
            "price",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["product", "created_at", "updated_at"]

    def validate_stock(self, value):
        if value < 0:
            raise serializers.ValidationError("Stock cannot be negative.")
        return value


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug", "created_at"]
        read_only_fields = ["slug", "created_at"]


class ProductListSerializer(serializers.ModelSerializer):
    primary_image = serializers.SerializerMethodField()
    seller_business_name = serializers.CharField(source="seller.business_name", read_only=True)
    seller_verified = serializers.BooleanField(source="seller.verified", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    average_rating = serializers.FloatField(read_only=True)
    review_count = serializers.IntegerField(read_only=True)
    is_in_stock = serializers.BooleanField(read_only=True)
    is_wishlisted = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "title",
            "slug",
            "price",
            "compare_price",
            "currency",
            "stock",
            "is_in_stock",
            "status",
            "primary_image",
            "seller_business_name",
            "seller_verified",
            "category",
            "category_name",
            "average_rating",
            "review_count",
            "is_wishlisted",
            "created_at",
        ]

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_primary_image(self, obj):
        prefetched_images = list(getattr(obj, "prefetched_images", obj.images.all()))
        primary = next((image for image in prefetched_images if image.is_primary), None)
        image = primary or (prefetched_images[0] if prefetched_images else None)

        if image and image.image and hasattr(image.image, "url"):
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(image.image.url)
            return image.image.url
        return None

    @extend_schema_field(serializers.BooleanField())
    def get_is_wishlisted(self, obj):
        annotated = getattr(obj, "is_wishlisted", None)
        if annotated is not None:
            return bool(annotated)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.wishlisted_by.filter(user=request.user).exists()
        return False


class ProductDetailSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    seller_business_name = serializers.CharField(source="seller.business_name", read_only=True)
    seller_verified = serializers.BooleanField(source="seller.verified", read_only=True)
    seller_id = serializers.IntegerField(source="seller.id", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    average_rating = serializers.FloatField(read_only=True)
    review_count = serializers.IntegerField(read_only=True)
    tag_names = serializers.SerializerMethodField()
    is_in_stock = serializers.BooleanField(read_only=True)
    is_wishlisted = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "seller",
            "seller_id",
            "seller_business_name",
            "seller_verified",
            "category",
            "category_name",
            "title",
            "slug",
            "description",
            "price",
            "compare_price",
            "currency",
            "sku",
            "stock",
            "is_in_stock",
            "status",
            "attributes",
            "dimensions",
            "weight",
            "weight_unit",
            "seo_title",
            "seo_description",
            "tag_names",
            "images",
            "variants",
            "average_rating",
            "review_count",
            "is_wishlisted",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["seller", "slug", "created_at", "updated_at"]

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_tag_names(self, obj):
        prefetched_tags = getattr(obj, "_prefetched_objects_cache", {}).get("tags")
        if prefetched_tags is not None:
            return [tag.name for tag in prefetched_tags]
        return list(obj.tags.values_list("name", flat=True))

    @extend_schema_field(serializers.BooleanField())
    def get_is_wishlisted(self, obj):
        annotated = getattr(obj, "is_wishlisted", None)
        if annotated is not None:
            return bool(annotated)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.wishlisted_by.filter(user=request.user).exists()
        return False

    def validate_title(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Title must be at least 3 characters long.")
        return value

    def validate_stock(self, value):
        if value < 0:
            raise serializers.ValidationError("Stock cannot be negative.")
        return value

    def validate_currency(self, value):
        value = value.upper()
        allowed_currencies = {"NGN", "USD", "GBP", "EUR"}

        if value not in allowed_currencies:
            raise serializers.ValidationError(
                f"Currency must be one of: {', '.join(sorted(allowed_currencies))}."
            )
        return value

    def validate_dimensions(self, value):
        if value in [None, ""]:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Dimensions must be a JSON object.")
        return value

    def validate_attributes(self, value):
        if value in [None, ""]:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Attributes must be a JSON object.")
        return value

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        price = attrs.get("price", getattr(instance, "price", None))
        compare_price = attrs.get("compare_price", getattr(instance, "compare_price", None))
        category = attrs.get("category", getattr(instance, "category", None))
        status = attrs.get("status", getattr(instance, "status", None))

        if compare_price is not None and price is not None and compare_price < price:
            raise serializers.ValidationError(
                {"compare_price": "Compare price must be greater than or equal to price."}
            )

        if category and not category.is_active:
            raise serializers.ValidationError(
                {"category": "You cannot assign an inactive category."}
            )

        if status == Product.STATUS_PUBLISHED and not attrs.get("description", getattr(instance, "description", "")):
            raise serializers.ValidationError(
                {"description": "A published product must have a description."}
            )

        return attrs


class ProductCreateUpdateSerializer(ProductDetailSerializer):
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )

    class Meta(ProductDetailSerializer.Meta):
        fields = ProductDetailSerializer.Meta.fields + ["tag_ids"]

    def create(self, validated_data):
        tag_ids = validated_data.pop("tag_ids", [])
        product = super().create(validated_data)

        if tag_ids:
            product.tags.set(Tag.objects.filter(id__in=tag_ids))
        return product

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop("tag_ids", None)
        product = super().update(instance, validated_data)

        if tag_ids is not None:
            product.tags.set(Tag.objects.filter(id__in=tag_ids))
        return product


class WishlistProductSerializer(serializers.ModelSerializer):
    primary_image = serializers.SerializerMethodField()
    seller_business_name = serializers.CharField(source="seller.business_name", read_only=True)
    seller_verified = serializers.BooleanField(source="seller.verified", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    is_in_stock = serializers.BooleanField(read_only=True)
    is_wishlisted = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "title",
            "slug",
            "price",
            "compare_price",
            "currency",
            "stock",
            "is_in_stock",
            "status",
            "primary_image",
            "seller_business_name",
            "seller_verified",
            "category",
            "category_name",
            "is_wishlisted",
            "created_at",
        ]

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_primary_image(self, obj):
        prefetched_images = list(getattr(obj, "prefetched_images", obj.images.all()))
        primary = next((image for image in prefetched_images if image.is_primary), None)
        image = primary or (prefetched_images[0] if prefetched_images else None)

        if image and image.image and hasattr(image.image, "url"):
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(image.image.url)
            return image.image.url
        return None

    @extend_schema_field(serializers.BooleanField())
    def get_is_wishlisted(self, obj):
        annotated = getattr(obj, "is_wishlisted", None)
        if annotated is not None:
            return bool(annotated)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.wishlisted_by.filter(user=request.user).exists()
        return False


class WishlistSerializer(serializers.ModelSerializer):
    product = WishlistProductSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True, required=True)

    class Meta:
        model = Wishlist
        fields = ["id", "product", "product_id", "created_at"]
        read_only_fields = ["id", "product", "created_at"]


class WishlistMessageSerializer(serializers.Serializer):
    message = serializers.CharField()


class WishlistToggleResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    is_wishlisted = serializers.BooleanField()
