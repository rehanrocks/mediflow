from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import AccessToken
from django.utils import timezone
from django.db.models import Count, Q
from organizations.models import OrganizationFeature
from .models import User, DoctorAttendance

from access_control.models import ModulePermission, MODULE_CHOICES


def _resolve_role_permissions(role_obj):
    if role_obj:
        perms = ModulePermission.objects.filter(role=role_obj).values("module", "access")
        result = {p["module"]: p["access"] for p in perms}
        if not result:
            result = {m: "none" for m, _ in MODULE_CHOICES}
        return result
    return {m: "none" for m, _ in MODULE_CHOICES}


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    email = serializers.CharField(required=False, write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].required = False

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role_slug
        token['first_name'] = user.first_name
        token['last_name'] = user.last_name

        role_obj = user.role_obj
        token['role_slug'] = role_obj.slug if role_obj else user.role_slug
        permissions = _resolve_role_permissions(role_obj)
        token['permissions'] = permissions

        return token

    def validate(self, attrs):
        email = attrs.pop('email', None)
        username = attrs.get('username')

        if not username and not email:
            raise serializers.ValidationError({'username': 'Username or email is required.'})

        if email and not username:
            attrs['username'] = email

        data = super().validate(attrs)
        user = self.user
        request = self.context.get('request')

        data['id'] = user.id
        data['first_name'] = user.first_name
        data['last_name'] = user.last_name

        role_obj = user.role_obj
        data['role'] = user.role_slug
        data['role_detail'] = {
            "id": role_obj.id if role_obj else None,
            "name": role_obj.name if role_obj else user.role_slug,
            "slug": role_obj.slug if role_obj else user.role_slug,
            "is_system": role_obj.is_system if role_obj else True,
        }
        data['permissions'] = _resolve_role_permissions(role_obj)

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


class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)

        access_token = AccessToken(data['access'])
        user_id = access_token.get('user_id')
        if user_id:
            user = User.objects.filter(pk=user_id).first()
            if user:
                role_obj = user.role_obj
                permissions = _resolve_role_permissions(role_obj)

                access_token['role'] = user.role_slug
                access_token['first_name'] = user.first_name
                access_token['last_name'] = user.last_name
                access_token['role_slug'] = role_obj.slug if role_obj else user.role_slug
                access_token['permissions'] = permissions

                data['access'] = str(access_token)
                data['role'] = user.role_slug
                data['role_detail'] = {
                    "id": role_obj.id if role_obj else None,
                    "name": role_obj.name if role_obj else user.role_slug,
                    "slug": role_obj.slug if role_obj else user.role_slug,
                    "is_system": role_obj.is_system if role_obj else True,
                }
                data['permissions'] = permissions

        return data


def _get_today():
    return timezone.localdate()


def _get_week_start():
    today = _get_today()
    return today - timezone.timedelta(days=today.weekday())


class DoctorListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField(read_only=True)
    today_checkin = serializers.SerializerMethodField(read_only=True)
    today_checkout = serializers.SerializerMethodField(read_only=True)
    cases_today = serializers.SerializerMethodField(read_only=True)
    cases_this_week = serializers.SerializerMethodField(read_only=True)
    cases_this_month = serializers.SerializerMethodField(read_only=True)
    total_cases = serializers.SerializerMethodField(read_only=True)
    avg_cases_per_day = serializers.SerializerMethodField(read_only=True)
    daily_cases = serializers.SerializerMethodField(read_only=True)
    role = serializers.CharField(read_only=True)
    qualification = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'full_name', 'role',
            'email', 'phone', 'qualification', 'specializations',
            'experience_years', 'status', 'join_date',
            'shift_start', 'shift_end',
            'today_checkin', 'today_checkout',
            'cases_today', 'cases_this_week', 'cases_this_month',
            'total_cases', 'avg_cases_per_day', 'daily_cases',
        ]

    def get_qualification(self, obj):
        if obj.qualification_obj:
            return obj.qualification_obj.name
        return obj.qualification or ""

    def _get_attendance_map(self):
        return self.context.get('attendance_map', {})

    def _get_cases_map(self):
        return self.context.get('cases_map', {})

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()

    def get_today_checkin(self, obj):
        att_map = self._get_attendance_map()
        if att_map and obj.id in att_map:
            return att_map[obj.id].get('checkin_time')
        today = _get_today()
        att = DoctorAttendance.objects.filter(doctor=obj, date=today).first()
        if att and att.checkin_time:
            return att.checkin_time.strftime('%H:%M:%S')
        return None

    def get_today_checkout(self, obj):
        att_map = self._get_attendance_map()
        if att_map and obj.id in att_map:
            return att_map[obj.id].get('checkout_time')
        today = _get_today()
        att = DoctorAttendance.objects.filter(doctor=obj, date=today).first()
        if att and att.checkout_time:
            return att.checkout_time.strftime('%H:%M:%S')
        return None

    def get_cases_today(self, obj):
        cmap = self._get_cases_map()
        if cmap and obj.id in cmap:
            return cmap[obj.id]
        today = _get_today()
        from appointments.models import Appointment
        return Appointment.objects.filter(
            doctor=obj,
            appointment_dt__date=today,
            status__in=['completed', 'in_progress', 'scheduled'],
        ).count()

    def get_cases_this_week(self, obj):
        today = _get_today()
        week_start = _get_week_start()
        from appointments.models import Appointment
        return Appointment.objects.filter(
            doctor=obj,
            appointment_dt__date__gte=week_start,
            appointment_dt__date__lte=today,
            status__in=['completed', 'in_progress', 'scheduled'],
        ).count()

    def get_cases_this_month(self, obj):
        today = _get_today()
        from appointments.models import Appointment
        return Appointment.objects.filter(
            doctor=obj,
            appointment_dt__month=today.month,
            appointment_dt__year=today.year,
            status__in=['completed', 'in_progress', 'scheduled'],
        ).count()

    def get_total_cases(self, obj):
        from appointments.models import Appointment
        return Appointment.objects.filter(
            doctor=obj,
        ).exclude(status='cancelled').count()

    def get_avg_cases_per_day(self, obj):
        total = self.get_total_cases(obj)
        if obj.join_date:
            days = (_get_today() - obj.join_date).days or 1
        else:
            days = 1
        return round(total / days, 1)

    def get_daily_cases(self, obj):
        from datetime import timedelta
        from django.db.models import Count
        from django.db.models.functions import TruncDate
        from appointments.models import Appointment
        today = _get_today()
        seven_days_ago = today - timedelta(days=6)
        raw = Appointment.objects.filter(
            doctor=obj,
            appointment_dt__date__gte=seven_days_ago,
            status__in=['completed', 'in_progress', 'scheduled'],
        ).annotate(day=TruncDate('appointment_dt')).values('day').annotate(
            count=Count('id')
        ).order_by('day')
        day_map = {r['day']: r['count'] for r in raw}
        result = []
        for i in range(7):
            d = seven_days_ago + timedelta(days=i)
            result.append({'date': d.isoformat(), 'count': day_map.get(d, 0)})
        return result


class DoctorDetailSerializer(DoctorListSerializer):
    pass


class DoctorWriteSerializer(serializers.ModelSerializer):
    qualification = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'email', 'phone',
            'qualification', 'specializations', 'experience_years',
            'status', 'join_date', 'shift_start', 'shift_end',
        ]

    def validate_shift_end(self, value):
        if value:
            start_raw = self.initial_data.get('shift_start')
            if start_raw:
                parts = str(start_raw).split(':')
                h, m = parts[0], parts[1]
                start_time = timezone.datetime.strptime(f'{int(h):02d}:{int(m):02d}', '%H:%M').time()
                if value <= start_time:
                    raise serializers.ValidationError('Shift end must be after shift start.')
        return value

    def validate(self, data):
        instance = self.instance
        shift_start = data.get('shift_start', instance.shift_start if instance else None)
        shift_end = data.get('shift_end', instance.shift_end if instance else None)
        if shift_start and shift_end and shift_end <= shift_start:
            raise serializers.ValidationError({'shift_end': 'Shift end must be after shift start.'})

        experience = data.get('experience_years', instance.experience_years if instance else 0)
        if experience > 60:
            raise serializers.ValidationError({'experience_years': 'Experience years cannot exceed 60.'})

        specializations = data.get('specializations', instance.specializations if instance else None)
        if 'specializations' in data:
            if not isinstance(specializations, list) or len(specializations) == 0:
                raise serializers.ValidationError({'specializations': 'At least one specialization is required.'})

        request = self.context.get('request')
        org = request.user.organization if request else None

        phone = data.get('phone', instance.phone if instance else None)
        if phone and org:
            qs = User.objects.filter(organization=org, phone=phone, role='doctor')
            if instance:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise serializers.ValidationError({'phone': 'Phone already in use by another doctor in this organization.'})

        email = data.get('email', instance.email if instance else None)
        if email and org:
            qs = User.objects.filter(organization=org, email=email, role='doctor')
            if instance:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise serializers.ValidationError({'email': 'Email already in use by another doctor in this organization.'})

        return data

    def create(self, validated_data):
        request = self.context['request']
        validated_data['role'] = 'doctor'
        validated_data['organization'] = request.user.organization
        validated_data['username'] = validated_data.get('email') or f"doc_{request.user.organization_id}_{User.objects.filter(role='doctor').count()}"
        q_value = validated_data.pop('qualification', None)
        validated_data['qualification_obj'] = self._resolve_qualification(q_value)
        validated_data['qualification'] = q_value or ""
        user = User(**validated_data)
        user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        validated_data.pop('role', None)
        validated_data.pop('organization', None)
        if 'qualification' in validated_data:
            q_value = validated_data.pop('qualification', None)
            validated_data['qualification_obj'] = self._resolve_qualification(q_value)
            validated_data['qualification'] = q_value or ""
        return super().update(instance, validated_data)

    def _resolve_qualification(self, value):
        if not value or not value.strip():
            return None
        from .models import Qualification
        q, _ = Qualification.objects.get_or_create(
            name=value.strip().lower(),
        )
        return q


class DoctorAttendanceSerializer(serializers.ModelSerializer):
    cases = serializers.SerializerMethodField(read_only=True)
    on_time = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = DoctorAttendance
        fields = ['date', 'checkin_time', 'checkout_time', 'cases', 'on_time']

    def get_cases(self, obj):
        appt_map = self.context.get('appt_map', {})
        if appt_map and obj.date in appt_map:
            return appt_map[obj.date]
        return obj.cases_on_date

    def get_on_time(self, obj):
        return obj.on_time

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get('checkin_time') and not data['checkin_time'] == '':
            data['checkin_time'] = instance.checkin_time.strftime('%H:%M') if instance.checkin_time else None
        else:
            data['checkin_time'] = None
        if data.get('checkout_time') and not data['checkout_time'] == '':
            data['checkout_time'] = instance.checkout_time.strftime('%H:%M') if instance.checkout_time else None
        else:
            data['checkout_time'] = None
        return data


class DoctorAppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField(read_only=True)
    patient_age = serializers.SerializerMethodField(read_only=True)

    class Meta:
        from appointments.models import Appointment
        model = Appointment
        fields = [
            'id', 'appointment_dt', 'reason', 'status',
            'diagnosis', 'payment_status', 'patient_name', 'patient_age',
        ]

    def get_patient_name(self, obj):
        return obj.patient.full_name

    def get_patient_age(self, obj):
        if obj.patient.date_of_birth:
            today = _get_today()
            return today.year - obj.patient.date_of_birth.year - (
                (today.month, today.day) < (obj.patient.date_of_birth.month, obj.patient.date_of_birth.day)
            )
        return None


class DoctorStatsSerializer(serializers.Serializer):
    doctor_id = serializers.IntegerField(read_only=True)
    daily_cases = serializers.ListField(read_only=True)
    case_types = serializers.ListField(read_only=True)
    monthly_summary = serializers.ListField(read_only=True)
    attendance = DoctorAttendanceSerializer(many=True, read_only=True)
    top_conditions = serializers.ListField(read_only=True)
