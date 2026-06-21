from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from organizations.models import OrganizationFeature


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['first_name'] = user.first_name
        token['last_name'] = user.last_name
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        data['role'] = user.role
        data['first_name'] = user.first_name
        data['last_name'] = user.last_name

        if user.organization:
            data['organization_id'] = user.organization.id
            data['organization_name'] = user.organization.name
            enabled_features = OrganizationFeature.objects.filter(
                organization=user.organization,
                is_enabled=True,
            ).values_list('feature__key', flat=True)
            data['enabled_features'] = list(enabled_features)
        else:
            data['organization_id'] = None
            data['organization_name'] = None
            data['enabled_features'] = []

        return data
