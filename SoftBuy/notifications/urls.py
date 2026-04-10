from django.urls import path
from . import views

app_name = "notifications"

urlpatterns = [
    path("", views.NotificationListView.as_view(), name="notification-list"),
    path("unread-count/", views.UnreadNotificationCountView.as_view(), name="notification-unread-count"),
    path("mark-all-read/", views.MarkAllNotificationsAsReadView.as_view(), name="notification-mark-all-read"),
    path("<int:pk>/", views.NotificationDetailView.as_view(), name="notification-detail"),
    path("<int:pk>/mark-read/", views.MarkNotificationAsReadView.as_view(), name="notification-mark-read"),
]