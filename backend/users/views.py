from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate, TruncMonth
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.utils import timezone

from .serializers import (
    CustomTokenObtainPairSerializer,
    CustomTokenRefreshSerializer,
    DoctorListSerializer,
    DoctorDetailSerializer,
    DoctorWriteSerializer,
    DoctorAttendanceSerializer,
    DoctorAppointmentSerializer,
    DoctorStatsSerializer,
)
from .models import User, DoctorAttendance
from .permissions import IsAdminRole, CanViewDoctorFullProfile, IsAdminOrReceptionist
from organizations.permissions import HasFeature
from access_control.permissions import HasModuleAccess


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class CustomTokenRefreshView(TokenRefreshView):
    serializer_class = CustomTokenRefreshSerializer


class DoctorViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(role='doctor', is_active=True).order_by('id')
    filter_backends = [SearchFilter]
    search_fields = ['first_name', 'last_name', 'specializations']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return DoctorWriteSerializer
        if self.action == 'list':
            return DoctorListSerializer
        return DoctorDetailSerializer

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdminRole(), HasFeature('doctors')()]
        if self.action == 'create':
            return [IsAuthenticated(), HasModuleAccess("doctors", "write"), HasFeature('doctors')()]
        if self.action in ('update', 'partial_update'):
            return [IsAuthenticated(), IsAdminRole(), HasFeature('doctors')()]
        if self.action in ('checkin', 'checkout'):
            return [IsAuthenticated(), IsAdminOrReceptionist(), HasFeature('doctors')()]
        return [IsAuthenticated(), HasModuleAccess("doctors", "read"), HasFeature('doctors')()]

    def get_queryset(self):
        qs = User.objects.filter(
            role='doctor',
            is_active=True,
            organization=self.request.user.organization,
        )
        status_filter = self.request.query_params.get('status', '').strip()
        if status_filter in ('active', 'inactive', 'on_leave'):
            qs = qs.filter(status=status_filter)
        specialization = self.request.query_params.get('specialization', '').strip()
        if specialization:
            qs = qs.filter(specializations__contains=[specialization])
        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        today = timezone.localdate()
        doctor_ids = list(queryset.values_list('id', flat=True))

        attendances = DoctorAttendance.objects.filter(
            doctor_id__in=doctor_ids,
            date=today,
        ).values('doctor_id', 'checkin_time', 'checkout_time')
        attendance_map = {}
        for a in attendances:
            attendance_map[a['doctor_id']] = {
                'checkin_time': a['checkin_time'].strftime('%H:%M:%S') if a['checkin_time'] else None,
                'checkout_time': a['checkout_time'].strftime('%H:%M:%S') if a['checkout_time'] else None,
            }

        from appointments.models import Appointment
        case_counts = Appointment.objects.filter(
            doctor_id__in=doctor_ids,
            appointment_dt__date=today,
            status__in=['completed', 'in_progress', 'scheduled'],
        ).values('doctor_id').annotate(count=Count('id'))
        cases_map = {c['doctor_id']: c['count'] for c in case_counts}

        context = self.get_serializer_context()
        context['attendance_map'] = attendance_map
        context['cases_map'] = cases_map

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = DoctorListSerializer(page, many=True, context=context)
            return self.get_paginated_response(serializer.data)

        serializer = DoctorListSerializer(queryset, many=True, context=context)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.role_slug == 'doctor' and request.user.pk != instance.pk:
            serializer = DoctorListSerializer(instance, context=self.get_serializer_context())
        else:
            serializer = DoctorDetailSerializer(instance, context=self.get_serializer_context())
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        read_serializer = DoctorListSerializer(instance, context=self.get_serializer_context())
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        serializer.save()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        read_serializer = DoctorListSerializer(instance, context=self.get_serializer_context())
        return Response(read_serializer.data)

    def destroy(self, request, *args, **kwargs):
        doctor = self.get_object()
        doctor.is_active = False
        doctor.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='on-duty')
    def on_duty(self, request):
        if request.user.role_slug == 'doctor':
            return Response(
                {'detail': 'Access denied.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        today = timezone.localdate()
        org = request.user.organization

        checked_in_ids = DoctorAttendance.objects.filter(
            date=today,
            organization=org,
            checkin_time__isnull=False,
        ).values_list('doctor_id', flat=True)

        doctors = User.objects.filter(
            id__in=checked_in_ids,
            role='doctor',
            organization=org,
            is_active=True,
        )

        from appointments.models import Appointment
        case_counts = Appointment.objects.filter(
            doctor__in=doctors,
            appointment_dt__date=today,
            organization=org,
        ).values('doctor_id').annotate(count=Count('id'))
        cases_map = {c['doctor_id']: c['count'] for c in case_counts}

        attendance_map = {
            a.doctor_id: a.checkin_time
            for a in DoctorAttendance.objects.filter(
                doctor__in=doctors, date=today,
            )
        }

        results = []
        for doctor in doctors:
            checkin = attendance_map.get(doctor.id)
            results.append({
                'id': doctor.id,
                'full_name': f'{doctor.first_name} {doctor.last_name}'.strip(),
                'today_checkin': checkin.strftime('%H:%M') if checkin else None,
                'cases_today': cases_map.get(doctor.id, 0),
            })

        results.sort(key=lambda x: x['today_checkin'] or '99:99')

        page = self.paginate_queryset(results)
        if page is not None:
            return self.get_paginated_response(page)
        return Response(results)

    @action(detail=True, methods=['get'], url_path='stats')
    def stats(self, request, pk=None):
        doctor = self.get_object()

        permission = CanViewDoctorFullProfile()
        if not permission.has_object_permission(request, self, doctor):
            return Response(
                {'detail': "You do not have permission to view this doctor's stats."},
                status=status.HTTP_403_FORBIDDEN,
            )

        today = timezone.localdate()
        thirty_days_ago = today - timedelta(days=29)
        twelve_months_ago = today.replace(day=1) - timedelta(days=1)
        twelve_months_ago = twelve_months_ago.replace(day=1)

        from appointments.models import Appointment

        daily_raw = Appointment.objects.filter(
            doctor=doctor,
            appointment_dt__date__gte=thirty_days_ago,
            status__in=['completed', 'in_progress', 'scheduled'],
        ).annotate(day=TruncDate('appointment_dt')).values('day').annotate(
            count=Count('id')
        ).order_by('day')
        daily_map = {r['day']: r['count'] for r in daily_raw}
        daily_cases = []
        for i in range(30):
            d = thirty_days_ago + timedelta(days=i)
            daily_cases.append({
                'date': d.isoformat(),
                'count': daily_map.get(d, 0),
            })

        case_types_raw = Appointment.objects.filter(
            doctor=doctor,
        ).values('reason').annotate(count=Count('id')).order_by('-count')[:20]
        case_types = [
            {'type': r['reason'] or 'Unspecified', 'count': r['count']}
            for r in case_types_raw if r['reason']
        ]

        monthly_raw = Appointment.objects.filter(
            doctor=doctor,
            appointment_dt__gte=twelve_months_ago,
            status__in=['completed', 'in_progress', 'scheduled'],
        ).annotate(month=TruncMonth('appointment_dt')).values('month').annotate(
            count=Count('id')
        ).order_by('month')
        monthly_map = {r['month'].isoformat()[:7]: r['count'] for r in monthly_raw}
        monthly_summary = []
        cursor = twelve_months_ago
        for i in range(12):
            key = cursor.isoformat()[:7]
            monthly_summary.append({'month': key, 'count': monthly_map.get(key, 0)})
            if cursor.month == 12:
                cursor = cursor.replace(year=cursor.year + 1, month=1)
            else:
                cursor = cursor.replace(month=cursor.month + 1)

        attendance_qs = DoctorAttendance.objects.filter(
            doctor=doctor,
            date__gte=thirty_days_ago,
        ).order_by('-date')

        appt_by_date = Appointment.objects.filter(
            doctor=doctor,
            appointment_dt__date__gte=thirty_days_ago,
            status__in=['completed', 'in_progress', 'scheduled'],
        ).annotate(day=TruncDate('appointment_dt')).values('day').annotate(
            count=Count('id')
        )
        appt_map = {r['day']: r['count'] for r in appt_by_date}

        top_conditions = Appointment.objects.filter(
            doctor=doctor,
        ).exclude(
            Q(diagnosis='') | Q(diagnosis__isnull=True)
        ).values('diagnosis').annotate(
            count=Count('id')
        ).order_by('-count')[:5]
        top_conditions_data = [
            {'condition': r['diagnosis'], 'count': r['count']}
            for r in top_conditions
        ]

        data = {
            'doctor_id': doctor.id,
            'daily_cases': daily_cases,
            'case_types': case_types,
            'monthly_summary': monthly_summary,
            'attendance': DoctorAttendanceSerializer(
                attendance_qs, many=True,
                context={'appt_map': appt_map},
            ).data,
            'top_conditions': top_conditions_data,
        }

        serializer = DoctorStatsSerializer(data)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='appointments')
    def appointments(self, request, pk=None):
        doctor = self.get_object()

        permission = CanViewDoctorFullProfile()
        if not permission.has_object_permission(request, self, doctor):
            return Response(
                {'detail': "You do not have permission to view this doctor's appointments."},
                status=status.HTTP_403_FORBIDDEN,
            )

        from appointments.models import Appointment

        ordering = request.query_params.get('ordering', '-appointment_dt').strip()
        qs = Appointment.objects.filter(
            doctor=doctor,
            organization=request.user.organization,
        ).select_related('patient').order_by(ordering)

        status_filter = request.query_params.get('status', '').strip()
        if status_filter in ('scheduled', 'in_progress', 'completed', 'cancelled'):
            qs = qs.filter(status=status_filter)

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = DoctorAppointmentSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = DoctorAppointmentSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='checkin')
    def checkin(self, request, pk=None):
        doctor = self.get_object()
        today = timezone.localdate()

        checkin_str = request.data.get('checkin_time', '').strip()
        if not checkin_str:
            return Response(
                {'detail': 'checkin_time is required in HH:MM format.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            hour, minute = checkin_str.split(':')
            chk_time = timezone.datetime.strptime(f"{int(hour):02d}:{int(minute):02d}", '%H:%M').time()
        except (ValueError, AttributeError):
            return Response(
                {'detail': 'Invalid time format. Use HH:MM (24-hour).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now_time = timezone.now().time()
        full_chk = timezone.datetime.combine(today, chk_time)
        full_now = timezone.datetime.combine(today, now_time)
        if full_chk > full_now:
            return Response(
                {'detail': 'Check-in time cannot be in the future.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attendance, created = DoctorAttendance.objects.get_or_create(
            doctor=doctor,
            date=today,
            defaults={
                'organization': request.user.organization,
                'checkin_time': chk_time,
            },
        )

        if not created and attendance.checkin_time is not None:
            return Response(
                {'detail': 'Doctor has already checked in today.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not created:
            attendance.checkin_time = chk_time
            attendance.save(update_fields=['checkin_time'])

        return Response({
            'date': today.isoformat(),
            'checkin_time': checkin_str,
            'on_time': attendance.on_time,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='checkout')
    def checkout(self, request, pk=None):
        doctor = self.get_object()
        today = timezone.localdate()

        try:
            attendance = DoctorAttendance.objects.get(doctor=doctor, date=today)
        except DoctorAttendance.DoesNotExist:
            return Response(
                {'detail': 'Doctor has not checked in today — cannot check out.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if attendance.checkin_time is None:
            return Response(
                {'detail': 'Doctor has not checked in today — cannot check out.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if attendance.checkout_time is not None:
            return Response(
                {'detail': 'Doctor has already checked out today.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        checkout_str = request.data.get('checkout_time', '').strip()
        if not checkout_str:
            return Response(
                {'detail': 'checkout_time is required in HH:MM format.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            hour, minute = checkout_str.split(':')
            chkout_time = timezone.datetime.strptime(f"{int(hour):02d}:{int(minute):02d}", '%H:%M').time()
        except (ValueError, AttributeError):
            return Response(
                {'detail': 'Invalid time format. Use HH:MM (24-hour).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        full_checkin = timezone.datetime.combine(today, attendance.checkin_time)
        full_checkout = timezone.datetime.combine(today, chkout_time)
        if full_checkout <= full_checkin:
            return Response(
                {'detail': 'Checkout time must be after check-in time.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attendance.checkout_time = chkout_time
        attendance.save(update_fields=['checkout_time'])

        return Response({
            'date': today.isoformat(),
            'checkin_time': attendance.checkin_time.strftime('%H:%M'),
            'checkout_time': checkout_str,
        }, status=status.HTTP_200_OK)
