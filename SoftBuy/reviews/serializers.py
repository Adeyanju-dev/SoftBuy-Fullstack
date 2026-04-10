from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from .models import Review, SellerReview, ReviewImage, HelpfulReview


class ReviewImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewImage
        fields = '__all__'
        read_only_fields = ('review', 'created_at')


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField(read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    product_title = serializers.CharField(source='product.title', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    images = ReviewImageSerializer(many=True, read_only=True)
    helpful_count = serializers.IntegerField(read_only=True)
    is_helpful = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = '__all__'
        read_only_fields = (
            'user',
            'product',
            'order',
            'is_verified',
            'helpful_count',
            'created_at',
            'updated_at',
        )

    @extend_schema_field(serializers.CharField())
    def get_user_name(self, obj):
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or obj.user.email

    @extend_schema_field(serializers.BooleanField())
    def get_is_helpful(self, obj):
        annotated_value = getattr(obj, 'is_helpful', None)
        if annotated_value is not None:
            return bool(annotated_value)

        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.helpfulreview_set.filter(user=request.user).exists()
        return False


class SellerReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField(read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    seller_business_name = serializers.CharField(source='seller.business_name', read_only=True)

    class Meta:
        model = SellerReview
        fields = '__all__'
        read_only_fields = ('user', 'seller', 'order', 'created_at', 'updated_at')

    @extend_schema_field(serializers.CharField())
    def get_user_name(self, obj):
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or obj.user.email


class HelpfulReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = HelpfulReview
        fields = '__all__'
        read_only_fields = ('user', 'created_at')


class HelpfulToggleResponseSerializer(serializers.Serializer):
    helpful = serializers.BooleanField()
    helpful_count = serializers.IntegerField()
