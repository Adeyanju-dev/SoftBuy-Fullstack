from django.contrib import admin
from .models import Order, OrderItem, ShippingMethod, OrderShipping, Cart, CartItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product_name", "product_sku", "price", "total_amount", "created_at")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "buyer", "status", "total_amount", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("order_number", "buyer__email")
    readonly_fields = ("order_number", "created_at", "updated_at")
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("order", "product_name", "quantity", "price", "total_amount", "created_at")
    list_filter = ("created_at",)
    search_fields = ("order__order_number", "product_name")
    readonly_fields = ("created_at",)


@admin.register(ShippingMethod)
class ShippingMethodAdmin(admin.ModelAdmin):
    list_display = ("name", "price", "is_active", "estimated_days")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(OrderShipping)
class OrderShippingAdmin(admin.ModelAdmin):
    list_display = ("order", "shipping_method", "tracking_number", "shipped_at")
    list_filter = ("shipped_at",)
    search_fields = ("order__order_number", "tracking_number")


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ("user", "total_items", "updated_at", "subtotal")
    readonly_fields = ("created_at", "updated_at")


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ("cart", "product", "variant", "quantity", "price", "total_price", "updated_at")
    list_filter = ("updated_at",)
    search_fields = ("cart__user__email", "product__title")