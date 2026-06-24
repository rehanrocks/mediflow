from rest_framework.viewsets import ModelViewSet
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import StaffMember
from .serializers import StaffListSerializer, StaffDetailSerializer, StaffWriteSerializer
from users.permissions import IsAdminRole
from organizations.permissions import HasFeature
from access_control.permissions import HasModuleAccess


class StaffMemberViewSet(ModelViewSet):
    filter_backends = [SearchFilter]
    search_fields = ['full_name', 'phone', 'role']

    def get_queryset(self):
        qs = StaffMember.objects.filter(
            organization=self.request.user.organization,
        )
        status_param = self.request.query_params.get('status')
        if status_param in ('active', 'inactive'):
            qs = qs.filter(status=status_param)
        phone_param = self.request.query_params.get('phone')
        if phone_param:
            qs = qs.filter(phone=phone_param)
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return StaffWriteSerializer
        if self.action == 'retrieve':
            return StaffDetailSerializer
        return StaffListSerializer

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdminRole(), HasFeature('staff')()]
        if self.action in ('create', 'update', 'partial_update'):
            return [IsAuthenticated(), HasModuleAccess("staff", "write"), HasFeature('staff')()]
        return [IsAuthenticated(), HasModuleAccess("staff", "read"), HasFeature('staff')()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        role_created = self._ensure_role_exists(
            instance.role, request.user.organization
        )
        read_serializer = StaffListSerializer(instance, context=self.get_serializer_context())
        data = read_serializer.data
        data["role_created"] = role_created
        return Response(data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        role_created = self._ensure_role_exists(
            instance.role, request.user.organization
        )
        read_serializer = StaffListSerializer(instance, context=self.get_serializer_context())
        data = read_serializer.data
        data["role_created"] = role_created
        return Response(data)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)

    def perform_update(self, serializer):
        serializer.save()

    def _ensure_role_exists(self, role_name, organization):
        from django.utils.text import slugify
        from access_control.models import Role
        if not role_name:
            return False
        role, created = Role.objects.get_or_create(
            organization=organization,
            slug=slugify(role_name),
            defaults={
                "name": role_name,
                "is_system": False,
            }
        )
        return created

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=204)
