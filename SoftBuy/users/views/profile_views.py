from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response

from ..serializers import (
    AddressSerializer,
    MessageResponseSerializer,
    SellerProfileSerializer,
    UserSerializer,
)
from ..utils import get_frontend_url_from_request, send_verification_email_to_user


@extend_schema(tags=["Authentication"], summary="Get or update current user profile")
class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


@extend_schema(tags=["Authentication"], summary="Get or update current seller profile")
class SellerProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = SellerProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        if not self.request.user.is_seller:
            raise PermissionDenied("This account is not registered as a seller.")

        seller_profile = getattr(self.request.user, "seller_profile", None)
        if seller_profile is None:
            raise NotFound("Seller profile was not found.")

        return seller_profile


@extend_schema(tags=["Authentication"], summary="List or create current user's addresses")
class AddressListCreateView(generics.ListCreateAPIView):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.addresses.all().order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


@extend_schema(tags=["Authentication"], summary="Retrieve, update or delete an address")
class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.addresses.all()


@extend_schema(
    request=None,
    responses={200: MessageResponseSerializer},
    tags=["Authentication"],
    summary="Send seller verification email",
)
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def send_verification_email(request):
    if not request.user.is_seller:
        return Response(
            {"error": "This account is not registered as a seller."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    seller_profile = getattr(request.user, "seller_profile", None)
    if seller_profile is None:
        return Response(
            {"error": "Seller profile was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    send_verification_email_to_user(
        request.user,
        frontend_url=get_frontend_url_from_request(request),
    )
    request.user.last_verification_sent = timezone.now()
    request.user.save(update_fields=["last_verification_sent"])

    return Response(
        {"message": "The verification email was sent successfully."},
        status=status.HTTP_200_OK,
    )
