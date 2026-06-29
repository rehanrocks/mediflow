from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Message, Group, GroupMembership, GroupMessage

User = get_user_model()


class ChatUserSerializer(serializers.ModelSerializer):
    is_online = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'full_name', 'role', 'email', 'is_online']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def get_is_online(self, obj):
        from .presence import is_user_online
        return is_user_online(obj.id)


class MessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(source='sender.id', read_only=True)
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'sender_id', 'sender_name', 'content',
                  'created_at', 'is_read', 'read_at', 'status']

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.username


class GroupMessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(source='sender.id', read_only=True)
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = GroupMessage
        fields = ['id', 'sender_id', 'sender_name', 'content', 'created_at']

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.username


class GroupMemberSerializer(serializers.ModelSerializer):
    user = ChatUserSerializer(read_only=True)

    class Meta:
        model = GroupMembership
        fields = ['user', 'joined_at', 'is_admin']


class GroupSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(source='members.count', read_only=True)
    last_message = serializers.SerializerMethodField()
    last_message_sender_name = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ['id', 'name', 'member_count', 'last_message',
                  'last_message_sender_name', 'unread_count', 'created_by', 'created_at']

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if not msg:
            return None
        return {
            'content': msg.content[:80],
            'sender_id': msg.sender_id,
            'created_at': msg.created_at,
        }

    def get_last_message_sender_name(self, obj):
        msg = obj.messages.last()
        if not msg:
            return None
        return msg.sender.get_full_name() or msg.sender.username

    def get_unread_count(self, obj):
        user = self.context['request'].user
        try:
            read_record = obj.groupmessageread_set.get(user=user)
            last_read_id = read_record.last_read_id or 0
        except obj.groupmessageread_set.model.DoesNotExist:
            last_read_id = 0
        return obj.messages.filter(id__gt=last_read_id).exclude(sender=user).count()

    def get_created_by(self, obj):
        if not obj.created_by:
            return None
        return {'id': obj.created_by.id, 'name': obj.created_by.get_full_name()}


class GroupDetailSerializer(GroupSerializer):
    members = GroupMemberSerializer(source='memberships', many=True, read_only=True)

    class Meta(GroupSerializer.Meta):
        fields = GroupSerializer.Meta.fields + ['members']


class ConversationSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    user_name = serializers.CharField()
    user_role = serializers.CharField()
    last_message = serializers.CharField(allow_null=True)
    last_message_time = serializers.DateTimeField(allow_null=True)
    unread_count = serializers.IntegerField()
    is_online = serializers.BooleanField()
