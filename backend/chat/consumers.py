import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone


class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.personal_group = f"user_{self.user.id}"

        await self.channel_layer.group_add(self.personal_group, self.channel_name)

        group_ids = await self.get_user_group_ids()
        for gid in group_ids:
            await self.channel_layer.group_add(f"group_{gid}", self.channel_name)

        await self.accept()

        await self.set_online(True)

        peer_ids = await self.get_peer_user_ids()
        for pid in peer_ids:
            await self.channel_layer.group_send(
                f"user_{pid}",
                {"type": "user_online", "user_id": self.user.id, "is_online": True}
            )

    async def disconnect(self, close_code):
        if not hasattr(self, 'user') or not self.user.is_authenticated:
            return

        await self.channel_layer.group_discard(self.personal_group, self.channel_name)

        group_ids = await self.get_user_group_ids()
        for gid in group_ids:
            await self.channel_layer.group_discard(f"group_{gid}", self.channel_name)

        await self.set_online(False)
        await self.update_last_seen()

        peer_ids = await self.get_peer_user_ids()
        for pid in peer_ids:
            await self.channel_layer.group_send(
                f"user_{pid}",
                {"type": "user_online", "user_id": self.user.id, "is_online": False}
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send_error('invalid_json', 'Invalid JSON payload.')
            return

        from .presence import refresh_online
        await database_sync_to_async(refresh_online)(self.user.id)

        msg_type = data.get('type')
        conv = data.get('conversation', '')

        if msg_type == 'send_message':
            await self.handle_send_message(conv, data.get('content', ''))
        elif msg_type == 'typing_start':
            await self.handle_typing(conv, is_typing=True)
        elif msg_type == 'typing_stop':
            await self.handle_typing(conv, is_typing=False)
        elif msg_type == 'mark_read':
            await self.handle_mark_read(conv, data.get('message_id'))
        elif msg_type == 'ping':
            pass  # heartbeat — nothing to do
        else:
            await self.send_error('unknown_type', f'Unknown message type: {msg_type}')

    async def handle_send_message(self, conversation, content):
        content = content.strip()
        if not content or len(content) > 5000:
            await self.send_error('invalid_content', 'Content must be 1-5000 characters.')
            return

        if conversation.startswith('dm_'):
            await self.handle_dm(conversation, content)
        elif conversation.startswith('group_'):
            await self.handle_group_message(conversation, content)
        else:
            await self.send_error('invalid_conversation', 'Unknown conversation key.')

    async def handle_dm(self, conversation, content):
        target_id = int(conversation.split('_')[1])

        target = await self.get_user(target_id)
        if not target:
            await self.send_error('user_not_found', 'Target user not found.')
            return
        if not await self.can_dm(target):
            await self.send_error('permission_denied', 'Cannot DM this user.')
            return

        msg = await self.create_dm(target, content)
        msg_data = self.serialize_message(msg)

        await self.channel_layer.group_send(
            self.personal_group,
            {"type": "chat_message", "conversation": conversation, "data": msg_data}
        )

        receiver_conv = f"dm_{self.user.id}"
        await self.channel_layer.group_send(
            f"user_{target_id}",
            {"type": "chat_message", "conversation": receiver_conv, "data": msg_data}
        )

    async def handle_group_message(self, conversation, content):
        group_id = int(conversation.split('_')[1])

        is_member = await self.is_group_member(group_id)
        if not is_member:
            await self.send_error('permission_denied', 'Not a member of this group.')
            return

        msg = await self.create_group_message(group_id, content)
        msg_data = self.serialize_group_message(msg)

        await self.channel_layer.group_send(
            f"group_{group_id}",
            {"type": "group_message_event", "conversation": conversation, "data": msg_data}
        )

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

    async def handle_mark_read(self, conversation, message_id):
        if not message_id:
            return

        if conversation.startswith('dm_'):
            other_id = int(conversation.split('_')[1])
            await self.mark_dm_read(other_id, message_id)
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

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "message",
            "conversation": event["conversation"],
            "data": event["data"],
        }))

    async def group_message_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "group_message",
            "conversation": event["conversation"],
            "data": event["data"],
        }))

    async def typing_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "typing",
            "conversation": event["conversation"],
            "user_id": event["user_id"],
            "is_typing": event["is_typing"],
        }))

    async def read_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "read",
            "conversation": event["conversation"],
            "user_id": event["user_id"],
            "message_id": event["message_id"],
        }))

    async def user_online(self, event):
        await self.send(text_data=json.dumps({
            "type": "online",
            "user_id": event["user_id"],
            "is_online": event["is_online"],
        }))

    async def group_added(self, event):
        await self.send(text_data=json.dumps({
            "type": "group_added",
            "group_id": event["group_id"],
        }))

    async def group_removed(self, event):
        await self.send(text_data=json.dumps({
            "type": "group_removed",
            "group_id": event["group_id"],
        }))

    @database_sync_to_async
    def get_user_group_ids(self):
        return list(self.user.chat_groups.values_list('id', flat=True))

    @database_sync_to_async
    def get_peer_user_ids(self):
        from django.db.models import Q
        from .models import Message
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
        from .permissions import can_dm as _can_dm
        if target.organization_id != self.user.organization_id:
            return False
        return _can_dm(self.user, target)

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

    @staticmethod
    def serialize_message(msg):
        return {
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender_name": msg.sender.get_full_name() or msg.sender.username,
            "content": msg.content,
            "created_at": msg.created_at.isoformat(),
            "status": msg.status,
            "is_read": msg.is_read,
        }

    @staticmethod
    def serialize_group_message(msg):
        return {
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender_name": msg.sender.get_full_name() or msg.sender.username,
            "content": msg.content,
            "created_at": msg.created_at.isoformat(),
        }

    async def send_error(self, code, message):
        await self.send(text_data=json.dumps({
            "type": "error",
            "code": code,
            "message": message,
        }))
