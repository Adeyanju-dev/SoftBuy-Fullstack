from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User, SellerProfile, Address, UserProfile


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)
    is_seller = serializers.BooleanField(required=False, default=False)
    is_buyer = serializers.BooleanField(required=False, default=True)

    class Meta:
        model = User
        fields = (
            "email",
            "first_name",
            "last_name",
            "password",
            "password2",
            "is_seller",
            "is_buyer",
        )
        extra_kwargs = {
            "first_name": {"required": True},
            "last_name": {"required": True},
        }

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})

        if attrs.get("is_seller") and attrs.get("is_buyer") is False:
            return attrs

        if not attrs.get("is_seller") and not attrs.get("is_buyer", True):
            attrs["is_buyer"] = True

        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = "__all__"
        read_only_fields = ("user", "created_at", "updated_at")


class SellerProfileSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_first_name = serializers.CharField(source="user.first_name", read_only=True)
    user_last_name = serializers.CharField(source="user.last_name", read_only=True)

    class Meta:
        model = SellerProfile
        fields = "__all__"
        read_only_fields = ("user", "verified", "kyc_status", "created_at", "updated_at")


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = "__all__"
        read_only_fields = ("user", "created_at", "updated_at")


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    seller_profile = SellerProfileSerializer(read_only=True)
    addresses = AddressSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone_number",
            "is_seller",
            "is_buyer",
            "email_verified",
            "phone_verified",
            "profile",
            "seller_profile",
            "addresses",
        )
        read_only_fields = ("id", "email_verified", "phone_verified", "email")


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class RequestPasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()


class VerifyResetCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)
    password = serializers.CharField(write_only=True, validators=[validate_password])


class MessageResponseSerializer(serializers.Serializer):
    message = serializers.CharField()


class ErrorResponseSerializer(serializers.Serializer):
    error = serializers.CharField()


class LoginResponseSerializer(serializers.Serializer):
    user = UserSerializer()
    access = serializers.CharField()
    refresh = serializers.CharField()


class RegisterResponseSerializer(serializers.Serializer):
    user = UserSerializer()
    message = serializers.CharField()


class SellerAccessResponseSerializer(serializers.Serializer):
    user = UserSerializer()
    message = serializers.CharField()


class ResendVerificationCooldownSerializer(serializers.Serializer):
    error = serializers.CharField()
    remaining = serializers.IntegerField()
