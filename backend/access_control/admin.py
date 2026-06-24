from django.contrib import admin
from .models import Role, ModulePermission


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "organization", "is_system", "created_at"]
    list_filter = ["is_system", "organization"]
    search_fields = ["name", "slug"]

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.is_system:
            return ["slug", "is_system", "organization"]
        return ["slug"]


@admin.register(ModulePermission)
class ModulePermissionAdmin(admin.ModelAdmin):
    list_display = ["role", "module", "access"]
    list_filter = ["module", "access"]
