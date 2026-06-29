from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

channel_layer = get_channel_layer()


def add_user_to_group_channel(group_id: int, user_id: int):
    async_to_sync(channel_layer.group_send)(
        f"user_{user_id}",
        {
            "type": "group_added",
            "group_id": group_id,
        }
    )


def remove_user_from_group_channel(group_id: int, user_id: int):
    async_to_sync(channel_layer.group_send)(
        f"user_{user_id}",
        {
            "type": "group_removed",
            "group_id": group_id,
        }
    )
