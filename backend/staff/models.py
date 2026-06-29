from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class StaffMember(models.Model):
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='staff_members',
    )
    full_name = models.CharField(max_length=150)
    email = models.EmailField()
    age = models.PositiveIntegerField()
    phone = models.CharField(max_length=20)
    address = models.TextField(blank=True, default='')
    role = models.CharField(max_length=100)
    status = models.CharField(
        max_length=10,
        choices=[('active', 'Active'), ('inactive', 'Inactive')],
        default='active',
    )
    joining_date = models.DateField()
    has_account = models.BooleanField(default=False)
    user = models.OneToOneField(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='staff_profile',
    )
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def clean(self):
        if self.age < 18 or self.age > 60:
            raise ValidationError({'age': 'Age must be between 18 and 60.'})

        if self.joining_date > timezone.localdate():
            raise ValidationError({'joining_date': 'Joining date cannot be in the future.'})

        if self.phone:
            qs = StaffMember.objects.filter(
                organization=self.organization,
                phone=self.phone,
            )
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError({'phone': 'This phone is already registered to another staff member.'})

        if not self.role or not self.role.strip():
            raise ValidationError({'role': 'Role is required.'})

    def save(self, *args, **kwargs):
        self.role = self.role.strip()
        super().save(*args, **kwargs)
