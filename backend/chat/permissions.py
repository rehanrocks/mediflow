from rest_framework.permissions import BasePermission

CHAT_ALLOWED_ROLES = {'admin', 'doctor', 'receptionist', 'staff'}
PATIENT_ROLE = 'patient'

GROUP_ADD_MAP = {
    'admin': {'admin', 'doctor', 'receptionist', 'staff'},
    'doctor': {'doctor', 'receptionist', 'staff'},
    'receptionist': {'receptionist', 'doctor', 'staff'},
    'staff': {'staff', 'doctor'},
}


def can_dm(sender, receiver):
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
    return group.memberships.filter(user=actor, is_admin=True).exists()


class IsChatParticipant(BasePermission):
    message = 'Patients are not permitted to use the chat system.'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            getattr(request.user, 'role', None) != PATIENT_ROLE
        )


class IsGroupMember(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.members.filter(id=request.user.id).exists()


class IsGroupAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        return can_manage_group(request.user, obj)
