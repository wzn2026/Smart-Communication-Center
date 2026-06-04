from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TenantViewSet, MeView, RevokeApiKeyView

router = DefaultRouter()
router.register('tenants', TenantViewSet, basename='tenant')

urlpatterns = [
    path('', include(router.urls)),
    path('me/', MeView.as_view(), name='me'),
    path(
        'tenants/<uuid:tenant_id>/api-keys/<uuid:key_id>/revoke/',
        RevokeApiKeyView.as_view(),
        name='revoke-api-key',
    ),
]
