"""
WebSocket consumers for the Live Inbox.

Routes:
  /ws/inbox/                        — subscribes to ALL events for the user's tenant
  /ws/conversations/{conv_id}/      — subscribes to a single conversation's events

Channel groups:
  inbox_tenant_{tenant_slug}        — all events within a tenant
  conv_{conversation_id}            — events for a specific conversation

Close codes:
  4001  — not authenticated
  4003  — no active tenant membership / no access to this conversation
"""
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)


# ─── DB helpers (run in sync thread pool) ────────────────────────────────────

@database_sync_to_async
def _get_tenant_for_user(user):
    """Return the first active tenant for the user, or None."""
    from apps.tenants.models import TenantMembership
    membership = (
        TenantMembership.objects
        .filter(user=user, is_active=True)
        .select_related('tenant')
        .first()
    )
    return membership.tenant if membership else None


@database_sync_to_async
def _user_can_access_conversation(user, conversation_id: str) -> bool:
    """True if the user has access to the given conversation (same tenant)."""
    from apps.conversations.models import Conversation
    from apps.tenants.models import TenantMembership

    if user.is_staff:
        return Conversation.objects.filter(id=conversation_id).exists()

    tenant_ids = TenantMembership.objects.filter(
        user=user, is_active=True
    ).values_list('tenant_id', flat=True)

    return Conversation.objects.filter(
        id=conversation_id,
        tenant_id__in=tenant_ids,
    ).exists()


@database_sync_to_async
def _get_conversation_tenant_slug(conversation_id: str) -> str:
    from apps.conversations.models import Conversation
    conv = Conversation.objects.select_related('tenant').get(id=conversation_id)
    return conv.tenant.slug


# ─── Inbox Consumer ───────────────────────────────────────────────────────────

class InboxConsumer(AsyncWebsocketConsumer):
    """
    Subscribe to all events within the user's tenant.
    Used by the Inbox page to receive live conversation/message updates.
    """

    async def connect(self):
        user = self.scope.get('user')

        if not user or not user.is_authenticated:
            logger.warning("WS InboxConsumer: unauthenticated connection rejected")
            await self.close(code=4001)
            return

        tenant = await _get_tenant_for_user(user)
        if not tenant:
            logger.warning(
                "WS InboxConsumer: user %s has no active tenant — connection rejected",
                user.username,
            )
            await self.close(code=4003)
            return

        self.tenant_slug = tenant.slug
        self.tenant_id = str(tenant.id)
        self.group_name = f'inbox_tenant_{self.tenant_slug}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        logger.info(
            "WS InboxConsumer: user %s connected to tenant %s",
            user.username, self.tenant_slug,
        )

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        # Read-only socket — ignore client messages (ping keepalive allowed)
        pass

    # ── Event handlers — type names map to method names (dots → underscores) ──

    async def inbox_event(self, event):
        """Forward any inbox event payload to the WebSocket client."""
        await self.send(text_data=json.dumps(event['payload']))


# ─── Conversation Consumer ────────────────────────────────────────────────────

class ConversationConsumer(AsyncWebsocketConsumer):
    """
    Subscribe to events for a single conversation.
    Used by the message thread view to receive live message updates.
    """

    async def connect(self):
        user = self.scope.get('user')
        conversation_id = self.scope['url_route']['kwargs']['conversation_id']

        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        try:
            can_access = await _user_can_access_conversation(user, conversation_id)
        except Exception:
            await self.close(code=4003)
            return

        if not can_access:
            logger.warning(
                "WS ConversationConsumer: user %s cannot access conv %s",
                user.username, conversation_id,
            )
            await self.close(code=4003)
            return

        self.conversation_id = conversation_id
        self.group_name = f'conv_{conversation_id}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        logger.info(
            "WS ConversationConsumer: user %s connected to conv %s",
            user.username, conversation_id,
        )

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        pass

    async def inbox_event(self, event):
        """Forward conversation-scoped events to the WebSocket client."""
        await self.send(text_data=json.dumps(event['payload']))
