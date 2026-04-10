from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from drf_spectacular.utils import extend_schema


class TaggedTokenRefreshView(TokenRefreshView):
    @extend_schema(tags=["Authentication"], summary="Refresh access token")
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

urlpatterns = [
    path('admin/', admin.site.urls),

    # API routes
    path('api/auth/', include('users.urls')),          # Login, register, seller profile
    path('api/products/', include('products.urls')),  # Products, categories, variants, tags
    path('api/orders/', include('orders.urls')),
    path('api/reviews/', include('reviews.urls', namespace='reviews')),
    path('api/notifications/', include('notifications.urls', namespace='notifications')),
    path('api/payments/', include('payments.urls')),
    path('api/auth/refresh/', TaggedTokenRefreshView.as_view(), name='token_refresh'),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),

]

# Media & static files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
