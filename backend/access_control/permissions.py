from django.core.cache import cache
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from rest_framework.permissions import BasePermission

from access_control.models import ModulePermission


def get_role_permissions(role_id):
    cache_key = f"role_perms_{role_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    perms = ModulePermission.objects.filter(role_id=role_id).values("module", "access")
    result = {p["module"]: p["access"] for p in perms}
    cache.set(cache_key, result, timeout=60)
    return result


@receiver([post_save, post_delete], sender=ModulePermission)
def invalidate_permission_cache(sender, instance, **kwargs):
    cache_key = f"role_perms_{instance.role_id}"
    cache.delete(cache_key)


class HasModuleAccess(BasePermission):
    message = "You do not have permission to access this module."

    def __init__(self, module, required_access):
        self.module = module
        self.required_access = required_access

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        role = user.role_obj
        if not role:
            return self._legacy_check(user)

        perms = get_role_permissions(role.id)
        access = perms.get(self.module, "none")

        if self.required_access == "read":
            return access in ["read", "both"]
        if self.required_access == "write":
            return access in ["write", "both"]
        if self.required_access == "both":
            return access == "both"
        return False

    def _legacy_check(self, user):
        role_slug = user.role_slug
        if role_slug == "admin":
            return True
        if role_slug == "receptionist":
            if self.module == "staff":
                return False
            return True
        if role_slug == "doctor":
            if self.required_access == "read":
                return self.module in ["patients", "appointments", "doctors"]
            return False
        return False
