from rest_framework import serializers
from django.utils import timezone
from .models import Patient, Appointment
from users.models import User


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = '__all__'
        read_only_fields = ['organization']

    def create(self, validated_data):
        validated_data['organization'] = self.context['request'].user.organization
        return super().create(validated_data)


class DoctorSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email']


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    doctor_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Appointment
        fields = '__all__'
        read_only_fields = ['organization', 'booked_by', 'created_at']

    def get_doctor_name(self, obj):
        if obj.doctor:
            return f"{obj.doctor.first_name} {obj.doctor.last_name}".strip()
        return None

    def validate(self, data):
        instance = Appointment(**data)
        organization = self.context['request'].user.organization
        instance.organization = organization
        if instance.patient_id and instance.patient.organization_id != organization.id:
            raise serializers.ValidationError({'patient': 'Patient does not belong to this organization.'})
        if instance.doctor_id:
            doctor = instance.doctor
            if doctor.organization_id != organization.id:
                raise serializers.ValidationError({'doctor': 'Doctor does not belong to this organization.'})
            if doctor.role != 'doctor':
                raise serializers.ValidationError({'doctor': 'Assigned user is not a doctor.'})
        if instance.pk is None and instance.appointment_dt and instance.appointment_dt < timezone.now():
            raise serializers.ValidationError({'appointment_dt': 'Appointment date cannot be in the past.'})
        return data

    def create(self, validated_data):
        validated_data['organization'] = self.context['request'].user.organization
        validated_data['booked_by'] = self.context['request'].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        instance.full_clean()
        instance.save()
        return instance
