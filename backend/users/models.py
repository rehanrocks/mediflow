from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        RECEPTIONIST = 'receptionist', 'Receptionist'
        DOCTOR = 'doctor', 'Doctor'
        PATIENT = 'patient', 'Patient'

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

    def is_staff_member(self):
        return self.role in (self.Role.ADMIN, self.Role.RECEPTIONIST)
