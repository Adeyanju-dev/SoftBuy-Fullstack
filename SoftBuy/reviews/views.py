from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction
from django.db.models import Exists, F, OuterRef, Q
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import HelpfulReview, Review, ReviewImage, SellerReview
from .serializers import (
    HelpfulToggleResponseSerializer,
    ReviewImageSerializer,
    ReviewSerializer,
    SellerReviewSerializer,
)
from orders.models import Order
from products.models import Product
from users.models import SellerProfile


def filter_review_queryset_for_request(queryset, request):
    requester = request.user

    if requester.is_authenticated and requester.is_staff:
        return queryset

    seller_profile = getattr(requester, "seller_profile", None) if requester.is_authenticated else None

    public_filter = Q(is_approved=True) | Q(is_verified=True)

    if requester.is_authenticated:
        base_filter = public_filter | Q(user=requester)
        if seller_profile:
            base_filter |= Q(product__seller=seller_profile)
        return queryset.filter(base_filter)

    return queryset.filter(public_filter)


def filter_seller_review_queryset_for_request(queryset, request):
    requester = request.user

    if requester.is_authenticated and requester.is_staff:
        return queryset

    seller_profile = getattr(requester, "seller_profile", None) if requester.is_authenticated else None
    if requester.is_authenticated:
        base_filter = Q(is_approved=True) | Q(user=requester)
        if seller_profile:
            base_filter |= Q(seller=seller_profile)
        return queryset.filter(base_filter)

    return queryset.filter(is_approved=True)


class CanEditOrModerateReview(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        if obj.user == request.user:
            return True

        if request.user and request.user.is_staff:
            return True

        seller_profile = getattr(request.user, "seller_profile", None)
        if not seller_profile:
            return False

        product = getattr(obj, "product", None)
        if product:
            return product.seller == seller_profile

        seller = getattr(obj, "seller", None)
        if seller:
            return seller == seller_profile

        return False


class ReviewListCreateView(generics.ListCreateAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = Review.objects.select_related("user", "product", "product__seller").prefetch_related("images")
        qs = filter_review_queryset_for_request(qs, self.request)
        requester = self.request.user

        if requester.is_authenticated:
            helpful_subquery = HelpfulReview.objects.filter(
                review=OuterRef("pk"),
                user=requester,
            )
            qs = qs.annotate(is_helpful=Exists(helpful_subquery))

        product = self.request.query_params.get("product")
        user = self.request.query_params.get("user")

        if product:
            qs = qs.filter(product__id=product)
        if user:
            qs = qs.filter(user__id=user)

        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        request = self.request
        user = request.user

        product_id = request.data.get("product")
        order_id = request.data.get("order")

        if not product_id or not order_id:
            raise serializers.ValidationError({"detail": "Both product and order are required."})

        product = get_object_or_404(Product, id=product_id)
        order = get_object_or_404(Order, id=order_id)

        if order.buyer != user:
            raise PermissionDenied("You can only review products from your own orders.")

        if not order.items.filter(product=product).exists():
            raise PermissionDenied("The selected order does not include this product.")

        try:
            serializer.save(user=user, product=product, order=order, is_verified=True)
        except IntegrityError:
            raise serializers.ValidationError(
                {"detail": "You have already submitted a review for this product on this order."}
            )


class ReviewDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Review.objects.select_related("user", "product", "product__seller").prefetch_related("images")
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, CanEditOrModerateReview]

    def get_queryset(self):
        qs = filter_review_queryset_for_request(super().get_queryset(), self.request)
        requester = self.request.user
        if requester.is_authenticated:
            helpful_subquery = HelpfulReview.objects.filter(
                review=OuterRef("pk"),
                user=requester,
            )
            return qs.annotate(is_helpful=Exists(helpful_subquery))
        return qs

    def perform_update(self, serializer):
        if "is_approved" in self.request.data:
            user = self.request.user
            is_owner = serializer.instance.user == user

            if user.is_staff:
                return serializer.save()

            seller_profile = getattr(user, "seller_profile", None)
            product = serializer.instance.product
            is_related_seller = bool(seller_profile and product.seller == seller_profile)

            if not is_owner and not is_related_seller:
                raise PermissionDenied("Only staff members or the product seller can change the approval status.")

            if not is_owner:
                requested_fields = set(self.request.data.keys())
                if requested_fields - {"is_approved"}:
                    raise serializers.ValidationError(
                        {"detail": "Moderators can only update the is_approved field."}
                    )

        return serializer.save()


class ReviewImageListCreateView(generics.ListCreateAPIView):
    serializer_class = ReviewImageSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        review_pk = self.kwargs.get("review_pk")
        review = get_object_or_404(Review, pk=review_pk)
        return review.images.all()

    def perform_create(self, serializer):
        review_pk = self.kwargs.get("review_pk")
        review = get_object_or_404(Review, pk=review_pk)

        if review.user != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("Only the review owner may upload images for this review.")

        serializer.save(review=review)


class ReviewImageDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = ReviewImageSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        review_pk = self.kwargs.get("review_pk")
        review = get_object_or_404(Review, pk=review_pk)
        return review.images.all()

    def perform_destroy(self, instance):
        if instance.review.user != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("You do not have permission to delete this image.")
        instance.delete()


class HelpfulToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=None, responses={200: HelpfulToggleResponseSerializer})
    def post(self, request, pk):
        review_queryset = filter_review_queryset_for_request(
            Review.objects.select_related("product", "product__seller"),
            request,
        )
        review = get_object_or_404(review_queryset, pk=pk)
        user = request.user

        existing = HelpfulReview.objects.filter(review=review, user=user).first()
        if existing:
            existing.delete()
            with transaction.atomic():
                Review.objects.select_for_update().get(pk=review.pk)
                Review.objects.filter(pk=review.pk, helpful_count__gt=0).update(
                    helpful_count=F("helpful_count") - 1
                )
                review.refresh_from_db(fields=["helpful_count"])
            return Response({"helpful": False, "helpful_count": review.helpful_count})

        try:
            with transaction.atomic():
                Review.objects.select_for_update().get(pk=review.pk)
                HelpfulReview.objects.create(review=review, user=user)
                Review.objects.filter(pk=review.pk).update(helpful_count=F("helpful_count") + 1)
                review.refresh_from_db(fields=["helpful_count"])
            return Response({"helpful": True, "helpful_count": review.helpful_count})
        except IntegrityError:
            review.refresh_from_db(fields=["helpful_count"])
            return Response({"helpful": True, "helpful_count": review.helpful_count})


class SellerReviewListCreateView(generics.ListCreateAPIView):
    serializer_class = SellerReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = SellerReview.objects.select_related("seller", "user")
        qs = filter_seller_review_queryset_for_request(qs, self.request)

        seller = self.request.query_params.get("seller")
        if seller:
            qs = qs.filter(seller__id=seller)

        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        seller_id = self.request.data.get("seller")
        order_id = self.request.data.get("order")

        if not seller_id or not order_id:
            raise serializers.ValidationError({"detail": "Both seller and order are required."})

        seller = get_object_or_404(SellerProfile, id=seller_id)
        order = get_object_or_404(Order, id=order_id)

        if order.buyer != user:
            raise PermissionDenied("You can only review a seller for your own orders.")

        if not order.items.filter(product__seller=seller).exists():
            raise PermissionDenied("The selected order does not contain any products from this seller.")

        serializer.save(user=user, seller=seller, order=order)


class SellerReviewDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = SellerReview.objects.select_related("seller", "user")
    serializer_class = SellerReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, CanEditOrModerateReview]

    def get_queryset(self):
        return filter_seller_review_queryset_for_request(super().get_queryset(), self.request)

    def perform_update(self, serializer):
        if "is_approved" in self.request.data:
            user = self.request.user
            is_owner = serializer.instance.user == user

            if user.is_staff:
                return serializer.save()

            seller_profile = getattr(user, "seller_profile", None)
            is_related_seller = bool(seller_profile and serializer.instance.seller == seller_profile)

            if not is_owner and not is_related_seller:
                raise PermissionDenied("Only staff members or the seller can change the approval status.")

            if not is_owner:
                requested_fields = set(self.request.data.keys())
                if requested_fields - {"is_approved"}:
                    raise serializers.ValidationError(
                        {"detail": "Moderators can only update the is_approved field."}
                    )

        return serializer.save()
