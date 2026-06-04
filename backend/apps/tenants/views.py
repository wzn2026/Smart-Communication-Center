from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.utils import timezone

from apps.audit.models import AuditLog
from .models import Tenant, ApiKey, TenantSettings
from .serializers import (
    TenantSerializer, ApiKeySerializer,
    TenantSettingsSerializer, UserSerializer,
)
from .permissions import IsSuperAdmin, TenantIsolationMixin


class TenantViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    serializer_class = TenantSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsSuperAdmin()]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Tenant.objects.all()
        memberships = user.tenant_memberships.filter(
            is_active=True
        ).values_list('tenant_id', flat=True)
        return Tenant.objects.filter(id__in=memberships)

    @action(detail=True, methods=['post'], permission_classes=[IsSuperAdmin])
    def generate_api_key(self, request, pk=None):
        tenant = self.get_object()
        name = request.data.get('name', 'Default Key')
        expires_at = request.data.get('expires_at', None)

        api_key_obj, raw_key = ApiKey.generate(tenant, name, expires_at=expires_at)

        AuditLog.objects.create(
            tenant=tenant,
            user=request.user if request.user.pk else None,
            action='api_key_generated',
            entity_type='api_key',
            entity_id=str(api_key_obj.id),
            metadata={'name': name, 'prefix': api_key_obj.prefix},
        )

        return Response({
            'id': str(api_key_obj.id),
            'name': api_key_obj.name,
            'prefix': api_key_obj.prefix,
            'key': raw_key,
            'warning': 'Store this key securely. It will not be shown again.',
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def api_keys(self, request, pk=None):
        tenant = self.get_object()
        keys = tenant.api_keys.all()
        serializer = ApiKeySerializer(keys, many=True)
        return Response(serializer.data)


    @action(detail=True, methods=['get', 'patch'], permission_classes=[IsAuthenticated])
    def settings(self, request, pk=None):
        tenant = self.get_object()
        tenant_settings = TenantSettings.get_for_tenant(tenant)

        if request.method == 'GET':
            return Response(TenantSettingsSerializer(tenant_settings).data)

        serializer = TenantSettingsSerializer(
            tenant_settings, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class RevokeApiKeyView(APIView):
    """POST /api/tenants/{tenant_id}/api-keys/{key_id}/revoke/"""
    permission_classes = [IsSuperAdmin]

    def post(self, request, tenant_id, key_id):
        try:
            tenant = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            return Response({'error': 'Tenant not found'}, status=status.HTTP_404_NOT_FOUND)
        try:
            api_key = tenant.api_keys.get(id=key_id)
        except ApiKey.DoesNotExist:
            return Response({'error': 'API key not found'}, status=status.HTTP_404_NOT_FOUND)

        if api_key.is_revoked:
            return Response({'error': 'Key is already revoked'}, status=status.HTTP_400_BAD_REQUEST)

        api_key.revoke()

        AuditLog.objects.create(
            tenant=tenant,
            user=request.user if request.user.pk else None,
            action='api_key_revoked',
            entity_type='api_key',
            entity_id=str(api_key.id),
            metadata={'name': api_key.name, 'prefix': api_key.prefix},
        )
        return Response({'status': 'revoked', 'revoked_at': api_key.revoked_at})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .authentication import ApiKeyUser
        if isinstance(request.user, ApiKeyUser):
            return Response({
                'type': 'api_key',
                'tenant': TenantSerializer(request.user.tenant).data,
            })
        serializer = UserSerializer(request.user)
        memberships = (
            request.user.tenant_memberships
            .filter(is_active=True)
            .select_related('tenant')
        )
        return Response({
            'type': 'user',
            'user': serializer.data,
            'tenants': [
                {'tenant': TenantSerializer(m.tenant).data, 'role': m.role}
                for m in memberships
            ],
        })
