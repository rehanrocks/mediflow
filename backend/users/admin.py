from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Organization', {'fields': ('organization', 'role')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Organization', {'fields': ('organization', 'role')}),
    )
    list_display = BaseUserAdmin.list_display + ('organization', 'role')
    list_filter = BaseUserAdmin.list_filter + ('role', 'organization')
