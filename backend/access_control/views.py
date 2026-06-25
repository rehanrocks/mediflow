from django.db import transaction
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Role, ModulePermission, MODULE_CHOICES, ACCESS_CHOICES
from .serializers import (
    RoleSerializer,
    RoleWriteSerializer,
    ModulePermissionSerializer,
    ModulePermissionWriteSerializer,
)
from users.permissions import IsAdminRole


class RoleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return RoleWriteSerializer
        return RoleSerializer

    def get_queryset(self):
        org = self.request.user.organization
        return Role.objects.filter(
            Q(is_system=True) | Q(organization=org)
        ).prefetch_related("module_permissions")

    def perform_create(self, serializer):
        org = self.request.user.organization
        serializer.save(organization=org, is_system=False)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        read_serializer = RoleSerializer(serializer.instance)
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system:
            return Response(
                {"detail": "System roles cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if role.users.filter(is_active=True).exists():
            return Response(
                {
                    "detail": "Cannot delete a role that is assigned to "
                    "active users. Reassign those users first."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system:
            data = request.data.copy()
            data.pop("name", None)
            data.pop("slug", None)
            serializer = self.get_serializer(role, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(RoleSerializer(role).data)
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="set-permissions")
    def set_permissions(self, request, pk=None):
        role = self.get_object()

        permissions_data = request.data.get("permissions", [])

        valid_modules = [c[0] for c in MODULE_CHOICES]
        valid_access = [c[0] for c in ACCESS_CHOICES]
        errors = []
        for item in permissions_data:
            if item.get("module") not in valid_modules:
                errors.append(f"Invalid module: {item.get('module')}")
            if item.get("access") not in valid_access:
                errors.append(f"Invalid access value: {item.get('access')}")
        if errors:
            return Response({"detail": errors}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for item in permissions_data:
                ModulePermission.objects.update_or_create(
                    role=role,
                    module=item["module"],
                    defaults={"access": item["access"]},
                )
            mentioned_modules = {item["module"] for item in permissions_data}
            unmentioned = [m for m in valid_modules if m not in mentioned_modules]
            for module in unmentioned:
                ModulePermission.objects.update_or_create(
                    role=role,
                    module=module,
                    defaults={"access": "none"},
                )

        return Response(RoleSerializer(role).data)


class RoleNamesView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        org = request.user.organization
        roles = Role.objects.filter(
            Q(is_system=True) | Q(organization=org)
        ).values("id", "name", "slug", "is_system").order_by("is_system", "name")
        return Response(list(roles))
