from rest_framework import serializers
from .models import Patient, Appointment
from users.models import User


class PatientSerializer(serializers.ModelSerializer):
    age = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Patient
        fields = '__all__'
        read_only_fields = ['organization']

    def get_age(self, obj):
        if obj.date_of_birth:
            today = __import__('datetime').date.today()
            return today.year - obj.date_of_birth.year - (
                (today.month, today.day) < (obj.date_of_birth.month, obj.date_of_birth.day)
            )
        return None

    def create(self, validated_data):
        validated_data['organization'] = self.context['request'].user.organization
        return super().create(validated_data)


class DoctorSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'role', 'name']

    def get_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    doctor_name = serializers.SerializerMethodField(read_only=True)
    booked_by_name = serializers.SerializerMethodField(read_only=True)
    booked_at = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Appointment
        fields = '__all__'
        read_only_fields = ['organization', 'booked_by', 'created_at']

    def get_doctor_name(self, obj):
        if obj.doctor:
            return f"{obj.doctor.first_name} {obj.doctor.last_name}".strip()
        return None

    def get_booked_by_name(self, obj):
        if obj.booked_by:
            return f"{obj.booked_by.first_name} {obj.booked_by.last_name}".strip()
        return None

    def validate(self, data):
        organization = self.context['request'].user.organization

        if self.instance is None:
            appointment_dt = data.get('appointment_dt')
            if appointment_dt and appointment_dt < __import__('django').utils.timezone.now():
                raise serializers.ValidationError(
                    {'appointment_dt': 'Appointment date cannot be in the past.'}
                )

        if 'patient' in data and data['patient'].organization_id != organization.id:
            raise serializers.ValidationError({'patient': 'Patient does not belong to this organization.'})

        if 'doctor' in data and data['doctor']:
            doctor = data['doctor']
            if doctor.organization_id != organization.id:
                raise serializers.ValidationError({'doctor': 'Doctor does not belong to this organization.'})
            if doctor.role != 'doctor':
                raise serializers.ValidationError({'doctor': 'Assigned user is not a doctor.'})

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
