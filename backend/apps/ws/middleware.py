"""
JWT authentication middleware for Django Channels WebSocket connections.

Token is passed as a URL query parameter:
  ws://host/ws/inbox/?token=<jwt_access_token>

This is the standard approach for WebSocket auth because browsers
cannot send custom HTTP headers in WebSocket handshake requests.
"""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _get_user_from_token(raw_token: str):
    """Validate a JWT access token and return the User, or AnonymousUser."""
    if not raw_token:
        return AnonymousUser()
    try:
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
        from django.contrib.auth.models import User

        token = AccessToken(raw_token)
        user_id = token.get('user_id')
        if not user_id:
            return AnonymousUser()
        return User.objects.select_related().get(pk=user_id)
    except Exception:
        return AnonymousUser()


class JwtAuthMiddleware(BaseMiddleware):
    """
    Extracts the JWT token from ?token= query param and authenticates the user.
    Sets scope['user'] for downstream consumers.
    """

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode('utf-8')
        params = parse_qs(query_string)
        token_list = params.get('token', [])
        raw_token = token_list[0] if token_list else ''

        scope['user'] = await _get_user_from_token(raw_token)
        return await super().__call__(scope, receive, send)


def JwtAuthMiddlewareStack(inner):
    """Convenience wrapper — mirrors Channels' AuthMiddlewareStack pattern."""
    return JwtAuthMiddleware(inner)
