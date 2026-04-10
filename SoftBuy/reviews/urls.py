from django.urls import path
from . import views

app_name = "reviews"

urlpatterns = [
    # Product reviews
    path("", views.ReviewListCreateView.as_view(), name="review-list-create"),
    path("<int:pk>/", views.ReviewDetailView.as_view(), name="review-detail"),

    # Review images (nested)
    path("<int:review_pk>/images/", views.ReviewImageListCreateView.as_view(), name="review-image-list-create"),
    path("<int:review_pk>/images/<int:pk>/", views.ReviewImageDetailView.as_view(), name="review-image-detail"),

    # Helpful toggle
    path("<int:pk>/helpful/", views.HelpfulToggleView.as_view(), name="review-helpful-toggle"),

    # Seller reviews
    path("sellers/", views.SellerReviewListCreateView.as_view(), name="seller-review-list-create"),
    path("sellers/<int:pk>/", views.SellerReviewDetailView.as_view(), name="seller-review-detail"),
]
