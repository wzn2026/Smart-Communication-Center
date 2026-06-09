from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TenantViewSet, UserViewSet, SubscriptionPlanViewSet, SubscriptionViewSet, MeView, RevokeApiKeyView

router = DefaultRouter()
router.register('tenants', TenantViewSet, basename='tenant')
router.register('users', UserViewSet, basename='user')
router.register('subscription-plans', SubscriptionPlanViewSet, basename='subscription-plan')
router.register('subscriptions', SubscriptionViewSet, basename='subscription')

urlpatterns = [
    path('', include(router.urls)),
    path('me/', MeView.as_view(), name='me'),
    path(
        'tenants/<uuid:tenant_id>/api-keys/<uuid:key_id>/revoke/',
        RevokeApiKeyView.as_view(),
        name='revoke-api-key',
    ),
]
