from django.contrib import admin
from django.utils.safestring import mark_safe
from .models import Organization, Feature, OrganizationFeature


class OrganizationFeatureInline(admin.TabularInline):
    model = OrganizationFeature
    extra = 1


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('name', 'display_name', 'slug', 'is_active', 'created_at')
    fieldsets = (
        (None, {
            'fields': ('name', 'display_name', 'slug', 'is_active')
        }),
        ('Branding', {
            'fields': ('logo', 'logo_preview')
        }),
    )
    readonly_fields = ('logo_preview',)
    inlines = [OrganizationFeatureInline]

    @admin.display(description='Logo Preview')
    def logo_preview(self, obj):
        if obj.logo:
            return mark_safe(
                f'<img src="{obj.logo.url}" style="max-height: 60px;" alt="Logo" />'
            )
        return 'No logo uploaded'


@admin.register(Feature)
class FeatureAdmin(admin.ModelAdmin):
    list_display = ('key', 'label')


@admin.register(OrganizationFeature)
class OrganizationFeatureAdmin(admin.ModelAdmin):
    list_display = ('organization', 'feature', 'is_enabled')
    list_filter = ('organization', 'is_enabled')
    list_editable = ('is_enabled',)
