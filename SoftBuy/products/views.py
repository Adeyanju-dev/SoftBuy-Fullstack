from django.db.models import Avg, Count, Exists, OuterRef, Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework import serializers as drf_serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category, Product, ProductImage, ProductVariant, Tag, Wishlist
from .serializers import (
    CategorySerializer,
    ProductCreateUpdateSerializer,
    ProductDetailSerializer,
    ProductImageSerializer,
    ProductListSerializer,
    ProductVariantSerializer,
    TagSerializer,
    WishlistMessageSerializer,
    WishlistSerializer,
    WishlistToggleResponseSerializer,
)
from drf_spectacular.utils import extend_schema


def filter_product_queryset_for_request(queryset, request):
    user = request.user

    if user.is_authenticated and getattr(user, "is_staff", False):
        return queryset

    seller_profile = getattr(user, "seller_profile", None)
    if seller_profile:
        return queryset.filter(
            Q(status=Product.STATUS_PUBLISHED) | Q(seller=seller_profile)
        ).distinct()

    return queryset.filter(status=Product.STATUS_PUBLISHED)


class IsSeller(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "is_seller", False)
            and hasattr(request.user, "seller_profile")
        )


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        seller_profile = getattr(request.user, "seller_profile", None)
        return seller_profile is not None and getattr(obj, "seller", None) == seller_profile


class CategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = CategorySerializer

    def get_queryset(self):
        queryset = Category.objects.select_related("parent").prefetch_related("children")
        if self.request.method in permissions.SAFE_METHODS:
            return queryset.filter(is_active=True)
        return queryset

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsSeller()]


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CategorySerializer
    lookup_field = "slug"

    def get_queryset(self):
        queryset = Category.objects.select_related("parent").prefetch_related("children")
        if self.request.method in permissions.SAFE_METHODS:
            return queryset.filter(is_active=True)
        return queryset

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]


class ProductQuerysetMixin:
    def get_base_queryset(self):
        queryset = (
            Product.objects.select_related("seller__user", "category")
            .prefetch_related(
                Prefetch(
                    "images",
                    queryset=ProductImage.objects.only(
                        "id",
                        "product_id",
                        "image",
                        "alt_text",
                        "order",
                        "is_primary",
                        "created_at",
                    ).order_by("order", "created_at"),
                    to_attr="prefetched_images",
                ),
                "variants",
                Prefetch("tags", queryset=Tag.objects.only("id", "name", "slug")),
            )
            .annotate(
                average_rating=Avg(
                    "reviews__rating",
                    filter=Q(reviews__is_approved=True),
                ),
                review_count=Count(
                    "reviews",
                    filter=Q(reviews__is_approved=True),
                    distinct=True,
                ),
            )
        )
        user = getattr(self.request, "user", None)
        if user and user.is_authenticated:
            wishlist_subquery = Wishlist.objects.filter(user=user, product=OuterRef("pk"))
            queryset = queryset.annotate(is_wishlisted=Exists(wishlist_subquery))
        return queryset


class ProductListCreateView(ProductQuerysetMixin, generics.ListCreateAPIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsSeller()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ProductCreateUpdateSerializer
        return ProductListSerializer

    def get_queryset(self):
        queryset = self.get_base_queryset()

        q = self.request.query_params.get("q")
        category = self.request.query_params.get("category")
        status_param = self.request.query_params.get("status")
        seller = self.request.query_params.get("seller")
        min_price = self.request.query_params.get("min_price")
        max_price = self.request.query_params.get("max_price")
        ordering = self.request.query_params.get("ordering", "-created_at")

        user = self.request.user
        is_staff = user.is_authenticated and getattr(user, "is_staff", False)
        seller_profile = getattr(user, "seller_profile", None)

        # visibility rules
        if self.request.method in permissions.SAFE_METHODS:
            queryset = filter_product_queryset_for_request(queryset, self.request)

        # search
        if q:
            queryset = queryset.filter(
                Q(title__icontains=q)
                | Q(description__icontains=q)
                | Q(sku__icontains=q)
                | Q(tags__name__icontains=q)
            ).distinct()

        # category filter
        if category:
            if str(category).isdigit():
                queryset = queryset.filter(category__id=int(category))
            else:
                queryset = queryset.filter(category__slug=category)

        # status filter
        if status_param:
            if is_staff:
                queryset = queryset.filter(status=status_param)
            elif seller_profile:
                queryset = queryset.filter(
                    Q(status=Product.STATUS_PUBLISHED) |
                    Q(status=status_param, seller=seller_profile)
                ).distinct()
            else:
                queryset = queryset.filter(status=Product.STATUS_PUBLISHED)

        # seller filter
        if seller:
            seller_query = (
                Q(seller__business_name__icontains=seller)
                | Q(seller__user__email__icontains=seller)
            )

            if str(seller).isdigit():
                seller_query |= Q(seller__id=int(seller))

            queryset = queryset.filter(seller_query)

        # price filters
        if min_price:
            queryset = queryset.filter(price__gte=min_price)

        if max_price:
            queryset = queryset.filter(price__lte=max_price)

        allowed_ordering = {"created_at", "-created_at", "price", "-price", "title", "-title"}
        if ordering not in allowed_ordering:
            ordering = "-created_at"

        return queryset.order_by(ordering).distinct()

    def perform_create(self, serializer):
        seller_profile = self.request.user.seller_profile
        serializer.save(seller=seller_profile)

class ProductDetailView(ProductQuerysetMixin, generics.RetrieveUpdateDestroyAPIView):
    lookup_field = "slug"

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsOwnerOrReadOnly()]

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return ProductCreateUpdateSerializer
        return ProductDetailSerializer

    def get_queryset(self):
        queryset = self.get_base_queryset()
        return filter_product_queryset_for_request(queryset, self.request)

    def perform_update(self, serializer):
        serializer.save(seller=self.request.user.seller_profile)


class ProductImageListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductImageSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsSeller()]

    def get_readable_product(self):
        queryset = filter_product_queryset_for_request(Product.objects.all(), self.request)
        return get_object_or_404(queryset, pk=self.kwargs["product_pk"])

    def get_product(self):
        product = get_object_or_404(Product, pk=self.kwargs["product_pk"])
        if self.request.method != "GET":
            seller_profile = getattr(self.request.user, "seller_profile", None)
            if seller_profile != product.seller:
                raise PermissionDenied("Only the product owner may manage product images.")
        return product

    def get_queryset(self):
        product = self.get_readable_product() if self.request.method == "GET" else self.get_product()
        return product.images.all()

    def perform_create(self, serializer):
        product = self.get_product()
        serializer.save(product=product)


class ProductImageDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProductImageSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsSeller()]

    def get_queryset(self):
        if self.request.method == "GET":
            product = get_object_or_404(
                filter_product_queryset_for_request(Product.objects.all(), self.request),
                pk=self.kwargs["product_pk"],
            )
        else:
            product = get_object_or_404(Product, pk=self.kwargs["product_pk"])
        return product.images.all()

    def perform_update(self, serializer):
        instance = self.get_object()
        seller_profile = getattr(self.request.user, "seller_profile", None)
        if seller_profile != instance.product.seller:
            raise PermissionDenied("Only the product owner may update product images.")
        serializer.save()

    def perform_destroy(self, instance):
        seller_profile = getattr(self.request.user, "seller_profile", None)
        if seller_profile != instance.product.seller:
            raise PermissionDenied("Only the product owner may delete product images.")
        instance.delete()


class ProductVariantListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductVariantSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsSeller()]

    def get_readable_product(self):
        queryset = filter_product_queryset_for_request(Product.objects.all(), self.request)
        return get_object_or_404(queryset, pk=self.kwargs["product_pk"])

    def get_product(self):
        product = get_object_or_404(Product, pk=self.kwargs["product_pk"])
        if self.request.method != "GET":
            seller_profile = getattr(self.request.user, "seller_profile", None)
            if seller_profile != product.seller:
                raise PermissionDenied("Only the product owner may manage product variants.")
        return product

    def get_queryset(self):
        product = self.get_readable_product() if self.request.method == "GET" else self.get_product()
        return product.variants.all()

    def perform_create(self, serializer):
        product = self.get_product()
        serializer.save(product=product)


class ProductVariantDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProductVariantSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsSeller()]

    def get_queryset(self):
        if self.request.method == "GET":
            product = get_object_or_404(
                filter_product_queryset_for_request(Product.objects.all(), self.request),
                pk=self.kwargs["product_pk"],
            )
        else:
            product = get_object_or_404(Product, pk=self.kwargs["product_pk"])
        return product.variants.all()

    def perform_update(self, serializer):
        instance = self.get_object()
        seller_profile = getattr(self.request.user, "seller_profile", None)
        if seller_profile != instance.product.seller:
            raise PermissionDenied("Only the product owner may update product variants.")
        serializer.save()

    def perform_destroy(self, instance):
        seller_profile = getattr(self.request.user, "seller_profile", None)
        if seller_profile != instance.product.seller:
            raise PermissionDenied("Only the product owner may delete product variants.")
        instance.delete()


class TagListCreateView(generics.ListCreateAPIView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsSeller()]


class TagDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    lookup_field = "slug"

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]


class WishlistListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WishlistSerializer

    def get_queryset(self):
        readable_products = filter_product_queryset_for_request(
            Product.objects.select_related("seller__user", "category").prefetch_related(
                Prefetch(
                    "images",
                    queryset=ProductImage.objects.only(
                        "id",
                        "product_id",
                        "image",
                        "alt_text",
                        "order",
                        "is_primary",
                        "created_at",
                    ).order_by("order", "created_at"),
                    to_attr="prefetched_images",
                )
            ),
            self.request,
        )
        wishlist_subquery = Wishlist.objects.filter(user=self.request.user, product=OuterRef("pk"))
        readable_products = readable_products.annotate(is_wishlisted=Exists(wishlist_subquery))

        return (
            Wishlist.objects.filter(user=self.request.user, product__in=readable_products)
            .select_related("product", "product__seller__user", "product__category")
            .prefetch_related(
                Prefetch(
                    "product__images",
                    queryset=ProductImage.objects.only(
                        "id",
                        "product_id",
                        "image",
                        "alt_text",
                        "order",
                        "is_primary",
                        "created_at",
                    ).order_by("order", "created_at"),
                    to_attr="prefetched_images",
                )
            )
            .order_by("-created_at")
        )

    @extend_schema(
        request=WishlistSerializer,
        responses={201: WishlistSerializer, 400: WishlistMessageSerializer},
        tags=["Wishlist"],
        summary="Add a product to the current user's wishlist",
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product_id = serializer.validated_data["product_id"]
        product = get_object_or_404(
            filter_product_queryset_for_request(Product.objects.all(), request),
            pk=product_id,
        )

        wishlist_item, created = Wishlist.objects.get_or_create(
            user=request.user,
            product=product,
        )

        if not created:
            raise drf_serializers.ValidationError(
                {"message": "This product is already in your wishlist."}
            )

        response_serializer = self.get_serializer(wishlist_item)
        return Response(response_serializer.data, status=201)


class WishlistDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses={200: WishlistMessageSerializer, 404: WishlistMessageSerializer},
        tags=["Wishlist"],
        summary="Remove a product from the current user's wishlist",
    )
    def delete(self, request, product_id):
        wishlist_item = Wishlist.objects.filter(
            user=request.user,
            product_id=product_id,
        ).first()

        if not wishlist_item:
            return Response(
                {"message": "The product was not found in your wishlist."},
                status=404,
            )

        wishlist_item.delete()
        return Response(
            {"message": "The product was removed from your wishlist successfully."},
            status=200,
        )


class WishlistToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=WishlistSerializer,
        responses={200: WishlistToggleResponseSerializer, 400: WishlistMessageSerializer},
        tags=["Wishlist"],
        summary="Toggle a product in the current user's wishlist",
    )
    def post(self, request):
        serializer = WishlistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product_id = serializer.validated_data["product_id"]
        product = get_object_or_404(
            filter_product_queryset_for_request(Product.objects.all(), request),
            pk=product_id,
        )

        wishlist_item = Wishlist.objects.filter(user=request.user, product=product).first()
        if wishlist_item:
            wishlist_item.delete()
            return Response(
                {
                    "message": "The product was removed from your wishlist successfully.",
                    "is_wishlisted": False,
                },
                status=200,
            )

        Wishlist.objects.create(user=request.user, product=product)
        return Response(
            {
                "message": "The product was added to your wishlist successfully.",
                "is_wishlisted": True,
            },
            status=200,
        )
