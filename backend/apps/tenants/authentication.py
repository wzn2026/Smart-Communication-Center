from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import ApiKey


class ApiKeyUser:
    """Minimal user-like object representing an authenticated API key."""

    def __init__(self, api_key):
        self.api_key = api_key
        self.tenant = api_key.tenant
        self.is_authenticated = True
        self.is_active = True
        self.is_staff = False
        self.pk = None

    def __str__(self):
        return f"ApiKey:{self.api_key.prefix}"


class ApiKeyAuthentication(BaseAuthentication):
    def authenticate(self, request):
        raw_key = request.META.get('HTTP_X_API_KEY', '').strip()
        if not raw_key:
            return None

        api_key = ApiKey.verify(raw_key)
        if not api_key:
            raise AuthenticationFailed(
                'Invalid, inactive, revoked, or expired API key.'
            )

        ApiKey.objects.filter(pk=api_key.pk).update(last_used_at=timezone.now())
        return (ApiKeyUser(api_key), None)
