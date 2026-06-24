from django.core.exceptions import ValidationError
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        RECEPTIONIST = 'receptionist', 'Receptionist'
        DOCTOR = 'doctor', 'Doctor'
        PATIENT = 'patient', 'Patient'

    class DoctorStatus(models.TextChoices):
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'
        ON_LEAVE = 'on_leave', 'On Leave'

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='users',
        null=True,
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.RECEPTIONIST,
    )

    phone = models.CharField(max_length=20, blank=True)
    qualification = models.CharField(max_length=200, blank=True)
    specializations = models.JSONField(default=list, blank=True)
    experience_years = models.PositiveIntegerField(default=0)
    shift_start = models.TimeField(null=True, blank=True)
    shift_end = models.TimeField(null=True, blank=True)
    join_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=DoctorStatus.choices,
        default=DoctorStatus.ACTIVE,
    )

    def is_staff_member(self):
        return self.role in (self.Role.ADMIN, self.Role.RECEPTIONIST)

    def clean(self):
        super().clean()
        if self.role == self.Role.DOCTOR:
            if self.shift_start and self.shift_end and self.shift_end <= self.shift_start:
                raise ValidationError('Shift end must be after shift start.')
            if self.experience_years > 60:
                raise ValidationError({'experience_years': 'Experience years cannot exceed 60.'})
            if self.phone:
                qs = User.objects.filter(
                    organization=self.organization,
                    phone=self.phone,
                    role=self.Role.DOCTOR,
                )
                if self.pk:
                    qs = qs.exclude(pk=self.pk)
                if qs.exists():
                    raise ValidationError({'phone': 'Phone already in use by another doctor in this organization.'})
            if self.email:
                qs = User.objects.filter(
                    organization=self.organization,
                    email=self.email,
                    role=self.Role.DOCTOR,
                )
                if self.pk:
                    qs = qs.exclude(pk=self.pk)
                if qs.exists():
                    raise ValidationError({'email': 'Email already in use by another doctor in this organization.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class DoctorAttendance(models.Model):
    doctor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='attendance_records',
        limit_choices_to={'role': 'doctor'},
    )
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='attendance_records',
    )
    date = models.DateField()
    checkin_time = models.TimeField(null=True, blank=True)
    checkout_time = models.TimeField(null=True, blank=True)
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        unique_together = ('doctor', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.doctor.first_name} {self.doctor.last_name} — {self.date}"

    @property
    def on_time(self):
        if self.checkin_time is None:
            return None
        if self.doctor.shift_start is None:
            return None
        from datetime import timedelta, datetime
        shift_dt = datetime.combine(self.date, self.doctor.shift_start)
        grace_period = shift_dt + timedelta(minutes=15)
        checkin_dt = datetime.combine(self.date, self.checkin_time)
        return checkin_dt <= grace_period

    @property
    def cases_on_date(self):
        from appointments.models import Appointment
        return Appointment.objects.filter(
            doctor=self.doctor,
            appointment_dt__date=self.date,
            status__in=['completed', 'in_progress'],
        ).count()
