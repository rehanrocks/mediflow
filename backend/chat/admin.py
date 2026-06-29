from django.contrib import admin
from .models import Message, Group, GroupMembership, GroupMessage, GroupMessageRead


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'sender', 'receiver', 'content_preview', 'status', 'created_at']
    list_filter = ['status', 'is_read', 'created_at']
    search_fields = ['sender__email', 'receiver__email', 'content']
    raw_id_fields = ['sender', 'receiver']

    def content_preview(self, obj):
        return obj.content[:60]
    content_preview.short_description = 'Content'


class GroupMembershipInline(admin.TabularInline):
    model = GroupMembership
    extra = 0
    fields = ['user', 'is_admin', 'joined_at']
    readonly_fields = ['joined_at']


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'created_by', 'member_count', 'created_at']
    search_fields = ['name', 'created_by__email']
    inlines = [GroupMembershipInline]

    def member_count(self, obj):
        return obj.members.count()


@admin.register(GroupMessage)
class GroupMessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'group', 'sender', 'content_preview', 'created_at']
    list_filter = ['created_at']
    search_fields = ['group__name', 'sender__email', 'content']
    raw_id_fields = ['group', 'sender']

    def content_preview(self, obj):
        return obj.content[:60]
