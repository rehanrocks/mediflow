from django.db.models import Q
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import generics, views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Message, Group, GroupMembership, GroupMessage
from .serializers import (
    ChatUserSerializer, MessageSerializer, GroupSerializer,
    GroupDetailSerializer, GroupMessageSerializer, ConversationSerializer,
)
from .permissions import (
    IsChatParticipant, IsGroupMember, IsGroupAdmin,
    can_dm, can_create_group, can_add_to_group, can_manage_group,
    PATIENT_ROLE,
)

User = get_user_model()


class ChatUserListView(generics.ListAPIView):
    serializer_class = ChatUserSerializer
    permission_classes = [IsAuthenticated, IsChatParticipant]

    def get_queryset(self):
        q = self.request.query_params.get('q', '').strip()
        qs = User.objects.filter(
            organization=self.request.user.organization,
        ).exclude(
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


class ConversationListView(views.APIView):
    permission_classes = [IsAuthenticated, IsChatParticipant]

    def get(self, request):
        me = request.user

        partner_ids = set(
            Message.objects
            .filter(Q(sender=me) | Q(receiver=me))
            .values_list('sender_id', 'receiver_id')
            .distinct()
        )
        flat_ids = {uid for pair in partner_ids for uid in pair if uid != me.id}

        conversations = []
        for uid in flat_ids:
            other = User.objects.filter(id=uid, organization=me.organization).first()
            if not other:
                continue

            last_msg = Message.objects.filter(
                Q(sender=me, receiver=other) | Q(sender=other, receiver=me)
            ).order_by('-created_at').first()

            unread = Message.objects.filter(
                sender=other, receiver=me, is_read=False
            ).count()

            from .presence import is_user_online
            conversations.append({
                'user_id': other.id,
                'user_name': other.get_full_name() or other.username,
                'user_role': other.role,
                'last_message': last_msg.content[:80] if last_msg else None,
                'last_message_time': last_msg.created_at if last_msg else None,
                'unread_count': unread,
                'is_online': is_user_online(other.id),
            })

        conversations.sort(
            key=lambda c: c['last_message_time'] or timezone.datetime.min.replace(tzinfo=timezone.utc),
            reverse=True
        )

        serializer = ConversationSerializer(conversations, many=True)
        return Response(serializer.data)


class DMHistoryView(generics.ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated, IsChatParticipant]

    def get_queryset(self):
        me = self.request.user
        other = generics.get_object_or_404(User, pk=self.kwargs['user_id'])

        if other.organization_id != me.organization_id:
            return Message.objects.none()

        if not can_dm(me, other):
            return Message.objects.none()

        qs = Message.objects.filter(
            Q(sender=me, receiver=other) | Q(sender=other, receiver=me)
        ).select_related('sender').order_by('created_at')

        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)

        other_id = self.kwargs['user_id']
        Message.objects.filter(
            sender_id=other_id,
            receiver=request.user,
            status=Message.STATUS_SENT,
        ).update(status=Message.STATUS_DELIVERED)

        Message.objects.filter(
            sender_id=other_id,
            receiver=request.user,
            is_read=False,
        ).update(is_read=True, read_at=timezone.now(), status=Message.STATUS_READ)

        return response


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

        name = request.data.get('name', '').strip()
        member_ids = request.data.get('member_ids', [])

        if not name:
            return Response({'detail': 'Group name is required.'}, status=400)
        if not member_ids:
            return Response({'detail': 'At least one member is required.'}, status=400)

        target_users = User.objects.filter(id__in=member_ids, organization=user.organization)
        for target in target_users:
            if not can_add_to_group(user, target):
                return Response(
                    {'detail': f'You cannot add {target.get_full_name()} (role: {target.role}) to a group.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        group = Group.objects.create(name=name, created_by=user)

        GroupMembership.objects.create(group=group, user=user, is_admin=True)

        for target in target_users:
            if target.id != user.id:
                GroupMembership.objects.create(group=group, user=target, is_admin=False)

        serializer = GroupSerializer(group, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class GroupDetailView(generics.RetrieveAPIView):
    serializer_class = GroupDetailSerializer
    permission_classes = [IsAuthenticated, IsChatParticipant, IsGroupMember]
    queryset = Group.objects.prefetch_related('memberships__user', 'messages')


class GroupMessageListView(generics.ListAPIView):
    serializer_class = GroupMessageSerializer
    permission_classes = [IsAuthenticated, IsChatParticipant]

    def get_queryset(self):
        group = generics.get_object_or_404(Group, pk=self.kwargs['group_id'])

        if not group.members.filter(id=self.request.user.id).exists():
            return GroupMessage.objects.none()

        return GroupMessage.objects.filter(group=group).select_related('sender').order_by('created_at')


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

        from .channel_utils import add_user_to_group_channel
        add_user_to_group_channel(group_id, target.id)

        return Response({'detail': 'Member added.'}, status=201)


class GroupMemberRemoveView(views.APIView):
    permission_classes = [IsAuthenticated, IsChatParticipant]

    def delete(self, request, group_id, user_id):
        group = generics.get_object_or_404(Group, pk=group_id)
        target = generics.get_object_or_404(User, pk=user_id)

        if not can_manage_group(request.user, group):
            return Response({'detail': 'Only group admins can remove members.'}, status=403)

        if target.id == group.created_by_id:
            return Response({'detail': 'Cannot remove the group creator.'}, status=403)

        GroupMembership.objects.filter(group=group, user=target).delete()

        from .channel_utils import remove_user_from_group_channel
        remove_user_from_group_channel(group_id, target.id)

        return Response({'detail': 'Member removed.'}, status=204)


class MessageSearchView(views.APIView):
    permission_classes = [IsAuthenticated, IsChatParticipant]

    def get(self, request):
        conv = request.query_params.get('conversation', '')
        q = request.query_params.get('q', '').strip()

        if not conv or not q:
            return Response({'results': []})

        if conv.startswith('dm_'):
            other_id = int(conv.split('_')[1])
            other = generics.get_object_or_404(User, pk=other_id)
            qs = Message.objects.filter(
                Q(sender=request.user, receiver=other) |
                Q(sender=other, receiver=request.user),
                content__icontains=q,
            ).order_by('-created_at')[:50]
            return Response({'results': MessageSerializer(qs, many=True).data})

        elif conv.startswith('group_'):
            group_id = int(conv.split('_')[1])
            group = generics.get_object_or_404(Group, pk=group_id)
            if not group.members.filter(id=request.user.id).exists():
                return Response({'detail': 'Forbidden'}, status=403)
            qs = GroupMessage.objects.filter(
                group=group,
                content__icontains=q,
            ).select_related('sender').order_by('-created_at')[:50]
            return Response({'results': GroupMessageSerializer(qs, many=True).data})

        return Response({'results': []})
