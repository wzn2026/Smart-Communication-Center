"""
ASGI config for Smart Communication Center.

Supports both HTTP (Django) and WebSocket (Django Channels).
"""
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

# Initialize Django ASGI application early to ensure apps are loaded
django_asgi_app = get_asgi_application()

from apps.ws.middleware import JwtAuthMiddlewareStack  # noqa — must be after Django init
import apps.ws.routing  # noqa

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AllowedHostsOriginValidator(
        JwtAuthMiddlewareStack(
            URLRouter(apps.ws.routing.websocket_urlpatterns)
        )
    ),
})
