from django.contrib import admin
from .models import Organization, Feature, OrganizationFeature


class OrganizationFeatureInline(admin.TabularInline):
    model = OrganizationFeature
    extra = 1


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_active', 'created_at')
    inlines = [OrganizationFeatureInline]


@admin.register(Feature)
class FeatureAdmin(admin.ModelAdmin):
    list_display = ('key', 'label')


@admin.register(OrganizationFeature)
class OrganizationFeatureAdmin(admin.ModelAdmin):
    list_display = ('organization', 'feature', 'is_enabled')
    list_filter = ('organization', 'is_enabled')
    list_editable = ('is_enabled',)
