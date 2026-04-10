from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from users.models import User
from products.models import Product
from orders.models import Order


class Review(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='reviews'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='reviews'
    )
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='reviews'
    )
    rating = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    title = models.CharField(max_length=255, blank=True, null=True)
    comment = models.TextField(blank=True, null=True)
    is_approved = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    helpful_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'reviews'
        ordering = ['-created_at']
        unique_together = ['product', 'user', 'order']

    def __str__(self):
        return f"Review #{self.product.title} by {self.user.email}"


class SellerReview(models.Model):
    seller = models.ForeignKey(
        'users.SellerProfile',
        on_delete=models.CASCADE,
        related_name='reviews'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='seller_reviews'
    )
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='seller_reviews'
    )
    rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True, null=True)
    is_approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'seller_reviews'
        ordering = ['-created_at']
        unique_together = ['seller', 'user', 'order']

    def __str__(self):
        return f"Seller Review #{self.seller.user.email} by {self.user.email}"


class ReviewImage(models.Model):
    review = models.ForeignKey(
        Review,
        on_delete=models.CASCADE,
        related_name='images'
    )
    image = models.ImageField(upload_to='review_images/')
    created_at = models.DateTimeField(auto_now_add=True)
    alt_text = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = 'review_images'

    def __str__(self):
        return f"Image #{self.id} for Review #{self.review.id}"


class HelpfulReview(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'helpful_reviews'
        unique_together = ['review', 'user']

    def __str__(self):
        return f"Helpful Review #{self.id} for Review #{self.review.id}"