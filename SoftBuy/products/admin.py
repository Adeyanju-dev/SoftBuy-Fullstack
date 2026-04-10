from django.contrib import admin

from .models import Category, Product, ProductImage, ProductTag, ProductVariant, Tag, Wishlist


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 1


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "parent", "is_active", "created_at")
    list_filter = ("is_active", "parent")
    search_fields = ("name", "description")
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ("created_at", "updated_at")


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ("created_at",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("title", "seller", "category", "price", "stock", "status", "created_at")
    list_filter = ("status", "category", "created_at")
    search_fields = ("title", "description", "sku", "seller__business_name", "seller__user__email")
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("created_at", "updated_at")
    inlines = [ProductImageInline, ProductVariantInline]


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ("product", "is_primary", "order", "created_at")
    list_filter = ("is_primary",)
    search_fields = ("product__title", "alt_text")
    readonly_fields = ("created_at",)


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ("product", "sku", "price", "stock", "created_at")
    search_fields = ("product__title", "sku")
    readonly_fields = ("created_at", "updated_at")


@admin.register(ProductTag)
class ProductTagAdmin(admin.ModelAdmin):
    list_display = ("product", "tag", "created_at")
    list_filter = ("tag",)
    search_fields = ("product__title", "tag__name")
    readonly_fields = ("created_at",)


@admin.register(Wishlist)
class WishlistAdmin(admin.ModelAdmin):
    list_display = ("user", "product", "created_at")
    search_fields = ("user__email", "product__title", "product__sku")
    readonly_fields = ("created_at",)
