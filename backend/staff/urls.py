from rest_framework.routers import DefaultRouter
from .views import StaffMemberViewSet

router = DefaultRouter()
router.register(r'staff', StaffMemberViewSet, basename='staff')
urlpatterns = router.urls
