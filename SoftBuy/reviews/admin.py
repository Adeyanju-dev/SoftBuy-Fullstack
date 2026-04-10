from django.contrib import admin
from .models import Review, SellerReview, ReviewImage, HelpfulReview

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('product', 'user', 'rating', 'is_verified', 'is_approved', 'created_at')
    list_filter = ('rating', 'is_verified', 'is_approved', 'created_at')
    search_fields = ('product__title', 'user__email', 'comment')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(SellerReview)
class SellerReviewAdmin(admin.ModelAdmin):
    list_display = ('seller', 'user', 'rating', 'is_approved', 'created_at')  # Removed 'is_verified'
    list_filter = ('rating', 'is_approved', 'created_at')  # Removed 'is_verified'
    search_fields = ('seller__user__email', 'user__email', 'comment')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(ReviewImage)
class ReviewImageAdmin(admin.ModelAdmin):
    list_display = ('review', 'image', 'created_at', 'alt_text')
    list_filter = ('review__product', 'created_at')
    search_fields = ('review__product__title', 'alt_text')
    readonly_fields = ('created_at',)

@admin.register(HelpfulReview)
class HelpfulReviewAdmin(admin.ModelAdmin):
    list_display = ('review', 'user', 'created_at')
    list_filter = ('review__product', 'created_at')
    search_fields = ('review__product__title', 'user__email')
    readonly_fields = ('created_at',)