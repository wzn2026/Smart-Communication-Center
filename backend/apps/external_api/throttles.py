"""
Custom throttle classes with per-tenant cache keys.

When a request is authenticated via API key the throttle key uses
the tenant slug (tenant-level rate limiting).
When unauthenticated (e.g. webhook callbacks) the throttle falls
back to IP-based keys (the DRF default).
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class _TenantAwareMixin:
    """Mixin that prefixes the cache key with the tenant slug when available."""

    def get_cache_key(self, request, view):
        from apps.tenants.authentication import ApiKeyUser

        user = getattr(request, 'user', None)

        if user and user.is_authenticated:
            if isinstance(user, ApiKeyUser):
                ident = f"tenant_{user.tenant.slug}"
                return self.cache_format % {
                    'scope': self.scope,
                    'ident': ident,
                }
            if getattr(user, 'pk', None):
                return self.cache_format % {
                    'scope': self.scope,
                    'ident': f"user_{user.pk}",
                }

        # Fall back to DRF's default IP-based key
        return super().get_cache_key(request, view)


class WebhookThrottle(_TenantAwareMixin, AnonRateThrottle):
    scope = 'webhook'


class MockInboundThrottle(_TenantAwareMixin, AnonRateThrottle):
    scope = 'mock_inbound'


class ExternalEventsThrottle(_TenantAwareMixin, UserRateThrottle):
    scope = 'external_events'
