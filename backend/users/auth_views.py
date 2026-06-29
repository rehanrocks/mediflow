from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers as drf_serializers
from django.contrib.auth.hashers import check_password
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator


class ChangePasswordSerializer(drf_serializers.Serializer):
    new_password = drf_serializers.CharField(write_only=True)
    confirm_password = drf_serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        if len(value) < 8:
            raise drf_serializers.ValidationError(
                "Password must be at least 8 characters."
            )
        if not any(c.isupper() for c in value):
            raise drf_serializers.ValidationError(
                "Password must contain at least one uppercase letter."
            )
        if not any(c.isdigit() for c in value):
            raise drf_serializers.ValidationError(
                "Password must contain at least one number."
            )
        special = "!@#$%^&*"
        if not any(c in special for c in value):
            raise drf_serializers.ValidationError(
                f"Password must contain at least one special character ({special})."
            )
        return value

    def validate(self, data):
        if data["new_password"] != data["confirm_password"]:
            raise drf_serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        user = self.context["request"].user
        if check_password(data["new_password"], user.password):
            raise drf_serializers.ValidationError(
                {"new_password": "New password must be different from your current password."}
            )
        return data


@method_decorator(
    ratelimit(key="user", rate="5/15m", method="POST", block=True),
    name="dispatch",
)
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.force_password_change = False
        user.save(update_fields=["password", "force_password_change"])

        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
            for token in OutstandingToken.objects.filter(user=user):
                try:
                    token.blacklist()
                except Exception:
                    pass
        except ImportError:
            pass

        return Response(
            {"detail": "Password updated successfully. Please log in again."},
            status=200,
        )
