from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import RoleViewSet, RoleNamesView

router = DefaultRouter()
router.register(r"roles", RoleViewSet, basename="role")

urlpatterns = router.urls + [
    path("role-names/", RoleNamesView.as_view(), name="role-names"),
]
