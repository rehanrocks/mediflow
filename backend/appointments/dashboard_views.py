from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from appointments.models import Patient, Appointment
from users.models import User, DoctorAttendance
from staff.models import StaffMember


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        org = user.organization
        today = timezone.localdate()

        if user.role_slug == 'doctor':
            return self._doctor_stats(user, org, today)
        return self._admin_stats(user, org, today)

    def _admin_stats(self, user, org, today):
        appointments_today = Appointment.objects.filter(
            organization=org, appointment_dt__date=today
        ).count()

        appointments_scheduled = Appointment.objects.filter(
            organization=org, appointment_dt__date=today, status='scheduled'
        ).count()

        appointments_completed = Appointment.objects.filter(
            organization=org, appointment_dt__date=today, status='completed'
        ).count()

        total_patients = Patient.objects.filter(organization=org).count()

        patients_this_month = Patient.objects.filter(
            organization=org,
            created_at__year=today.year,
            created_at__month=today.month,
        ).count()

        active_doctors = User.objects.filter(
            organization=org, role='doctor', status='active', is_active=True
        ).count()

        total_doctors = User.objects.filter(
            organization=org, role='doctor', is_active=True
        ).count()

        active_staff = StaffMember.objects.filter(
            organization=org, status='active'
        ).count()

        unique_staff_roles = StaffMember.objects.filter(
            organization=org
        ).values('role').distinct().count()

        return Response({
            'appointments_today': appointments_today,
            'appointments_scheduled': appointments_scheduled,
            'appointments_completed': appointments_completed,
            'total_patients': total_patients,
            'patients_this_month': patients_this_month,
            'active_doctors': active_doctors,
            'total_doctors': total_doctors,
            'active_staff': active_staff,
            'unique_staff_roles': unique_staff_roles,
        })

    def _doctor_stats(self, user, org, today):
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)

        base_appts = Appointment.objects.filter(
            doctor=user, organization=org,
        )

        cases_today = base_appts.filter(appointment_dt__date=today).count()
        cases_this_week = base_appts.filter(
            appointment_dt__date__gte=week_start,
            appointment_dt__date__lte=today,
        ).count()
        cases_this_month = base_appts.filter(
            appointment_dt__date__gte=month_start,
            appointment_dt__date__lte=today,
        ).count()

        total_cases = base_appts.count()
        join_date = user.join_date
        days_active = max((today - join_date).days, 1) if join_date else 1
        avg_cases_per_day = round(total_cases / days_active, 1)

        my_patients_total = base_appts.values('patient_id').distinct().count()

        attendance = DoctorAttendance.objects.filter(
            doctor=user, date=today,
        ).first()
        today_checkin = (
            attendance.checkin_time.strftime('%H:%M')
            if attendance and attendance.checkin_time
            else None
        )

        return Response({
            'cases_today': cases_today,
            'cases_this_week': cases_this_week,
            'cases_this_month': cases_this_month,
            'avg_cases_per_day': avg_cases_per_day,
            'my_patients_total': my_patients_total,
            'today_checkin': today_checkin,
            'shift_start': user.shift_start.strftime('%H:%M') if user.shift_start else None,
            'shift_end': user.shift_end.strftime('%H:%M') if user.shift_end else None,
        })
