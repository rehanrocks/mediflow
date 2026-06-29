import re
from rest_framework import serializers
from .models import StaffMember


class StaffListSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffMember
        fields = [
            'id', 'full_name', 'email', 'age', 'phone', 'address', 'role',
            'status', 'joining_date', 'created_at', 'notes', 'has_account',
        ]
        read_only_fields = [
            'id', 'full_name', 'email', 'age', 'phone', 'address', 'role',
            'status', 'joining_date', 'created_at', 'notes', 'has_account',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not data.get('notes'):
            data['notes'] = None
        return data


class StaffDetailSerializer(StaffListSerializer):
    pass


class StaffWriteSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    qualification = serializers.CharField(required=False, allow_blank=True)
    specializations = serializers.JSONField(required=False, default=list)
    experience_years = serializers.IntegerField(required=False, default=0)
    shift_start = serializers.TimeField(required=False, allow_null=True)
    shift_end = serializers.TimeField(required=False, allow_null=True)

    class Meta:
        model = StaffMember
        fields = [
            'full_name', 'email', 'age', 'phone', 'address', 'role',
            'status', 'joining_date', 'shift_start', 'shift_end', 'notes',
            'first_name', 'last_name', 'qualification', 'specializations',
            'experience_years',
        ]

    def validate_email(self, value):
        if not value:
            raise serializers.ValidationError("Email is required.")
        value = value.lower().strip()
        org = self.context["request"].user.organization
        qs = StaffMember.objects.filter(
            organization=org, email__iexact=value,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "This email is already registered to another staff member."
            )
        from django.contrib.auth import get_user_model
        User = get_user_model()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "This email is already registered as a portal user."
            )
        return value

    def validate_age(self, value):
        if value < 18 or value > 60:
            raise serializers.ValidationError('Age must be between 18 and 60.')
        return value

    def validate_joining_date(self, value):
        from django.utils import timezone
        if value > timezone.localdate():
            raise serializers.ValidationError('Joining date cannot be in the future.')
        return value

    def validate_role(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Role is required.')
        return value.strip()

    def validate_phone(self, value):
        if not re.match(r'^\+[1-9]\d{7,14}$', value):
            raise serializers.ValidationError(
                'Phone must be in E.164 format (e.g. +923001234567).')
        return value

    def validate(self, data):
        phone = data.get('phone')
        if phone:
            organization = self.context['request'].user.organization
            qs = StaffMember.objects.filter(organization=organization, phone=phone)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({
                    'phone': 'This phone is already registered to another staff member.'
                })
        return data

    def create(self, validated_data):
        doctor_fields = {}
        for field in ('first_name', 'last_name', 'qualification',
                       'specializations', 'experience_years',
                       'shift_start', 'shift_end'):
            if field in validated_data:
                doctor_fields[field] = validated_data.pop(field)
        self._doctor_fields = doctor_fields
        validated_data['organization'] = self.context['request'].user.organization
        return StaffMember.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for field in ('first_name', 'last_name', 'qualification',
                       'specializations', 'experience_years',
                       'shift_start', 'shift_end', 'organization'):
            validated_data.pop(field, None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
