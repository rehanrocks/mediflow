from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Patient(models.Model):
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='patients',
    )
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20)
    age = models.PositiveIntegerField()
    condition = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name


class Appointment(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='appointments',
    )
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name='appointments',
    )
    doctor = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='appointments',
    )
    booked_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='booked_appointments',
    )
    appointment_dt = models.DateTimeField()
    reason = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-appointment_dt']

    def clean(self):
        if self.pk is None and self.appointment_dt < timezone.now():
            raise ValidationError({'appointment_dt': 'Appointment date cannot be in the past.'})

        if self.patient.organization_id != self.organization_id:
            raise ValidationError('Patient does not belong to this organization.')

        if self.doctor is not None:
            if self.doctor.organization_id != self.organization_id:
                raise ValidationError({'doctor': 'Doctor does not belong to this organization.'})
            if self.doctor.role != 'doctor':
                raise ValidationError({'doctor': 'Assigned user is not a doctor.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.patient.full_name} — {self.appointment_dt.strftime('%Y-%m-%d %H:%M')}"
