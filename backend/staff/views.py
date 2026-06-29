from rest_framework.viewsets import ModelViewSet
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import StaffMember
from .serializers import StaffListSerializer, StaffDetailSerializer, StaffWriteSerializer
from users.permissions import IsAdminRole
from organizations.permissions import HasFeature
from access_control.permissions import HasModuleAccess


class StaffMemberViewSet(ModelViewSet):
    filter_backends = [SearchFilter]
    search_fields = ['full_name', 'phone', 'role']

    def get_queryset(self):
        qs = StaffMember.objects.filter(
            organization=self.request.user.organization,
        )
        status_param = self.request.query_params.get('status')
        if status_param in ('active', 'inactive'):
            qs = qs.filter(status=status_param)
        phone_param = self.request.query_params.get('phone')
        if phone_param:
            qs = qs.filter(phone=phone_param)
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return StaffWriteSerializer
        if self.action == 'retrieve':
            return StaffDetailSerializer
        return StaffListSerializer

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdminRole(), HasFeature('staff')()]
        if self.action == 'create':
            return [IsAuthenticated(), IsAdminRole(), HasFeature('staff')()]
        if self.action in ('update', 'partial_update'):
            return [IsAuthenticated(), HasModuleAccess("staff", "write"), HasFeature('staff')()]
        return [IsAuthenticated(), HasModuleAccess("staff", "read"), HasFeature('staff')()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        result = getattr(self, "_last_provision_result", {})
        headers = self.get_success_headers(serializer.data)
        read_serializer = StaffListSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        response_data = read_serializer.data
        response_data["has_account"] = result.get("has_account", False)
        response_data["email_sent"] = result.get("email_sent", False)
        response_data["role_created"] = getattr(self, "_last_role_created", False)
        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        role_created = self._ensure_role_exists(
            instance.role, request.user.organization
        )
        read_serializer = StaffListSerializer(instance, context=self.get_serializer_context())
        data = read_serializer.data
        data["role_created"] = role_created
        return Response(data)

    def perform_create(self, serializer):
        staff = serializer.save(
            organization=self.request.user.organization,
        )
        self._last_role_created = self._ensure_role_exists(
            staff.role, self.request.user.organization
        )

        role_lower = staff.role.strip().lower()
        if role_lower == 'doctor':
            self._last_provision_result = self._create_doctor_from_staff(staff, serializer)
        else:
            self._last_provision_result = self._provision_staff_account(staff)

    def perform_update(self, serializer):
        serializer.save()

    def _ensure_role_exists(self, role_name, organization):
        from django.utils.text import slugify
        from access_control.models import Role
        if not role_name:
            return False
        role, created = Role.objects.get_or_create(
            organization=organization,
            slug=slugify(role_name),
            defaults={
                "name": role_name,
                "is_system": False,
            }
        )
        return created

    def _create_doctor_from_staff(self, staff, serializer):
        from django.contrib.auth import get_user_model
        from users.models import Qualification
        from users.provisioning import generate_temp_password, send_onboarding_email
        from access_control.models import Role

        User = get_user_model()
        doctor_fields = getattr(serializer, '_doctor_fields', {})
        request_data = self.request.data

        first_name = (doctor_fields.get('first_name')
                      or request_data.get('first_name')
                      or (staff.full_name.split()[0] if staff.full_name else 'Doctor'))
        last_name = (doctor_fields.get('last_name')
                     or request_data.get('last_name')
                     or (' '.join(staff.full_name.split()[1:]) if staff.full_name else ''))

        qual_name = (doctor_fields.get('qualification')
                     or request_data.get('qualification', '')).strip()
        qualification_obj = None
        if qual_name:
            qualification_obj, _ = Qualification.objects.get_or_create(
                name=qual_name.lower()
            )

        specializations = (doctor_fields.get('specializations')
                           or request_data.get('specializations', []))
        if not isinstance(specializations, list):
            specializations = []

        experience_years = int(doctor_fields.get('experience_years')
                              or request_data.get('experience_years', 0) or 0)

        shift_start = (doctor_fields.get('shift_start')
                       or request_data.get('shift_start'))
        shift_end = (doctor_fields.get('shift_end')
                     or request_data.get('shift_end'))

        doctor_status = request_data.get('status', 'active')
        join_date = request_data.get('joining_date') or staff.joining_date

        doctor = User.objects.create_user(
            username=staff.email.lower(),
            email=staff.email.lower(),
            first_name=str(first_name).strip(),
            last_name=str(last_name).strip(),
            role=User.Role.DOCTOR,
            organization=staff.organization,
            phone=staff.phone,
            qualification=qual_name,
            qualification_obj=qualification_obj,
            specializations=specializations,
            experience_years=min(experience_years, 60),
            shift_start=shift_start,
            shift_end=shift_end,
            status=doctor_status if doctor_status in ('active', 'inactive', 'on_leave') else 'active',
            join_date=join_date,
            is_active=True,
            force_password_change=True,
            has_account=True,
        )

        temp_password = generate_temp_password()
        doctor.set_password(temp_password)

        try:
            role_obj = Role.objects.get(slug='doctor', is_system=True)
        except Role.DoesNotExist:
            role_obj = Role.objects.filter(
                slug='doctor', organization=staff.organization
            ).first()

        doctor.role_obj = role_obj
        doctor.save(update_fields=['password', 'role_obj'])

        staff.user = doctor
        staff.has_account = True
        staff.save(update_fields=['user', 'has_account'])

        email_sent = send_onboarding_email(
            first_name=first_name,
            email=staff.email,
            temp_password=temp_password,
        )

        return {
            "has_account": True,
            "email_sent": email_sent,
        }

    def _provision_staff_account(self, staff):
        try:
            from users.provisioning import provision_user_account
            from django.utils.text import slugify
            role_slug = slugify(staff.role) if staff.role else "staff"
            result = provision_user_account(
                profile=staff,
                role_slug=role_slug,
                organization=staff.organization,
            )
            return {
                "has_account": True,
                "email_sent": result["email_sent"],
            }
        except ValueError as e:
            import logging
            logging.getLogger(__name__).error(
                f"Account provisioning failed for staff {staff.id}: {e}"
            )
            return {"has_account": False, "email_sent": False}

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=204)
