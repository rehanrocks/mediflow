from rest_framework.viewsets import ModelViewSet
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import StaffMember
from .serializers import StaffListSerializer, StaffDetailSerializer, StaffWriteSerializer
from users.permissions import IsAdminRole, CanViewStaffModule
from organizations.permissions import HasFeature


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
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdminRole(), HasFeature('staff')()]
        return [IsAuthenticated(), CanViewStaffModule(), HasFeature('staff')()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        read_serializer = StaffListSerializer(instance, context=self.get_serializer_context())
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        read_serializer = StaffListSerializer(instance, context=self.get_serializer_context())
        return Response(read_serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=204)
