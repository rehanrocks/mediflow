from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, DoctorAttendance


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Organization', {'fields': ('organization', 'role')}),
        ('Doctor Profile', {'fields': (
            'phone', 'qualification', 'specializations',
            'experience_years', 'shift_start', 'shift_end',
            'join_date', 'status',
        )}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Organization', {'fields': ('organization', 'role')}),
        ('Doctor Profile', {'fields': (
            'phone', 'qualification', 'specializations',
            'experience_years', 'shift_start', 'shift_end',
            'join_date', 'status',
        )}),
    )
    list_display = BaseUserAdmin.list_display + ('organization', 'role', 'phone', 'status')
    list_filter = BaseUserAdmin.list_filter + ('role', 'organization', 'status')


@admin.register(DoctorAttendance)
class DoctorAttendanceAdmin(admin.ModelAdmin):
    list_display = ('doctor', 'organization', 'date', 'checkin_time', 'checkout_time', 'on_time')
    list_filter = ('organization', 'date')
    search_fields = ('doctor__first_name', 'doctor__last_name')
