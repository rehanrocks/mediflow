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
        request = self.context.get('request')
        data['id'] = user.id
        data['role'] = user.role
        data['first_name'] = user.first_name
        data['last_name'] = user.last_name

        if user.organization:
            org = user.organization
            data['organization_id'] = org.id
            data['organization_name'] = org.branding_name
            data['organization_logo'] = (
                request.build_absolute_uri(org.logo.url)
                if org.logo and request
                else None
            )
            enabled_features = OrganizationFeature.objects.filter(
                organization=org,
                is_enabled=True,
            ).values_list('feature__key', flat=True)
            data['enabled_features'] = list(enabled_features)
        else:
            data['organization_id'] = None
            data['organization_name'] = None
            data['organization_logo'] = None
            data['enabled_features'] = []

        return data
