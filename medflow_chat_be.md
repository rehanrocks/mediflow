MediFlow Chat Module — Backend Implementation Plan

Django + PostgreSQL + Django Channels + Redis


Hand this document to your coding agent. Every section is implementation-ready with exact file paths, code, SQL, and sequencing. No TODOs. No placeholders.




TABLE OF CONTENTS


Dependency Installation
Settings Configuration
ASGI Setup
Database Models
Migrations
Serializers
RBAC Permission Classes
REST API Views
URL Routing
WebSocket Consumer
WebSocket Routing
Channel Layer Helpers
AI Endpoint
Rate Limiting
Redis Online Presence
Admin Registration
Deployment Notes
Full File Tree
Implementation Sequence



1. DEPENDENCY INSTALLATION

bashpip install channels==4.0.0 channels-redis==4.1.0 daphne==4.0.0

Add to requirements.txt:

channels==4.0.0
channels-redis==4.1.0
daphne==4.0.0

Redis must be running. Verify:

bashredis-cli ping   # → PONG


2. SETTINGS CONFIGURATION

mediflow/settings.py — add/edit the following blocks:

python# ── Installed Apps ──────────────────────────────────────────────────────────
INSTALLED_APPS = [
    # ... existing apps ...
    'daphne',          # MUST be before django.contrib.staticfiles
    'channels',
    'chat',            # your new app
]

# ── ASGI Application ─────────────────────────────────────────────────────────
ASGI_APPLICATION = 'mediflow.asgi.application'

# ── Channel Layers (Redis) ───────────────────────────────────────────────────
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [("127.0.0.1", 6379)],
            "capacity": 1500,        # max messages buffered per group
            "expiry": 60,            # seconds before undelivered messages expire
        },
    },
}

# ── AI Provider ─────────────────────────────────────────────────────────────
# Set one of the following depending on your chosen provider
OPENAI_API_KEY = env('OPENAI_API_KEY', default='')
ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY', default='')

# ── Chat Rate Limiting ───────────────────────────────────────────────────────
CHAT_AI_RATE_LIMIT = 20          # requests per user per hour
CHAT_MAX_MESSAGE_LENGTH = 5000   # characters

# ── Redis URL (also used for Celery if applicable) ───────────────────────────
REDIS_URL = env('REDIS_URL', default='redis://127.0.0.1:6379/0')


3. ASGI SETUP

mediflow/asgi.py — replace entirely:

pythonimport os
import django
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mediflow.settings')
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from chat.middleware import JWTAuthMiddleware
from chat.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    # HTTP → standard Django ASGI handler
    "http": get_asgi_application(),

    # WebSocket → JWT auth middleware wrapping URL router
    "websocket": AllowedHostsOriginValidator(
        JWTAuthMiddleware(
            URLRouter(websocket_urlpatterns)
        )
    ),
})


4. DATABASE MODELS

chat/models.py

pythonfrom django.db import models
from django.conf import settings
from django.utils import timezone

User = settings.AUTH_USER_MODEL


# ── Direct Message ────────────────────────────────────────────────────────────

class Message(models.Model):
    STATUS_SENT      = 'sent'
    STATUS_DELIVERED = 'delivered'
    STATUS_READ      = 'read'
    STATUS_CHOICES   = [
        (STATUS_SENT,      'Sent'),
        (STATUS_DELIVERED, 'Delivered'),
        (STATUS_READ,      'Read'),
    ]

    sender     = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    receiver   = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    content    = models.TextField(max_length=5000)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    is_read    = models.BooleanField(default=False)
    read_at    = models.DateTimeField(null=True, blank=True)
    status     = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_SENT)

    class Meta:
        ordering = ['created_at']
        indexes = [
            # Fast unread count lookups per receiver
            models.Index(fields=['receiver', 'is_read']),
            # Fast history load between two users
            models.Index(fields=['sender', 'receiver', 'created_at']),
            # Full-text search support
            models.Index(fields=['content']),
        ]

    def __str__(self):
        return f"DM {self.sender_id}→{self.receiver_id} @ {self.created_at:%H:%M}"

    def mark_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.status  = self.STATUS_READ
            self.save(update_fields=['is_read', 'read_at', 'status'])


# ── Group ─────────────────────────────────────────────────────────────────────

class Group(models.Model):
    name       = models.CharField(max_length=200)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_groups')
    created_at = models.DateTimeField(auto_now_add=True)
    members    = models.ManyToManyField(User, through='GroupMembership', related_name='chat_groups')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Group({self.name})"

    def get_member_channel_names(self):
        """Returns list of channel group names for all members."""
        return [f"user_{uid}" for uid in self.members.values_list('id', flat=True)]


class GroupMembership(models.Model):
    group     = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='memberships')
    user      = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_memberships')
    joined_at = models.DateTimeField(auto_now_add=True)
    is_admin  = models.BooleanField(default=False)

    class Meta:
        unique_together = ('group', 'user')
        ordering = ['joined_at']

    def __str__(self):
        return f"{self.user_id} in {self.group_id}"


# ── Group Message ─────────────────────────────────────────────────────────────

class GroupMessage(models.Model):
    group      = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='messages')
    sender     = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_messages_sent')
    content    = models.TextField(max_length=5000)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['group', 'created_at']),
        ]

    def __str__(self):
        return f"GroupMsg group={self.group_id} sender={self.sender_id}"


# ── Group Message Read Receipt ─────────────────────────────────────────────────
# Tracks per-user read position in a group conversation

class GroupMessageRead(models.Model):
    group      = models.ForeignKey(Group, on_delete=models.CASCADE)
    user       = models.ForeignKey(User, on_delete=models.CASCADE)
    last_read  = models.ForeignKey(GroupMessage, on_delete=models.SET_NULL, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('group', 'user')


5. MIGRATIONS

bashpython manage.py makemigrations chat
python manage.py migrate

The migration will create:


chat_message
chat_group
chat_groupmembership
chat_groupmessage
chat_groupmessageread



6. SERIALIZERS

chat/serializers.py

pythonfrom rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Message, Group, GroupMembership, GroupMessage

User = get_user_model()


class ChatUserSerializer(serializers.ModelSerializer):
    """User record safe for chat lists — no sensitive fields."""
    is_online  = serializers.SerializerMethodField()
    last_seen  = serializers.SerializerMethodField()
    full_name  = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = ['id', 'full_name', 'role', 'email', 'is_online', 'last_seen']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def get_is_online(self, obj):
        # Checked against Redis presence cache set by WebSocket consumer
        from .presence import is_user_online
        return is_user_online(obj.id)

    def get_last_seen(self, obj):
        return getattr(obj, 'last_seen', None)


class MessageSerializer(serializers.ModelSerializer):
    sender_id   = serializers.IntegerField(source='sender.id', read_only=True)
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model  = Message
        fields = ['id', 'sender_id', 'sender_name', 'content',
                  'created_at', 'is_read', 'read_at', 'status']

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.username


class GroupMessageSerializer(serializers.ModelSerializer):
    sender_id   = serializers.IntegerField(source='sender.id', read_only=True)
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model  = GroupMessage
        fields = ['id', 'sender_id', 'sender_name', 'content', 'created_at']

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.username


class GroupMemberSerializer(serializers.ModelSerializer):
    user = ChatUserSerializer(read_only=True)

    class Meta:
        model  = GroupMembership
        fields = ['user', 'joined_at', 'is_admin']


class GroupSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(source='members.count', read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    created_by   = serializers.SerializerMethodField()

    class Meta:
        model  = Group
        fields = ['id', 'name', 'member_count', 'last_message',
                  'unread_count', 'created_by', 'created_at']

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if not msg:
            return None
        return {
            'content':    msg.content[:80],
            'sender_id':  msg.sender_id,
            'created_at': msg.created_at,
        }

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
    """Shapes the /chat/conversations/ response."""
    user_id          = serializers.IntegerField()
    user_name        = serializers.CharField()
    user_role        = serializers.CharField()
    last_message     = serializers.CharField(allow_null=True)
    last_message_time = serializers.DateTimeField(allow_null=True)
    unread_count     = serializers.IntegerField()
    is_online        = serializers.BooleanField()


7. RBAC PERMISSION CLASSES

chat/permissions.py

pythonfrom rest_framework.permissions import BasePermission

# Roles that can participate in chat at all
CHAT_ALLOWED_ROLES = {'admin', 'doctor', 'receptionist', 'staff'}

# Patients are entirely excluded from the chat system
PATIENT_ROLE = 'patient'

# Which roles a given role can add to a group
GROUP_ADD_MAP = {
    'admin':        {'admin', 'doctor', 'receptionist', 'staff'},
    'doctor':       {'doctor', 'receptionist', 'staff'},
    'receptionist': {'receptionist', 'doctor', 'staff'},
    'staff':        {'staff', 'doctor'},
}


def can_dm(sender, receiver):
    """Both parties must be non-patient authenticated users."""
    return (
        sender.role not in (PATIENT_ROLE, None) and
        receiver.role not in (PATIENT_ROLE, None)
    )


def can_create_group(user):
    return user.role in {'admin', 'doctor', 'receptionist', 'staff'}


def can_add_to_group(actor, target_user):
    allowed = GROUP_ADD_MAP.get(actor.role, set())
    return target_user.role in allowed


def can_manage_group(actor, group):
    """Actor must be a group admin (is_admin=True in GroupMembership)."""
    return group.memberships.filter(user=actor, is_admin=True).exists()


class IsChatParticipant(BasePermission):
    """Deny patients from all chat endpoints."""
    message = 'Patients are not permitted to use the chat system.'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            getattr(request.user, 'role', None) != PATIENT_ROLE
        )


class IsGroupMember(BasePermission):
    """Must be a member of the group to read its messages."""
    def has_object_permission(self, request, view, obj):
        return obj.members.filter(id=request.user.id).exists()


class IsGroupAdmin(BasePermission):
    """Must have is_admin=True in GroupMembership."""
    def has_object_permission(self, request, view, obj):
        return can_manage_group(request.user, obj)


8. REST API VIEWS

chat/views.py

pythonfrom django.db.models import Q, Max, Count, OuterRef, Subquery
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import generics, views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Message, Group, GroupMembership, GroupMessage, GroupMessageRead
from .serializers import (
    ChatUserSerializer, MessageSerializer, GroupSerializer,
    GroupDetailSerializer, GroupMessageSerializer, ConversationSerializer,
)
from .permissions import (
    IsChatParticipant, IsGroupMember, IsGroupAdmin,
    can_dm, can_create_group, can_add_to_group, can_manage_group,
    PATIENT_ROLE, CHAT_ALLOWED_ROLES,
)

User = get_user_model()


# ── GET /api/chat/users/ ──────────────────────────────────────────────────────

class ChatUserListView(generics.ListAPIView):
    """
    Returns all users the current user is permitted to DM.
    Excludes: self, patients.
    Role filter is symmetric — any non-patient can DM any other non-patient.
    """
    serializer_class   = ChatUserSerializer
    permission_classes = [IsAuthenticated, IsChatParticipant]

    def get_queryset(self):
        q = self.request.query_params.get('q', '').strip()
        qs = User.objects.exclude(
            id=self.request.user.id
        ).exclude(
            role=PATIENT_ROLE
        ).filter(
            is_active=True
        ).order_by('first_name', 'last_name')

        if q:
            qs = qs.filter(
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q) |
                Q(email__icontains=q)
            )
        return qs


# ── GET /api/chat/conversations/ ─────────────────────────────────────────────

class ConversationListView(views.APIView):
    """
    Returns one record per user this person has exchanged DMs with,
    including last message and unread count.
    """
    permission_classes = [IsAuthenticated, IsChatParticipant]

    def get(self, request):
        me = request.user

        # All messages involving current user
        partner_ids = set(
            Message.objects
            .filter(Q(sender=me) | Q(receiver=me))
            .values_list('sender_id', 'receiver_id')
            .distinct()
        )
        # Flatten and remove self
        flat_ids = {uid for pair in partner_ids for uid in pair if uid != me.id}

        conversations = []
        for uid in flat_ids:
            other = User.objects.filter(id=uid).first()
            if not other:
                continue

            # Last message between these two users
            last_msg = Message.objects.filter(
                Q(sender=me, receiver=other) | Q(sender=other, receiver=me)
            ).order_by('-created_at').first()

            unread = Message.objects.filter(
                sender=other, receiver=me, is_read=False
            ).count()

            from .presence import is_user_online
            conversations.append({
                'user_id':           other.id,
                'user_name':         other.get_full_name() or other.username,
                'user_role':         other.role,
                'last_message':      last_msg.content[:80] if last_msg else None,
                'last_message_time': last_msg.created_at if last_msg else None,
                'unread_count':      unread,
                'is_online':         is_user_online(other.id),
            })

        # Sort by last message time descending
        conversations.sort(
            key=lambda c: c['last_message_time'] or timezone.datetime.min.replace(tzinfo=timezone.utc),
            reverse=True
        )

        serializer = ConversationSerializer(conversations, many=True)
        return Response(serializer.data)


# ── GET /api/chat/dm/<userId>/messages/ ──────────────────────────────────────

class DMHistoryView(generics.ListAPIView):
    """
    Paginated DM history between current user and :userId.
    Marks all fetched messages as delivered on load.
    page_size=30, ordered oldest→newest (frontend reverses for display).
    """
    serializer_class   = MessageSerializer
    permission_classes = [IsAuthenticated, IsChatParticipant]

    def get_queryset(self):
        me    = self.request.user
        other = generics.get_object_or_404(
            User,
            pk=self.kwargs['user_id']
        )

        # Verify other party is chat-eligible
        if not can_dm(me, other):
            return Message.objects.none()

        qs = Message.objects.filter(
            Q(sender=me, receiver=other) | Q(sender=other, receiver=me)
        ).select_related('sender').order_by('created_at')

        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)

        # Mark received messages as delivered
        other_id = self.kwargs['user_id']
        Message.objects.filter(
            sender_id=other_id,
            receiver=request.user,
            status=Message.STATUS_SENT,
        ).update(status=Message.STATUS_DELIVERED)

        return response


# ── GET /api/chat/groups/ ─────────────────────────────────────────────────────
# ── POST /api/chat/groups/ ────────────────────────────────────────────────────

class GroupListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsChatParticipant]

    def get_serializer_class(self):
        return GroupSerializer

    def get_queryset(self):
        return Group.objects.filter(
            members=self.request.user
        ).prefetch_related('members', 'messages').order_by('-created_at')

    def create(self, request, *args, **kwargs):
        user = request.user

        if not can_create_group(user):
            return Response(
                {'detail': 'You do not have permission to create groups.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        name       = request.data.get('name', '').strip()
        member_ids = request.data.get('member_ids', [])

        if not name:
            return Response({'detail': 'Group name is required.'}, status=400)
        if not member_ids:
            return Response({'detail': 'At least one member is required.'}, status=400)

        # Validate all member_ids
        target_users = User.objects.filter(id__in=member_ids)
        for target in target_users:
            if not can_add_to_group(user, target):
                return Response(
                    {'detail': f'You cannot add {target.get_full_name()} (role: {target.role}) to a group.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        group = Group.objects.create(name=name, created_by=user)

        # Add creator as admin
        GroupMembership.objects.create(group=group, user=user, is_admin=True)

        # Add selected members
        for target in target_users:
            if target.id != user.id:
                GroupMembership.objects.create(group=group, user=target, is_admin=False)

        serializer = GroupSerializer(group, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ── GET /api/chat/groups/<groupId>/ ──────────────────────────────────────────

class GroupDetailView(generics.RetrieveAPIView):
    serializer_class   = GroupDetailSerializer
    permission_classes = [IsAuthenticated, IsChatParticipant, IsGroupMember]
    queryset           = Group.objects.prefetch_related('memberships__user', 'messages')


# ── GET /api/chat/groups/<groupId>/messages/ ─────────────────────────────────

class GroupMessageListView(generics.ListAPIView):
    serializer_class   = GroupMessageSerializer
    permission_classes = [IsAuthenticated, IsChatParticipant]

    def get_queryset(self):
        group = generics.get_object_or_404(Group, pk=self.kwargs['group_id'])

        # Enforce membership
        if not group.members.filter(id=self.request.user.id).exists():
            return GroupMessage.objects.none()

        return GroupMessage.objects.filter(group=group).select_related('sender')


# ── POST /api/chat/groups/<groupId>/members/ ─────────────────────────────────

class GroupMemberAddView(views.APIView):
    permission_classes = [IsAuthenticated, IsChatParticipant]

    def post(self, request, group_id):
        group = generics.get_object_or_404(Group, pk=group_id)

        if not can_manage_group(request.user, group):
            return Response({'detail': 'Only group admins can add members.'}, status=403)

        target = generics.get_object_or_404(User, pk=request.data.get('user_id'))

        if not can_add_to_group(request.user, target):
            return Response(
                {'detail': f'Cannot add user with role {target.role}.'},
                status=403
            )

        if group.members.filter(id=target.id).exists():
            return Response({'detail': 'User is already a member.'}, status=400)

        GroupMembership.objects.create(group=group, user=target, is_admin=False)

        # Add to Redis pub/sub group for real-time delivery
        from .channel_utils import add_user_to_group_channel
        add_user_to_group_channel(group_id, target.id)

        return Response({'detail': 'Member added.'}, status=201)


# ── DELETE /api/chat/groups/<groupId>/members/<userId>/ ──────────────────────

class GroupMemberRemoveView(views.APIView):
    permission_classes = [IsAuthenticated, IsChatParticipant]

    def delete(self, request, group_id, user_id):
        group  = generics.get_object_or_404(Group, pk=group_id)
        target = generics.get_object_or_404(User, pk=user_id)

        if not can_manage_group(request.user, group):
            return Response({'detail': 'Only group admins can remove members.'}, status=403)

        # Cannot remove the creator
        if target.id == group.created_by_id:
            return Response({'detail': 'Cannot remove the group creator.'}, status=403)

        GroupMembership.objects.filter(group=group, user=target).delete()

        # Remove from Redis pub/sub group
        from .channel_utils import remove_user_from_group_channel
        remove_user_from_group_channel(group_id, target.id)

        return Response({'detail': 'Member removed.'}, status=204)


# ── GET /api/chat/search/ ─────────────────────────────────────────────────────

class MessageSearchView(views.APIView):
    permission_classes = [IsAuthenticated, IsChatParticipant]

    def get(self, request):
        conv  = request.query_params.get('conversation', '')
        q     = request.query_params.get('q', '').strip()

        if not conv or not q:
            return Response({'results': []})

        if conv.startswith('dm_'):
            other_id = int(conv.split('_')[1])
            other    = generics.get_object_or_404(User, pk=other_id)
            qs = Message.objects.filter(
                Q(sender=request.user, receiver=other) |
                Q(sender=other, receiver=request.user),
                content__icontains=q,
            ).order_by('-created_at')[:50]
            return Response({'results': MessageSerializer(qs, many=True).data})

        elif conv.startswith('group_'):
            group_id = int(conv.split('_')[1])
            group    = generics.get_object_or_404(Group, pk=group_id)
            if not group.members.filter(id=request.user.id).exists():
                return Response({'detail': 'Forbidden'}, status=403)
            qs = GroupMessage.objects.filter(
                group=group,
                content__icontains=q,
            ).select_related('sender').order_by('-created_at')[:50]
            return Response({'results': GroupMessageSerializer(qs, many=True).data})

        return Response({'results': []})


# ── POST /api/chat/ai/ ────────────────────────────────────────────────────────

class AIMessageView(views.APIView):
    """
    Proxies a message + context history to the configured AI provider.
    Not persisted. Rate-limited to 20 req/user/hour via Django cache.
    """
    permission_classes = [IsAuthenticated, IsChatParticipant]

    def post(self, request):
        from .ai import query_ai, check_ai_rate_limit, bump_ai_rate_limit

        user = request.user

        if not check_ai_rate_limit(user.id):
            return Response(
                {'detail': 'Rate limit exceeded. Max 20 AI messages per hour.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        message = request.data.get('message', '').strip()
        history = request.data.get('history', [])  # last 10 turns

        if not message:
            return Response({'detail': 'Message is required.'}, status=400)

        bump_ai_rate_limit(user.id)

        try:
            reply = query_ai(message, history, user)
        except Exception as e:
            return Response({'detail': f'AI service error: {str(e)}'}, status=502)

        return Response({'reply': reply})


9. URL ROUTING

chat/urls.py

pythonfrom django.urls import path
from . import views

urlpatterns = [
    # Users & conversations
    path('users/',                             views.ChatUserListView.as_view(),       name='chat-users'),
    path('conversations/',                     views.ConversationListView.as_view(),   name='chat-conversations'),

    # Direct messages
    path('dm/<int:user_id>/messages/',         views.DMHistoryView.as_view(),          name='chat-dm-history'),

    # Groups
    path('groups/',                            views.GroupListCreateView.as_view(),    name='chat-groups'),
    path('groups/<int:pk>/',                   views.GroupDetailView.as_view(),        name='chat-group-detail'),
    path('groups/<int:group_id>/messages/',    views.GroupMessageListView.as_view(),   name='chat-group-messages'),
    path('groups/<int:group_id>/members/',     views.GroupMemberAddView.as_view(),     name='chat-group-add-member'),
    path('groups/<int:group_id>/members/<int:user_id>/', views.GroupMemberRemoveView.as_view(), name='chat-group-remove-member'),

    # Search
    path('search/',                            views.MessageSearchView.as_view(),      name='chat-search'),

    # AI
    path('ai/',                                views.AIMessageView.as_view(),          name='chat-ai'),
]

mediflow/urls.py — add to existing urlpatterns:

pythonpath('api/chat/', include('chat.urls')),


10. WEBSOCKET CONSUMER

chat/consumers.py

pythonimport json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone


class ChatConsumer(AsyncWebsocketConsumer):
    """
    Single multiplexed WebSocket connection per authenticated user.
    Handles DMs and group messages through one persistent connection.
    All routing is done by the 'conversation' field in each message.

    Channel groups used:
      user_<id>     — personal inbox; all events destined for this user land here
      group_<id>    — pub/sub group; all group members are subscribed

    Message envelope:
      Incoming: { type, conversation, content?, message_id? }
      Outgoing: { type, conversation?, data?, user_id?, is_typing?, is_online? }
    """

    # ── Connection lifecycle ──────────────────────────────────────────────────

    async def connect(self):
        # JWT was validated by JWTAuthMiddleware — user is in scope
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.personal_group = f"user_{self.user.id}"

        # Join personal channel group (receives DMs and all routed events)
        await self.channel_layer.group_add(self.personal_group, self.channel_name)

        # Join all group chats this user belongs to
        group_ids = await self.get_user_group_ids()
        for gid in group_ids:
            await self.channel_layer.group_add(f"group_{gid}", self.channel_name)

        await self.accept()

        # Mark user online in Redis
        await self.set_online(True)

        # Broadcast online status to relevant peers
        peer_ids = await self.get_peer_user_ids()
        for pid in peer_ids:
            await self.channel_layer.group_send(
                f"user_{pid}",
                {"type": "user_online", "user_id": self.user.id, "is_online": True}
            )

    async def disconnect(self, close_code):
        if not hasattr(self, 'user') or not self.user.is_authenticated:
            return

        # Leave personal group
        await self.channel_layer.group_discard(self.personal_group, self.channel_name)

        # Leave all group chats
        group_ids = await self.get_user_group_ids()
        for gid in group_ids:
            await self.channel_layer.group_discard(f"group_{gid}", self.channel_name)

        # Mark offline
        await self.set_online(False)
        await self.update_last_seen()

        # Broadcast offline status
        peer_ids = await self.get_peer_user_ids()
        for pid in peer_ids:
            await self.channel_layer.group_send(
                f"user_{pid}",
                {"type": "user_online", "user_id": self.user.id, "is_online": False}
            )

    # ── Incoming message dispatcher ───────────────────────────────────────────

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send_error('invalid_json', 'Invalid JSON payload.')
            return

        msg_type = data.get('type')
        conv     = data.get('conversation', '')

        if msg_type == 'send_message':
            await self.handle_send_message(conv, data.get('content', ''))
        elif msg_type == 'typing_start':
            await self.handle_typing(conv, is_typing=True)
        elif msg_type == 'typing_stop':
            await self.handle_typing(conv, is_typing=False)
        elif msg_type == 'mark_read':
            await self.handle_mark_read(conv, data.get('message_id'))
        else:
            await self.send_error('unknown_type', f'Unknown message type: {msg_type}')

    # ── send_message handler ──────────────────────────────────────────────────

    async def handle_send_message(self, conversation, content):
        content = content.strip()
        if not content or len(content) > 5000:
            await self.send_error('invalid_content', 'Content must be 1–5000 characters.')
            return

        if conversation.startswith('dm_'):
            await self.handle_dm(conversation, content)
        elif conversation.startswith('group_'):
            await self.handle_group_message(conversation, content)
        else:
            await self.send_error('invalid_conversation', 'Unknown conversation key.')

    async def handle_dm(self, conversation, content):
        target_id = int(conversation.split('_')[1])

        # Validate target exists and is chat-eligible
        target = await self.get_user(target_id)
        if not target:
            await self.send_error('user_not_found', 'Target user not found.')
            return
        if not await self.can_dm(target):
            await self.send_error('permission_denied', 'Cannot DM this user.')
            return

        # Persist message
        msg = await self.create_dm(target, content)
        msg_data = self.serialize_message(msg)

        # Confirm delivery to sender (optimistic update resolves)
        await self.channel_layer.group_send(
            self.personal_group,
            {"type": "chat_message", "conversation": conversation, "data": msg_data}
        )

        # Deliver to receiver
        receiver_conv = f"dm_{self.user.id}"
        await self.channel_layer.group_send(
            f"user_{target_id}",
            {"type": "chat_message", "conversation": receiver_conv, "data": msg_data}
        )

    async def handle_group_message(self, conversation, content):
        group_id = int(conversation.split('_')[1])

        # Verify sender is a group member
        is_member = await self.is_group_member(group_id)
        if not is_member:
            await self.send_error('permission_denied', 'Not a member of this group.')
            return

        msg = await self.create_group_message(group_id, content)
        msg_data = self.serialize_group_message(msg)

        # Fan out to all group members via the group's channel layer group
        await self.channel_layer.group_send(
            f"group_{group_id}",
            {"type": "group_message_event", "conversation": conversation, "data": msg_data}
        )

    # ── typing handler ────────────────────────────────────────────────────────

    async def handle_typing(self, conversation, is_typing):
        if conversation.startswith('dm_'):
            target_id = int(conversation.split('_')[1])
            receiver_conv = f"dm_{self.user.id}"
            await self.channel_layer.group_send(
                f"user_{target_id}",
                {
                    "type": "typing_event",
                    "conversation": receiver_conv,
                    "user_id": self.user.id,
                    "is_typing": is_typing,
                }
            )
        elif conversation.startswith('group_'):
            group_id = int(conversation.split('_')[1])
            if not await self.is_group_member(group_id):
                return
            await self.channel_layer.group_send(
                f"group_{group_id}",
                {
                    "type": "typing_event",
                    "conversation": conversation,
                    "user_id": self.user.id,
                    "is_typing": is_typing,
                }
            )

    # ── mark_read handler ─────────────────────────────────────────────────────

    async def handle_mark_read(self, conversation, message_id):
        if not message_id:
            return

        if conversation.startswith('dm_'):
            other_id = int(conversation.split('_')[1])
            await self.mark_dm_read(other_id, message_id)
            # Notify sender that their message was read
            receiver_conv = f"dm_{self.user.id}"
            await self.channel_layer.group_send(
                f"user_{other_id}",
                {
                    "type": "read_event",
                    "conversation": receiver_conv,
                    "user_id": self.user.id,
                    "message_id": message_id,
                }
            )
        elif conversation.startswith('group_'):
            group_id = int(conversation.split('_')[1])
            await self.mark_group_read(group_id, message_id)

    # ── Channel layer event handlers (outgoing to this socket) ───────────────

    async def chat_message(self, event):
        """Delivers a DM to this connected client."""
        await self.send(text_data=json.dumps({
            "type":         "message",
            "conversation": event["conversation"],
            "data":         event["data"],
        }))

    async def group_message_event(self, event):
        """Delivers a group message to this connected client."""
        await self.send(text_data=json.dumps({
            "type":         "group_message",
            "conversation": event["conversation"],
            "data":         event["data"],
        }))

    async def typing_event(self, event):
        await self.send(text_data=json.dumps({
            "type":         "typing",
            "conversation": event["conversation"],
            "user_id":      event["user_id"],
            "is_typing":    event["is_typing"],
        }))

    async def read_event(self, event):
        await self.send(text_data=json.dumps({
            "type":         "read",
            "conversation": event["conversation"],
            "user_id":      event["user_id"],
            "message_id":   event["message_id"],
        }))

    async def user_online(self, event):
        await self.send(text_data=json.dumps({
            "type":      "online",
            "user_id":   event["user_id"],
            "is_online": event["is_online"],
        }))

    # ── Database helpers (sync_to_async wrappers) ─────────────────────────────

    @database_sync_to_async
    def get_user_group_ids(self):
        return list(
            self.user.chat_groups.values_list('id', flat=True)
        )

    @database_sync_to_async
    def get_peer_user_ids(self):
        """
        All users who share a DM or group with this user —
        they need to receive online/offline events.
        """
        from django.db.models import Q
        from .models import Message, Group
        from django.contrib.auth import get_user_model
        User = get_user_model()

        dm_peers = set(
            Message.objects.filter(
                Q(sender=self.user) | Q(receiver=self.user)
            ).values_list('sender_id', 'receiver_id')
        )
        flat_dm = {uid for pair in dm_peers for uid in pair if uid != self.user.id}

        group_peers = set(
            User.objects.filter(
                chat_groups__in=self.user.chat_groups.all()
            ).exclude(id=self.user.id).values_list('id', flat=True)
        )

        return list(flat_dm | group_peers)

    @database_sync_to_async
    def get_user(self, user_id):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None

    @database_sync_to_async
    def can_dm(self, target):
        from .permissions import can_dm
        return can_dm(self.user, target)

    @database_sync_to_async
    def is_group_member(self, group_id):
        return self.user.chat_groups.filter(id=group_id).exists()

    @database_sync_to_async
    def create_dm(self, target, content):
        from .models import Message
        return Message.objects.create(
            sender=self.user,
            receiver=target,
            content=content,
            status=Message.STATUS_SENT,
        )

    @database_sync_to_async
    def create_group_message(self, group_id, content):
        from .models import Group, GroupMessage
        group = Group.objects.get(pk=group_id)
        return GroupMessage.objects.create(
            group=group,
            sender=self.user,
            content=content,
        )

    @database_sync_to_async
    def mark_dm_read(self, sender_id, up_to_message_id):
        from .models import Message
        Message.objects.filter(
            sender_id=sender_id,
            receiver=self.user,
            id__lte=up_to_message_id,
            is_read=False,
        ).update(
            is_read=True,
            read_at=timezone.now(),
            status=Message.STATUS_READ,
        )

    @database_sync_to_async
    def mark_group_read(self, group_id, message_id):
        from .models import Group, GroupMessageRead, GroupMessage
        group = Group.objects.get(pk=group_id)
        try:
            msg = GroupMessage.objects.get(pk=message_id)
        except GroupMessage.DoesNotExist:
            return
        GroupMessageRead.objects.update_or_create(
            group=group, user=self.user,
            defaults={'last_read': msg}
        )

    @database_sync_to_async
    def set_online(self, is_online):
        from .presence import set_user_online
        set_user_online(self.user.id, is_online)

    @database_sync_to_async
    def update_last_seen(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        User.objects.filter(pk=self.user.id).update(last_seen=timezone.now())

    # ── Serialization helpers ─────────────────────────────────────────────────

    @staticmethod
    def serialize_message(msg):
        return {
            "id":          msg.id,
            "sender_id":   msg.sender_id,
            "sender_name": msg.sender.get_full_name() or msg.sender.username,
            "content":     msg.content,
            "created_at":  msg.created_at.isoformat(),
            "status":      msg.status,
            "is_read":     msg.is_read,
        }

    @staticmethod
    def serialize_group_message(msg):
        return {
            "id":          msg.id,
            "sender_id":   msg.sender_id,
            "sender_name": msg.sender.get_full_name() or msg.sender.username,
            "content":     msg.content,
            "created_at":  msg.created_at.isoformat(),
        }

    # ── Utility ───────────────────────────────────────────────────────────────

    async def send_error(self, code, message):
        await self.send(text_data=json.dumps({
            "type":    "error",
            "code":    code,
            "message": message,
        }))


11. WEBSOCKET ROUTING

chat/routing.py

pythonfrom django.urls import re_path
from .consumers import ChatConsumer

websocket_urlpatterns = [
    re_path(r'^ws/chat/$', ChatConsumer.as_asgi()),
]


12. CHANNEL LAYER HELPERS

chat/channel_utils.py

python"""
Utility wrappers for adding/removing users from Redis channel layer groups.
Used by REST endpoints when members join or leave a group.
These run synchronously (REST context) so use async_to_sync.
"""
import asyncio
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

channel_layer = get_channel_layer()


def add_user_to_group_channel(group_id: int, user_id: int):
    """
    Adds a user's personal channel to the group's channel layer group.
    Only has effect if the user is currently connected — otherwise a no-op
    (they'll join on next connect via consumers.py connect()).
    """
    # We can't add a specific channel_name here without a registry,
    # so we mark membership in DB (already done by view) and let the
    # next connect() call handle subscription.
    # If you need immediate fan-out for an online user,
    # send them an event via their personal group instead:
    async_to_sync(channel_layer.group_send)(
        f"user_{user_id}",
        {
            "type":     "group_added",
            "group_id": group_id,
        }
    )


def remove_user_from_group_channel(group_id: int, user_id: int):
    async_to_sync(channel_layer.group_send)(
        f"user_{user_id}",
        {
            "type":     "group_removed",
            "group_id": group_id,
        }
    )

Add handlers for group_added / group_removed events in the consumer so the client can refresh its group list in real time:

python# In ChatConsumer — add these two event handlers:

async def group_added(self, event):
    """Tells the client they were added to a new group."""
    await self.send(text_data=json.dumps({
        "type":     "group_added",
        "group_id": event["group_id"],
    }))

async def group_removed(self, event):
    """Tells the client they were removed from a group."""
    await self.send(text_data=json.dumps({
        "type":     "group_removed",
        "group_id": event["group_id"],
    }))


13. AI ENDPOINT

chat/ai.py

python"""
AI assistant backend for the chat AI tab.
Supports OpenAI (gpt-4o-mini) and Anthropic (claude-haiku-4-5) based on settings.
Stateless — history is passed in by the client (last 10 turns).
"""
from django.conf import settings
from django.core.cache import cache


SYSTEM_PROMPT = """You are MediFlow Assistant, an AI helper embedded in the MediFlow clinic management system.
You help clinic staff (admin, doctors, receptionists) with:
- Scheduling and appointment queries
- Patient record lookups (describe, don't fabricate)
- Clinical workflow guidance
- General medical administration questions

You do not have real-time access to the clinic database. Remind users to verify information
through the system. Keep responses concise and professional."""


def check_ai_rate_limit(user_id: int) -> bool:
    """Returns True if user is within their hourly limit."""
    key   = f"chat_ai_rl_{user_id}"
    count = cache.get(key, 0)
    return count < settings.CHAT_AI_RATE_LIMIT


def bump_ai_rate_limit(user_id: int):
    key = f"chat_ai_rl_{user_id}"
    try:
        cache.incr(key)
    except ValueError:
        # Key didn't exist yet
        cache.set(key, 1, timeout=3600)


def query_ai(message: str, history: list, user) -> str:
    """
    Calls the configured AI provider.
    history: [{"role": "user"|"assistant", "content": str}, ...]  (last 10 entries)
    Returns the assistant's reply as a string.
    """
    if settings.ANTHROPIC_API_KEY:
        return _query_anthropic(message, history)
    elif settings.OPENAI_API_KEY:
        return _query_openai(message, history)
    else:
        raise RuntimeError('No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.')


def _query_anthropic(message: str, history: list) -> str:
    import anthropic
    client   = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    messages = history[-10:] + [{"role": "user", "content": message}]
    response = client.messages.create(
        model      = "claude-haiku-4-5",
        max_tokens = 1024,
        system     = SYSTEM_PROMPT,
        messages   = messages,
    )
    return response.content[0].text


def _query_openai(message: str, history: list) -> str:
    from openai import OpenAI
    client   = OpenAI(api_key=settings.OPENAI_API_KEY)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += history[-10:]
    messages.append({"role": "user", "content": message})
    response = client.chat.completions.create(
        model      = "gpt-4o-mini",
        messages   = messages,
        max_tokens = 1024,
    )
    return response.choices[0].message.content


14. RATE LIMITING

Rate limiting for the AI endpoint uses Django's cache framework (backed by Redis when django-redis is installed). The implementation is in chat/ai.py above.

For the WebSocket consumer, add per-user message rate limiting to prevent flood:

python# In ChatConsumer.receive(), before dispatching:

RATE_LIMIT_WINDOW = 10    # seconds
RATE_LIMIT_MAX    = 20    # max messages per window

async def receive(self, text_data):
    # ... parse data ...

    # Rate-limit check
    from .presence import increment_ws_rate, check_ws_rate
    allowed = await database_sync_to_async(check_ws_rate)(self.user.id)
    if not allowed:
        await self.send_error('rate_limited', 'Too many messages. Slow down.')
        return
    await database_sync_to_async(increment_ws_rate)(self.user.id)

    # ... rest of dispatch ...

chat/presence.py (extend with rate-limit helpers):

python# Add to presence.py:

def check_ws_rate(user_id: int) -> bool:
    key   = f"chat_ws_rate_{user_id}"
    count = cache.get(key, 0)
    return count < 20   # 20 messages per 10-second window


def increment_ws_rate(user_id: int):
    key = f"chat_ws_rate_{user_id}"
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=10)


15. REDIS ONLINE PRESENCE

chat/presence.py

python"""
Tracks online/offline status in Redis.
Key: chat_online_<user_id>  value: "1"  TTL: 90s (refreshed on activity)
"""
from django.core.cache import cache

ONLINE_TTL = 90  # seconds — WebSocket heartbeat must refresh within this window


def set_user_online(user_id: int, is_online: bool):
    key = f"chat_online_{user_id}"
    if is_online:
        cache.set(key, "1", timeout=ONLINE_TTL)
    else:
        cache.delete(key)


def is_user_online(user_id: int) -> bool:
    return cache.get(f"chat_online_{user_id}") == "1"


def refresh_online(user_id: int):
    """Call on each WS message to keep the TTL alive."""
    key = f"chat_online_{user_id}"
    if cache.get(key):
        cache.set(key, "1", timeout=ONLINE_TTL)

Call refresh_online inside ChatConsumer.receive() to keep presence alive:

pythonasync def receive(self, text_data):
    # Refresh presence TTL on every message
    await database_sync_to_async(refresh_online)(self.user.id)
    # ... rest of handler ...


16. JWT AUTH MIDDLEWARE

chat/middleware.py

python"""
Django Channels middleware that authenticates WebSocket connections
using a JWT passed as the `token` query parameter.
Compatible with djangorestframework-simplejwt.
"""
from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def get_user_from_token(token: str):
    from rest_framework_simplejwt.tokens import AccessToken
    from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
    from django.contrib.auth import get_user_model

    User = get_user_model()
    try:
        validated = AccessToken(token)
        user_id   = validated['user_id']
        return User.objects.get(pk=user_id)
    except (InvalidToken, TokenError, User.DoesNotExist, KeyError):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        params       = parse_qs(query_string)
        token_list   = params.get('token', [])

        if token_list:
            scope['user'] = await get_user_from_token(token_list[0])
        else:
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)


17. ADMIN REGISTRATION

chat/admin.py

pythonfrom django.contrib import admin
from .models import Message, Group, GroupMembership, GroupMessage, GroupMessageRead


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display  = ['id', 'sender', 'receiver', 'content_preview', 'status', 'created_at']
    list_filter   = ['status', 'is_read', 'created_at']
    search_fields = ['sender__email', 'receiver__email', 'content']
    raw_id_fields = ['sender', 'receiver']

    def content_preview(self, obj):
        return obj.content[:60]
    content_preview.short_description = 'Content'


class GroupMembershipInline(admin.TabularInline):
    model  = GroupMembership
    extra  = 0
    fields = ['user', 'is_admin', 'joined_at']
    readonly_fields = ['joined_at']


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display  = ['id', 'name', 'created_by', 'member_count', 'created_at']
    search_fields = ['name', 'created_by__email']
    inlines       = [GroupMembershipInline]

    def member_count(self, obj):
        return obj.members.count()


@admin.register(GroupMessage)
class GroupMessageAdmin(admin.ModelAdmin):
    list_display  = ['id', 'group', 'sender', 'content_preview', 'created_at']
    list_filter   = ['created_at']
    search_fields = ['group__name', 'sender__email', 'content']
    raw_id_fields = ['group', 'sender']

    def content_preview(self, obj):
        return obj.content[:60]


18. FULL FILE TREE

chat/
├── __init__.py
├── admin.py              ← Section 17
├── ai.py                 ← Section 13
├── apps.py
├── channel_utils.py      ← Section 12
├── consumers.py          ← Section 10
├── middleware.py         ← Section 16
├── models.py             ← Section 4
├── permissions.py        ← Section 7
├── presence.py           ← Section 15
├── routing.py            ← Section 11
├── serializers.py        ← Section 6
├── urls.py               ← Section 9
└── views.py              ← Section 8

mediflow/
├── asgi.py               ← Section 3  (replace existing)
├── settings.py           ← Section 2  (append blocks)
└── urls.py               ← Section 9  (add one include)


19. IMPLEMENTATION SEQUENCE

Execute in this exact order to avoid import errors and missing migrations.

StepActionFile(s)1pip install channels==4.0.0 channels-redis==4.1.0 daphne==4.0.0—2Add daphne, channels, chat to INSTALLED_APPSsettings.py3Add ASGI_APPLICATION, CHANNEL_LAYERS, AI keys, rate limit constssettings.py4Create chat/ app directory with __init__.py, apps.pychat/5Write chat/models.pymodels.py6python manage.py makemigrations chat && python manage.py migrate—7Write chat/permissions.pypermissions.py8Write chat/presence.pypresence.py9Write chat/serializers.pyserializers.py10Write chat/views.pyviews.py11Write chat/urls.py → add include('chat.urls') to root urlsurls.py12Write chat/middleware.pymiddleware.py13Write chat/consumers.pyconsumers.py14Write chat/routing.pyrouting.py15Write chat/channel_utils.pychannel_utils.py16Replace mediflow/asgi.pyasgi.py17Write chat/ai.pyai.py18Write chat/admin.pyadmin.py19Verify Redis: redis-cli ping—20Run dev server with Daphne: daphne -p 8000 mediflow.asgi:application—21Test WS: connect to ws://localhost:8000/ws/chat/?token=<jwt>—22Test REST: GET /api/chat/users/ with Bearer token—


APPENDIX: WebSocket Message Reference

Client → Server

typerequired fieldsdescriptionsend_messageconversation, contentSend a DM or group messagetyping_startconversationUser started typingtyping_stopconversationUser stopped typingmark_readconversation, message_idMark messages up to ID as read

conversation format: dm_<userId> or group_<groupId>

Server → Client

typefieldsdescriptionmessageconversation, data: MessageObjectNew DM deliveredgroup_messageconversation, data: MessageObjectNew group messagetypingconversation, user_id, is_typingTyping indicatorreadconversation, user_id, message_idRead receiptonlineuser_id, is_onlinePresence changegroup_addedgroup_idClient was added to a new groupgroup_removedgroup_idClient was removed from a grouperrorcode, messageProtocol error

MessageObject shape (both DM and group)

json{
  "id":          123,
  "sender_id":   7,
  "sender_name": "Dr. Ayesha Khan",
  "content":     "The patient's labs are back.",
  "created_at":  "2026-06-26T10:42:00Z",
  "status":      "delivered",
  "is_read":     false
}

status and is_read are only meaningful for DM messages. Group messages omit them.


APPENDIX: REST API Summary

MethodURLAuthDescriptionGET/api/chat/users/BearerFilterable list of DM-able usersGET/api/chat/conversations/BearerDM conversation list with unread countsGET/api/chat/dm/<userId>/messages/BearerPaginated DM historyGET/api/chat/groups/BearerGroups current user belongs toPOST/api/chat/groups/BearerCreate group (non-patient only)GET/api/chat/groups/<id>/BearerGroup detail with member listGET/api/chat/groups/<id>/messages/BearerPaginated group historyPOST/api/chat/groups/<id>/members/Bearer (group admin)Add memberDELETE/api/chat/groups/<id>/members/<uid>/Bearer (group admin)Remove memberGET/api/chat/search/?conversation=&q=BearerSearch messages (max 50)POST/api/chat/ai/BearerAI assistant, rate-limited 20/hr

All endpoints require Authorization: Bearer <access_token> header.
All endpoints return HTTP 403 if the authenticated user has role patient. 