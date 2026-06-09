from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django.utils import timezone
from django.contrib.auth.models import User

from apps.audit.models import AuditLog
from .models import Tenant, ApiKey, TenantSettings, TenantMembership, SubscriptionPlan, Subscription
from .serializers import (
    TenantSerializer, ApiKeySerializer,
    TenantSettingsSerializer, UserSerializer, TenantMembershipSerializer,
    SubscriptionPlanSerializer, SubscriptionSerializer,
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


    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def members(self, request, pk=None):
        tenant = self.get_object()
        memberships = tenant.memberships.filter(is_active=True).select_related('user')
        serializer = TenantMembershipSerializer(memberships, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='members/add', permission_classes=[IsSuperAdmin])
    def add_member(self, request, pk=None):
        tenant = self.get_object()
        username = request.data.get('username', '').strip()
        role = request.data.get('role', 'agent')

        if not username:
            return Response({'error': 'username مطلوب'}, status=status.HTTP_400_BAD_REQUEST)
        if role not in dict(TenantMembership.ROLES):
            return Response({'error': 'دور غير صالح'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'error': f'المستخدم "{username}" غير موجود'}, status=status.HTTP_404_NOT_FOUND)

        membership, created = TenantMembership.objects.get_or_create(
            tenant=tenant, user=user,
            defaults={'role': role, 'is_active': True},
        )
        if not created:
            membership.role = role
            membership.is_active = True
            membership.save(update_fields=['role', 'is_active'])

        return Response(TenantMembershipSerializer(membership).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], url_path='members/(?P<membership_id>[^/.]+)/role', permission_classes=[IsSuperAdmin])
    def update_member_role(self, request, pk=None, membership_id=None):
        tenant = self.get_object()
        role = request.data.get('role')
        if role not in dict(TenantMembership.ROLES):
            return Response({'error': 'دور غير صالح'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            membership = tenant.memberships.get(id=membership_id)
        except TenantMembership.DoesNotExist:
            return Response({'error': 'العضوية غير موجودة'}, status=status.HTTP_404_NOT_FOUND)
        membership.role = role
        membership.save(update_fields=['role'])
        return Response(TenantMembershipSerializer(membership).data)

    @action(detail=True, methods=['delete'], url_path='members/(?P<membership_id>[^/.]+)', permission_classes=[IsSuperAdmin])
    def remove_member(self, request, pk=None, membership_id=None):
        tenant = self.get_object()
        try:
            membership = tenant.memberships.get(id=membership_id)
        except TenantMembership.DoesNotExist:
            return Response({'error': 'العضوية غير موجودة'}, status=status.HTTP_404_NOT_FOUND)
        membership.is_active = False
        membership.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get', 'patch'], url_path='tenant-settings', permission_classes=[IsAuthenticated])
    def tenant_settings(self, request, pk=None):
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


class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSuperAdmin]
    serializer_class = UserSerializer

    def get_queryset(self):
        return User.objects.all().order_by('username')

    def create(self, request, *args, **kwargs):
        password = request.data.get('password', '')
        if not password or len(str(password)) < 4:
            return Response({'error': 'كلمة المرور مطلوبة (4 أحرف على الأقل)'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        user.set_password(password)
        user.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='set-password')
    def set_password(self, request, pk=None):
        user = self.get_object()
        password = request.data.get('password', '')
        if not password or len(str(password)) < 4:
            return Response({'error': 'كلمة المرور قصيرة جداً (4 أحرف على الأقل)'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(password)
        user.save()
        return Response({'status': 'ok'})


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


class SubscriptionPlanViewSet(viewsets.ModelViewSet):
    serializer_class = SubscriptionPlanSerializer

    def get_queryset(self):
        return SubscriptionPlan.objects.all()

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsSuperAdmin()]


class SubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = SubscriptionSerializer
    permission_classes = [IsSuperAdmin]

    def get_queryset(self):
        return Subscription.objects.select_related('tenant', 'plan').all()

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        qs = Subscription.objects.all()
        return Response({
            'total':     qs.count(),
            'active':    qs.filter(status='active').count(),
            'trial':     qs.filter(status='trial').count(),
            'expired':   qs.filter(status='expired').count(),
            'cancelled': qs.filter(status='cancelled').count(),
            'past_due':  qs.filter(status='past_due').count(),
        })


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
