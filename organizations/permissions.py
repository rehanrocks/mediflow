from rest_framework.permissions import BasePermission
from .models import OrganizationFeature


def HasFeature(feature_key):
    class _HasFeature(BasePermission):
        message = "This feature is not included in your organization's plan."

        def has_permission(self, request, view):
            if not request.user or not request.user.is_authenticated:
                return False
            org = request.user.organization
            if org is None:
                return False
            try:
                org_feature = OrganizationFeature.objects.get(
                    organization=org,
                    feature__key=feature_key,
                )
            except OrganizationFeature.DoesNotExist:
                return False
            return org_feature.is_enabled

    return _HasFeature
