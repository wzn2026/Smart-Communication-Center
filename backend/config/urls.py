from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.throttling import AnonRateThrottle
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from config.health import HealthView


class LoginThrottle(AnonRateThrottle):
    scope = 'login'


class ThrottledTokenView(TokenObtainPairView):
    throttle_classes = [LoginThrottle]


urlpatterns = [
    path('admin/', admin.site.urls),

    # Health
    path('health/', HealthView.as_view(), name='health'),
    path('api/health/', HealthView.as_view(), name='api-health'),

    # Auth
    path('api/auth/token/', ThrottledTokenView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/', include('rest_framework.urls')),

    # API schema
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Apps
    path('api/', include('apps.tenants.urls')),
    path('api/', include('apps.channels.urls')),
    path('api/', include('apps.conversations.urls')),
    path('api/', include('apps.knowledge.urls')),
    path('api/', include('apps.external_api.urls')),
]
