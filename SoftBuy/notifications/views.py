from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import (
    NotificationMessageSerializer,
    NotificationReadSerializer,
    NotificationSerializer,
    NotificationUpdateMessageSerializer,
    UnreadNotificationCountSerializer,
)
from django.shortcuts import get_object_or_404


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Notification.objects.filter(recipient=self.request.user)

        is_read = self.request.query_params.get("is_read")
        notification_type = self.request.query_params.get("type")

        if is_read is not None:
            if is_read.lower() == "true":
                queryset = queryset.filter(is_read=True)
            elif is_read.lower() == "false":
                queryset = queryset.filter(is_read=False)

        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)

        return queryset.order_by("-created_at")


class NotificationDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @extend_schema(
        request=NotificationReadSerializer,
        responses={200: NotificationUpdateMessageSerializer},
    )
    def patch(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, recipient=request.user)

        serializer = NotificationReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        is_read = serializer.validated_data.get("is_read")

        notification.is_read = is_read
        notification.save()

        return Response(
            {"message": "Notification updated successfully."},
            status=status.HTTP_200_OK
        )

class MarkNotificationAsReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=None,
        responses={200: NotificationMessageSerializer, 404: NotificationMessageSerializer},
    )
    def post(self, request, pk):
        notification = Notification.objects.filter(
            pk=pk,
            recipient=request.user
        ).first()

        if not notification:
            return Response(
                {"detail": "Notification not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        notification.mark_as_read()
        return Response(
            {"detail": "The notification was marked as read."},
            status=status.HTTP_200_OK
        )


class MarkAllNotificationsAsReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=None, responses={200: NotificationMessageSerializer})
    def post(self, request):
        unread_notifications = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        )

        unread_notifications.update(
            is_read=True,
            read_at=timezone.now()
        )

        return Response(
            {"detail": "All notifications have been marked as read."},
            status=status.HTTP_200_OK
        )


class UnreadNotificationCountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=None, responses={200: UnreadNotificationCountSerializer})
    def get(self, request):
        count = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).count()

        return Response(
            {"unread_count": count},
            status=status.HTTP_200_OK
        )
