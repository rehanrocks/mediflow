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
    date_of_birth = models.DateField(null=True, blank=True)
    sex = models.CharField(max_length=10, blank=True)
    marital_status = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    weight_kg = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    height_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    physical_activity_level = models.CharField(max_length=30, blank=True)
    pre_existing_conditions = models.JSONField(default=list, blank=True)
    known_allergies = models.JSONField(default=list, blank=True)
    current_medications = models.JSONField(default=list, blank=True)
    blood_group = models.CharField(max_length=5, blank=True)
    onboarding_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name


class Appointment(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    class PaymentStatus(models.TextChoices):
        PAID = 'paid', 'Paid'
        UNPAID = 'unpaid', 'Unpaid'

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
    temperature = models.CharField(max_length=10, blank=True)
    blood_pressure = models.CharField(max_length=10, blank=True)
    diagnosis = models.TextField(blank=True)
    treatment_plan = models.TextField(blank=True)
    medications_prescribed = models.JSONField(default=list, blank=True)
    precautions = models.JSONField(default=list, blank=True)
    medical_activity = models.JSONField(default=list, blank=True)
    post_scheduling_notes = models.TextField(blank=True)
    additional_notes = models.TextField(blank=True)
    payment_status = models.CharField(
        max_length=10,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-appointment_dt']

    def clean(self):
        if self.pk is None and self.appointment_dt and self.appointment_dt < timezone.now():
            raise ValidationError({'appointment_dt': 'Appointment date cannot be in the past.'})

        if self.patient_id and self.patient.organization_id != self.organization_id:
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
