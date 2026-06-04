from rest_framework.permissions import BasePermission
from .authentication import ApiKeyUser


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )


class IsTenantMember(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if isinstance(request.user, ApiKeyUser):
            return True
        if request.user.is_staff:
            return True
        return request.user.tenant_memberships.filter(is_active=True).exists()


class TenantIsolationMixin:
    """Mixin that resolves the current tenant for any request."""

    def get_tenant(self):
        from .authentication import ApiKeyUser
        user = self.request.user

        if isinstance(user, ApiKeyUser):
            return user.tenant

        if user.is_staff:
            tenant_id = (
                self.request.query_params.get('tenant_id')
                or self.request.data.get('tenant_id')
            )
            if tenant_id:
                from .models import Tenant
                try:
                    return Tenant.objects.get(id=tenant_id)
                except Tenant.DoesNotExist:
                    return None

        membership = user.tenant_memberships.filter(is_active=True).first()
        return membership.tenant if membership else None
