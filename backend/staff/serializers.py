import re
from rest_framework import serializers
from .models import StaffMember


class StaffListSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffMember
        fields = [
            'id', 'full_name', 'age', 'phone', 'address', 'role',
            'status', 'joining_date', 'created_at', 'notes',
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not data.get('notes'):
            data['notes'] = None
        return data


class StaffDetailSerializer(StaffListSerializer):
    pass


class StaffWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffMember
        fields = [
            'full_name', 'age', 'phone', 'address', 'role',
            'status', 'joining_date', 'notes',
        ]

    def validate_age(self, value):
        if value < 1 or value > 100:
            raise serializers.ValidationError('Age must be between 1 and 100.')
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
        validated_data['organization'] = self.context['request'].user.organization
        return StaffMember.objects.create(**validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('organization', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
