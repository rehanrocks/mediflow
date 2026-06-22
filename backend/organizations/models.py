from django.db import models


class Organization(models.Model):
    name = models.CharField(max_length=150)
    display_name = models.CharField(max_length=150, blank=True)
    logo = models.ImageField(upload_to="org_logos/", blank=True, null=True)
    slug = models.SlugField(unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def branding_name(self):
        return self.display_name or self.name

    def __str__(self):
        return self.name


class Feature(models.Model):
    key = models.CharField(max_length=50, unique=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.label


class OrganizationFeature(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='features',
    )
    feature = models.ForeignKey(
        Feature,
        on_delete=models.CASCADE,
    )
    is_enabled = models.BooleanField(default=True)

    class Meta:
        unique_together = ('organization', 'feature')

    def __str__(self):
        return f"{self.organization.name} — {self.feature.label} ({'On' if self.is_enabled else 'Off'})"
