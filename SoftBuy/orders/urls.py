from django.urls import path
from .views import (
    CartView,
    CartItemUpdateDeleteView,
    CreateOrderView,
    UserOrdersListView,
    OrderDetailView,
    ShippingMethodListView,
    UpdateOrderShippingView,
)

urlpatterns = [
    path("cart/", CartView.as_view(), name="cart"),
    path("cart/item/<int:pk>/", CartItemUpdateDeleteView.as_view(), name="cart-item"),
    path("create/", CreateOrderView.as_view(), name="create-order"),
    path("my-orders/", UserOrdersListView.as_view(), name="my-orders"),
    path("shipping-methods/", ShippingMethodListView.as_view(), name="shipping-methods"),
    path("shipping/<str:order_number>/", UpdateOrderShippingView.as_view(), name="update-order-shipping"),
    path("<str:order_number>/", OrderDetailView.as_view(), name="order-detail"),
]