from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id",
            "notification_type",
            "title",
            "message",
            "data",
            "is_read",
            "read_at",
            "created_at",
        )
        read_only_fields = ("id", "read_at", "created_at")


class NotificationReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("is_read",)


class NotificationMessageSerializer(serializers.Serializer):
    detail = serializers.CharField()


class NotificationUpdateMessageSerializer(serializers.Serializer):
    message = serializers.CharField()


class UnreadNotificationCountSerializer(serializers.Serializer):
    unread_count = serializers.IntegerField()
