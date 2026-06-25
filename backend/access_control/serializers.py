from django.utils.text import slugify
from rest_framework import serializers
from .models import Role, ModulePermission


class ModulePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModulePermission
        fields = ["module", "access", "can_read", "can_write"]
        read_only_fields = ["can_read", "can_write"]


class RoleSerializer(serializers.ModelSerializer):
    module_permissions = ModulePermissionSerializer(many=True, read_only=True)
    user_count = serializers.SerializerMethodField()

    def get_user_count(self, obj):
        return obj.users.filter(is_active=True).count()

    class Meta:
        model = Role
        fields = [
            "id", "name", "slug", "description", "is_system",
            "module_permissions", "user_count", "created_at",
        ]
        read_only_fields = ["slug", "is_system", "created_at", "user_count"]


class RoleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["name", "description"]

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Role name is required.")
        if len(value.strip()) < 2:
            raise serializers.ValidationError(
                "Role name must be at least 2 characters."
            )
        return value.strip()

    def validate(self, data):
        request = self.context.get("request")
        if request and request.user.organization:
            slug = slugify(data.get("name", ""))
            qs = Role.objects.filter(
                organization=request.user.organization,
                slug=slug,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"name": "A role with this name already exists."}
                )
        return data


class ModulePermissionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModulePermission
        fields = ["module", "access"]

    def validate_module(self, value):
        valid = [c[0] for c in ModulePermission._meta.get_field("module").choices]
        if value not in valid:
            raise serializers.ValidationError(f"Must be one of: {valid}")
        return value

    def validate_access(self, value):
        valid = [c[0] for c in ModulePermission._meta.get_field("access").choices]
        if value not in valid:
            raise serializers.ValidationError(f"Must be one of: {valid}")
        return value
