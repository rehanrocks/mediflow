from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from users.views import CustomTokenObtainPairView, CustomTokenRefreshView
from appointments.dashboard_views import DashboardStatsView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('api/', include('appointments.urls')),
    path('api/', include('users.urls')),
    path('api/', include('staff.urls')),
    path('api/dashboard/stats/', DashboardStatsView.as_view(), name='dashboard_stats'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
