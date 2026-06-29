from django.core.cache import cache

ONLINE_TTL = 90


def set_user_online(user_id: int, is_online: bool):
    key = f"chat_online_{user_id}"
    if is_online:
        cache.set(key, "1", timeout=ONLINE_TTL)
    else:
        cache.delete(key)


def is_user_online(user_id: int) -> bool:
    return cache.get(f"chat_online_{user_id}") == "1"


def refresh_online(user_id: int):
    key = f"chat_online_{user_id}"
    if cache.get(key):
        cache.set(key, "1", timeout=ONLINE_TTL)


def check_ws_rate(user_id: int) -> bool:
    key = f"chat_ws_rate_{user_id}"
    count = cache.get(key, 0)
    return count < 20


def increment_ws_rate(user_id: int):
    key = f"chat_ws_rate_{user_id}"
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=10)

