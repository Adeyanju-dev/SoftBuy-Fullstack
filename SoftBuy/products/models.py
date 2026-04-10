from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.text import slugify
from cloudinary.models import CloudinaryField

from users.models import SellerProfile


def generate_unique_slug(instance, value, slug_field="slug"):
    base_slug = slugify(value)
    slug = base_slug
    model_class = instance.__class__
    counter = 1

    while model_class.objects.filter(**{slug_field: slug}).exclude(pk=instance.pk).exists():
        slug = f"{base_slug}-{counter}"
        counter += 1

    return slug


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
    )
    image = models.ImageField(upload_to="categories/", blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "categories"
        verbose_name = "Category"
        verbose_name_plural = "Categories"
        ordering = ["name"]

    def __str__(self):
        return self.name

    def clean(self):
        if self.parent and self.parent == self:
            raise ValidationError("A category cannot be its own parent.")

        ancestor = self.parent
        while ancestor is not None:
            if ancestor == self:
                raise ValidationError("A category cannot be assigned to one of its descendants.")
            ancestor = ancestor.parent

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = generate_unique_slug(self, self.name)
        self.full_clean()
        super().save(*args, **kwargs)


class Tag(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tags"
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = generate_unique_slug(self, self.name)
        super().save(*args, **kwargs)


class Product(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_PUBLISHED = "published"
    STATUS_ARCHIVED = "archived"
    STATUS_SUSPENDED = "suspended"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_PUBLISHED, "Published"),
        (STATUS_ARCHIVED, "Archived"),
        (STATUS_SUSPENDED, "Suspended"),
    ]

    CURRENCY_CHOICES = [
        ("NGN", "Nigerian Naira"),
        ("USD", "US Dollar"),
        ("GBP", "British Pound"),
        ("EUR", "Euro"),
    ]

    WEIGHT_UNIT_CHOICES = [
        ("kg", "KG"),
        ("g", "G"),
    ]

    seller = models.ForeignKey(
        SellerProfile,
        on_delete=models.CASCADE,
        related_name="products",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True, db_index=True)
    description = models.TextField()
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    compare_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default="NGN")
    sku = models.CharField(max_length=100, unique=True, db_index=True)
    stock = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        db_index=True,
    )
    attributes = models.JSONField(default=dict, blank=True)
    dimensions = models.JSONField(default=dict, blank=True)
    weight = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    weight_unit = models.CharField(
        max_length=5,
        choices=WEIGHT_UNIT_CHOICES,
        default="kg",
    )
    seo_title = models.CharField(max_length=200, blank=True)
    seo_description = models.CharField(max_length=255, blank=True)
    tags = models.ManyToManyField(
        Tag,
        through="ProductTag",
        related_name="tagged_products",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "products"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["category", "status"]),
            models.Index(fields=["seller", "status"]),
        ]

    def __str__(self):
        return self.title

    @property
    def is_in_stock(self):
        return self.stock > 0

    def clean(self):
        if not self.title or len(self.title.strip()) < 3:
            raise ValidationError({"title": "Title must be at least 3 characters long."})

        allowed_currencies = {"NGN", "USD", "GBP", "EUR"}
        if self.currency and self.currency.upper() not in allowed_currencies:
            raise ValidationError(
                {"currency": f"Currency must be one of: {', '.join(sorted(allowed_currencies))}."}
            )

        if self.compare_price is not None and self.compare_price < self.price:
            raise ValidationError(
                {"compare_price": "Compare price must be greater than or equal to price."}
            )

        if self.category and not self.category.is_active:
            raise ValidationError({"category": "You cannot assign an inactive category."})

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = generate_unique_slug(self, self.title)
        self.full_clean()
        super().save(*args, **kwargs)


class ProductImage(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="images",
    )
    image = CloudinaryField('image')
    alt_text = models.CharField(max_length=200, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "product_images"
        ordering = ["order", "created_at"]

    def __str__(self):
        return f"{self.product.title} - Image {self.pk}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_primary:
            ProductImage.objects.filter(product=self.product).exclude(pk=self.pk).update(is_primary=False)


class ProductVariant(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="variants",
    )
    sku = models.CharField(max_length=100, unique=True, db_index=True)
    attributes = models.JSONField(default=dict, blank=True)
    stock = models.PositiveIntegerField(default=0)
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "product_variants"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.product.title} - {self.sku}"


class ProductTag(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "product_tags"
        constraints = [
            models.UniqueConstraint(fields=["product", "tag"], name="unique_product_tag")
        ]

    def __str__(self):
        return f"{self.product.title} - {self.tag.name}"


class Wishlist(models.Model):
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="wishlist_items",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="wishlisted_by",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "wishlists"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "product"], name="unique_user_wishlist_product")
        ]

    def __str__(self):
        return f"{self.user.email} - {self.product.title}"
