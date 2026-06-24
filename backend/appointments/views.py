from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Patient, Appointment
from .serializers import PatientSerializer, AppointmentSerializer
from .permissions import IsStaffMember
from organizations.permissions import HasFeature
from users.permissions import IsAdminRole, IsAdminOrReceptionist


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['full_name', 'phone']
    ordering_fields = ['full_name', 'created_at']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdminRole(), HasFeature('patients')()]
        if self.action in ('create', 'update', 'partial_update'):
            return [IsAuthenticated(), IsAdminOrReceptionist(), HasFeature('patients')()]
        return [IsAuthenticated(), HasFeature('patients')()]

    def get_queryset(self):
        qs = Patient.objects.filter(organization=self.request.user.organization)
        phone = self.request.query_params.get('phone', '').strip()
        if phone:
            qs = qs.filter(phone=phone)

        if self.request.user.role == 'doctor':
            patient_ids = Appointment.objects.filter(
                doctor=self.request.user,
                organization=self.request.user.organization,
            ).values_list('patient_id', flat=True).distinct()
            qs = qs.filter(id__in=patient_ids)

        return qs

    def get_object(self):
        obj = super().get_object()

        if self.request.user.role == 'doctor':
            has_access = Appointment.objects.filter(
                doctor=self.request.user,
                patient=obj,
                organization=self.request.user.organization,
            ).exists()
            if not has_access:
                raise PermissionDenied(
                    "You do not have access to this patient."
                )

        return obj


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.select_related('patient', 'doctor', 'booked_by').all()
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated, HasFeature("appointments")]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['patient__full_name', 'reason', 'diagnosis']
    ordering_fields = ['appointment_dt', 'created_at']
    ordering = ['-appointment_dt']

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdminRole(), HasFeature("appointments")()]
        if self.action in ('create', 'update', 'partial_update', 'update_status'):
            return [IsAuthenticated(), IsAdminOrReceptionist(), HasFeature("appointments")()]
        return [IsAuthenticated(), HasFeature("appointments")()]

    def get_queryset(self):
        qs = Appointment.objects.filter(
            organization=self.request.user.organization,
        ).select_related('patient', 'doctor', 'booked_by')

        if self.request.user.role == 'doctor':
            qs = qs.filter(doctor=self.request.user)

        patient_id = self.request.query_params.get('patient', '').strip()
        if patient_id:
            qs = qs.filter(patient_id=patient_id)

        status_param = self.request.query_params.get('status', '').strip()
        if status_param:
            qs = qs.filter(status=status_param)

        return qs

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)
        ordering = self.request.query_params.get('ordering', '').strip()
        if ordering and ordering.lstrip('-') == 'appointment_dt':
            qs = qs.order_by(ordering)
        return qs

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        appointment = self.get_object()
        new_status = request.data.get('status')
        if new_status not in dict(Appointment.Status.choices):
            return Response(
                {'status': 'Invalid status.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        appointment.status = new_status
        appointment.save()
        serializer = self.get_serializer(appointment)
        return Response(serializer.data)



