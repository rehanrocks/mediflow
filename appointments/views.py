from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Patient, Appointment
from .serializers import PatientSerializer, AppointmentSerializer, DoctorSerializer
from .permissions import IsStaffMember
from organizations.permissions import HasFeature
from users.models import User


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated, IsStaffMember, HasFeature("patients")]
    filter_backends = [SearchFilter]
    search_fields = ['full_name', 'phone']

    def get_queryset(self):
        return Patient.objects.filter(organization=self.request.user.organization)


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated, HasFeature("appointments")]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'update_status'):
            return [IsAuthenticated(), IsStaffMember(), HasFeature("appointments")()]
        return [IsAuthenticated(), HasFeature("appointments")()]

    def get_queryset(self):
        qs = Appointment.objects.filter(organization=self.request.user.organization)
        if self.request.user.role == 'doctor':
            qs = qs.filter(doctor=self.request.user)
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


class DoctorListView(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = DoctorSerializer

    def get_queryset(self):
        return User.objects.filter(
            role='doctor',
            organization=self.request.user.organization,
        )
