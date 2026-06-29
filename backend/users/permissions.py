from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsDoctorSelf(BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.user.role_slug == 'doctor' and request.user.pk == obj.pk


class CanViewDoctorFullProfile(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.role_slug in ('admin', 'receptionist'):
            return True
        if request.user.role_slug == 'doctor' and request.user.pk == obj.pk:
            return True
        return False


class IsAdminRole(BasePermission):
    message = "Only administrators can perform this action."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role_slug == 'admin'


class CanViewStaffModule(BasePermission):
    message = "You do not have permission to access the staff module."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = request.user.role_obj
        if not role:
            return False
        from access_control.permissions import get_role_permissions
        perms = get_role_permissions(role.id)
        access = perms.get("staff", "no_access")
        return access in ["read", "full_access"]


class IsAdminOrReceptionist(BasePermission):
    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role_slug in ('admin', 'receptionist')
        )


class IsReadOnlyForDoctor(BasePermission):
    message = "Doctors have read-only access."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role_slug != 'doctor'
