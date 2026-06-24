from django.contrib.admin import ModelAdmin, register
from .models import StaffMember


@register(StaffMember)
class StaffMemberAdmin(ModelAdmin):
    list_display = [
        'full_name', 'role', 'organization', 'status',
        'phone', 'joining_date', 'created_at',
    ]
    list_filter = ['organization', 'status']
    search_fields = ['full_name', 'phone', 'role']
