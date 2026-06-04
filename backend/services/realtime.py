"""
Realtime event broadcasting service.

Publishes WebSocket events to Django Channels groups.
Safe to call from:
  - synchronous Django views
  - Celery tasks
  - synchronous service functions

Events never include sensitive fields:
  - provider raw payload
  - encrypted credentials (api_key, webhook_secret)
  - API keys
"""
import logging
from datetime import timezone as dt_tz

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    from django.utils import timezone
    return timezone.now().isoformat()


def _serialize_message(message) -> dict:
    """Safe message payload — no provider internals."""
    return {
        'id': str(message.id),
        'direction': message.direction,
        'message_type': message.message_type,
        'body': message.body,
        'status': message.status,
        'is_ai_generated': message.is_ai_generated,
        'failed_reason': message.failed_reason,
        'provider_error_code': message.provider_error_code,
        'created_at': message.created_at.isoformat(),
    }


def _serialize_conversation(conversation) -> dict:
    return {
        'id': str(conversation.id),
        'status': conversation.status,
        'category': conversation.category,
        'ai_enabled': conversation.ai_enabled,
        'assigned_to': (
            conversation.assigned_to.username
            if conversation.assigned_to else None
        ),
        'contact_name': conversation.contact.name if hasattr(conversation, 'contact') else '',
        'contact_phone': conversation.contact.phone if hasattr(conversation, 'contact') else '',
        'last_message_at': (
            conversation.last_message_at.isoformat()
            if conversation.last_message_at else None
        ),
    }


def _send(tenant_slug: str, conversation_id: str, event_type: str, payload: dict) -> None:
    """
    Core send function.
    Publishes to:
      - inbox_tenant_{tenant_slug}   (inbox list — all connected dashboard users for this tenant)
      - conv_{conversation_id}       (message thread — users viewing this specific conversation)
    """
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        full_payload = {
            'type': event_type,
            'tenant_id': '',  # filled by caller
            'conversation_id': conversation_id,
            'timestamp': _now_iso(),
            **payload,
        }

        send = async_to_sync(channel_layer.group_send)

        # Broadcast to tenant-wide inbox
        send(
            f'inbox_tenant_{tenant_slug}',
            {'type': 'inbox_event', 'payload': full_payload},
        )

        # Broadcast to conversation-specific group
        if conversation_id:
            send(
                f'conv_{conversation_id}',
                {'type': 'inbox_event', 'payload': full_payload},
            )

    except Exception as exc:
        logger.warning("Realtime broadcast failed (non-fatal): %s", exc)


# ─── Public API ───────────────────────────────────────────────────────────────

def broadcast_message_created(message) -> None:
    try:
        _send(
            tenant_slug=message.conversation.tenant.slug,
            conversation_id=str(message.conversation_id),
            event_type='message.created',
            payload={
                'tenant_id': str(message.tenant_id),
                'message': _serialize_message(message),
            },
        )
    except Exception as exc:
        logger.warning("broadcast_message_created failed: %s", exc)


def broadcast_message_status_updated(message) -> None:
    try:
        _send(
            tenant_slug=message.conversation.tenant.slug,
            conversation_id=str(message.conversation_id),
            event_type='message.status_updated',
            payload={
                'tenant_id': str(message.tenant_id),
                'message_id': str(message.id),
                'status': message.status,
                'provider_message_id': message.provider_message_id,
            },
        )
    except Exception as exc:
        logger.warning("broadcast_message_status_updated failed: %s", exc)


def broadcast_conversation_created(conversation) -> None:
    try:
        _send(
            tenant_slug=conversation.tenant.slug,
            conversation_id=str(conversation.id),
            event_type='conversation.created',
            payload={
                'tenant_id': str(conversation.tenant_id),
                'conversation': _serialize_conversation(conversation),
            },
        )
    except Exception as exc:
        logger.warning("broadcast_conversation_created failed: %s", exc)


def broadcast_conversation_updated(conversation) -> None:
    try:
        _send(
            tenant_slug=conversation.tenant.slug,
            conversation_id=str(conversation.id),
            event_type='conversation.updated',
            payload={
                'tenant_id': str(conversation.tenant_id),
                'conversation': _serialize_conversation(conversation),
            },
        )
    except Exception as exc:
        logger.warning("broadcast_conversation_updated failed: %s", exc)


def broadcast_conversation_needs_human(conversation) -> None:
    try:
        _send(
            tenant_slug=conversation.tenant.slug,
            conversation_id=str(conversation.id),
            event_type='conversation.needs_human',
            payload={
                'tenant_id': str(conversation.tenant_id),
                'conversation': _serialize_conversation(conversation),
            },
        )
    except Exception as exc:
        logger.warning("broadcast_conversation_needs_human failed: %s", exc)


def broadcast_conversation_assigned(conversation) -> None:
    try:
        _send(
            tenant_slug=conversation.tenant.slug,
            conversation_id=str(conversation.id),
            event_type='conversation.assigned',
            payload={
                'tenant_id': str(conversation.tenant_id),
                'conversation': _serialize_conversation(conversation),
                'assigned_to': (
                    conversation.assigned_to.username
                    if conversation.assigned_to else None
                ),
            },
        )
    except Exception as exc:
        logger.warning("broadcast_conversation_assigned failed: %s", exc)
