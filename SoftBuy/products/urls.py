from django.urls import path

from .views import (
    CategoryDetailView,
    CategoryListCreateView,
    ProductDetailView,
    ProductImageDetailView,
    ProductImageListCreateView,
    ProductListCreateView,
    ProductVariantDetailView,
    ProductVariantListCreateView,
    TagDetailView,
    TagListCreateView,
    WishlistDetailView,
    WishlistListCreateView,
    WishlistToggleView,
)

app_name = "products"

urlpatterns = [
    # Wishlist
    path("wishlist/", WishlistListCreateView.as_view(), name="wishlist-list-create"),
    path("wishlist/toggle/", WishlistToggleView.as_view(), name="wishlist-toggle"),
    path("wishlist/<int:product_id>/", WishlistDetailView.as_view(), name="wishlist-detail"),

    # Tags
    path("tags/", TagListCreateView.as_view(), name="tag-list-create"),
    path("tags/<slug:slug>/", TagDetailView.as_view(), name="tag-detail"),

    # Categories
    path("categories/", CategoryListCreateView.as_view(), name="category-list-create"),
    path("categories/<slug:slug>/", CategoryDetailView.as_view(), name="category-detail"),

    # Products
    path("", ProductListCreateView.as_view(), name="product-list-create"),
    path("<slug:slug>/", ProductDetailView.as_view(), name="product-detail"),

    # Product images
    path("<int:product_pk>/images/", ProductImageListCreateView.as_view(), name="product-image-list-create"),
    path("<int:product_pk>/images/<int:pk>/", ProductImageDetailView.as_view(), name="product-image-detail"),

    # Product variants
    path("<int:product_pk>/variants/", ProductVariantListCreateView.as_view(), name="product-variant-list-create"),
    path("<int:product_pk>/variants/<int:pk>/", ProductVariantDetailView.as_view(), name="product-variant-detail"),

]
