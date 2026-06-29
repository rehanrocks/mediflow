from django.db import models
from django.core.exceptions import ValidationError
from django.utils.text import slugify


class Role(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="roles",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120)
    is_system = models.BooleanField(default=False)
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("organization", "slug")]
        ordering = ["is_system", "name"]

    def clean(self):
        if self.is_system:
            qs = Role.objects.filter(is_system=True, slug=self.slug)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError(
                    "A system role with this slug already exists."
                )

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


MODULE_CHOICES = [
    ("patients", "Patients"),
    ("appointments", "Appointments"),
    ("doctors", "Doctors"),
    ("staff", "Staff"),
    ("reports", "Reports"),
]

ACCESS_CHOICES = [
    ("no_access", "No Access"),
    ("read", "Read"),
    ("full_access", "Full Access"),
]


class ModulePermission(models.Model):
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="module_permissions",
    )
    module = models.CharField(max_length=50, choices=MODULE_CHOICES)
    access = models.CharField(
        max_length=15, choices=ACCESS_CHOICES, default="no_access"
    )

    class Meta:
        unique_together = [("role", "module")]

    @property
    def can_read(self):
        return self.access in ["read", "full_access"]

    @property
    def can_write(self):
        return self.access == "full_access"

    def __str__(self):
        return f"{self.role.name} — {self.module}: {self.access}"
