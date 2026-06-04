"""
Core business-logic service layer for inbound message processing and status updates.
Keeps all provider-neutral logic here, away from views and tasks.
"""
import logging
import time
import requests
from django.utils import timezone
from apps.channels.models import WhatsAppNumber, Contact
from apps.conversations.models import Conversation, Message

logger = logging.getLogger(__name__)


# ─── Outbound send with retry ─────────────────────────────────────────────────

_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
_RETRYABLE_EXCEPTIONS = (requests.ConnectionError, requests.Timeout)


def send_with_retry(provider, to: str, body: str, from_number: str, max_retries: int = 3) -> dict:
    """
    Send outbound text with exponential back-off on transient failures.
    Raises immediately for 4xx (validation) errors.
    """
    last_exc = None
    for attempt in range(max_retries):
        try:
            return provider.send_text_message(to=to, body=body, from_number=from_number)
        except requests.HTTPError as exc:
            code = exc.response.status_code if exc.response is not None else 0
            if code not in _RETRYABLE_STATUS_CODES:
                raise
            last_exc = exc
        except _RETRYABLE_EXCEPTIONS as exc:
            last_exc = exc

        sleep_seconds = 2 ** attempt
        logger.warning(
            "Send attempt %d failed (%s) — retrying in %ds",
            attempt + 1, last_exc, sleep_seconds
        )
        time.sleep(sleep_seconds)

    raise last_exc  # type: ignore[misc]


# ─── Status update handler ────────────────────────────────────────────────────

def handle_status_update(status_upd) -> None:
    """Apply a provider status update to the matching Message row."""
    if not status_upd.message_id:
        return

    update_fields: dict = {'status': status_upd.status}

    if status_upd.status == 'failed' and status_upd.error_data:
        update_fields['failed_reason'] = status_upd.error_data.get('title', '')
        update_fields['provider_error_code'] = str(status_upd.error_data.get('code', ''))
        update_fields['provider_error_payload'] = status_upd.error_data

    updated_msgs = list(
        Message.objects.filter(
            provider_message_id=status_upd.message_id
        ).select_related('conversation__tenant')
    )

    if updated_msgs:
        Message.objects.filter(
            provider_message_id=status_upd.message_id
        ).update(**update_fields)

        # Broadcast status update via WebSocket
        try:
            from services.realtime import broadcast_message_status_updated
            for msg in updated_msgs:
                msg.status = status_upd.status
                if status_upd.status == 'failed':
                    msg.failed_reason = update_fields.get('failed_reason', '')
                    msg.provider_error_code = update_fields.get('provider_error_code', '')
                broadcast_message_status_updated(msg)
        except Exception as exc:
            logger.warning("Status broadcast failed (non-fatal): %s", exc)

    logger.info(
        "Status update '%s' applied to %d message(s) with id '%s'",
        status_upd.status, len(updated_msgs), status_upd.message_id,
    )


# ─── Inbound message pipeline ─────────────────────────────────────────────────

def process_inbound_message(provider_name: str, inbound_msg, tenant=None):
    """
    Core inbound message pipeline.
    Returns the Conversation, or None if the number is unknown.
    """
    whatsapp_number = WhatsAppNumber.objects.filter(
        phone_number=inbound_msg.to_number, status='active'
    ).select_related('tenant').first()

    if not whatsapp_number and tenant:
        whatsapp_number = WhatsAppNumber.objects.filter(
            tenant=tenant, status='active'
        ).first()

    if not whatsapp_number:
        logger.warning("No active WhatsApp number for '%s'", inbound_msg.to_number)
        return None

    tenant = whatsapp_number.tenant

    contact, _ = Contact.objects.get_or_create(
        tenant=tenant,
        phone=inbound_msg.from_number,
        defaults={
            'name': inbound_msg.from_number,
            'source_platform': provider_name,
        },
    )

    is_new_conversation = False
    conversation = Conversation.objects.filter(
        tenant=tenant,
        contact=contact,
        status__in=['open', 'pending'],
    ).select_related('tenant', 'contact').first()

    if not conversation:
        conversation = Conversation.objects.create(
            tenant=tenant,
            contact=contact,
            whatsapp_number=whatsapp_number,
            status='open',
            category='other',
            ai_enabled=True,
        )
        is_new_conversation = True

    # Idempotency: skip if this provider_message_id was already processed
    if inbound_msg.message_id and Message.objects.filter(
        tenant=tenant,
        provider_message_id=inbound_msg.message_id,
        direction='inbound',
    ).exists():
        logger.info("Duplicate inbound '%s' — skipping", inbound_msg.message_id)
        return conversation

    message = Message.objects.create(
        tenant=tenant,
        conversation=conversation,
        direction='inbound',
        message_type='text',
        body=inbound_msg.body,
        provider_message_id=inbound_msg.message_id,
        status='delivered',
    )

    conversation.last_message_at = timezone.now()
    conversation.save(update_fields=['last_message_at', 'updated_at'])

    # Broadcast via WebSocket
    try:
        from services.realtime import (
            broadcast_message_created,
            broadcast_conversation_created,
            broadcast_conversation_updated,
        )
        if is_new_conversation:
            broadcast_conversation_created(conversation)
        else:
            broadcast_conversation_updated(conversation)
        broadcast_message_created(message)
    except Exception as exc:
        logger.warning("Inbound broadcast failed (non-fatal): %s", exc)

    from django.conf import settings
    if settings.ENABLE_FAQ_AUTOREPLY and conversation.ai_enabled:
        _run_faq_autoreply(conversation, inbound_msg, tenant, whatsapp_number)

    return conversation


def _run_faq_autoreply(conversation, inbound_msg, tenant, whatsapp_number) -> None:
    from services.faq_matcher import find_best_match
    from apps.providers.registry import get_provider
    from apps.tenants.models import TenantSettings

    ts = TenantSettings.get_for_tenant(tenant)

    if not ts.auto_reply_enabled:
        logger.info("Auto-reply disabled for tenant %s", tenant.slug)
        return

    ai_reply_count = Message.objects.filter(
        conversation=conversation,
        direction='outbound',
        is_ai_generated=True,
    ).count()

    if ai_reply_count >= ts.max_auto_replies_per_conversation:
        conversation.status = 'needs_human'
        conversation.save(update_fields=['status', 'updated_at'])
        try:
            from services.realtime import broadcast_conversation_needs_human
            broadcast_conversation_needs_human(conversation)
        except Exception:
            pass
        logger.info("Max auto-replies reached for conv %s", conversation.id)
        return

    match = find_best_match(
        inbound_msg.body, tenant,
        min_score=ts.low_confidence_threshold
    )

    if not match:
        if ts.human_escalation_enabled:
            conversation.status = 'needs_human'
            conversation.save(update_fields=['status', 'updated_at'])
            try:
                from services.realtime import broadcast_conversation_needs_human
                broadcast_conversation_needs_human(conversation)
            except Exception:
                pass
            logger.info("No FAQ match for conv %s — escalated", conversation.id)
        return

    if match.requires_human:
        conversation.status = 'needs_human'
        conversation.save(update_fields=['status', 'updated_at'])
        try:
            from services.realtime import broadcast_conversation_needs_human
            broadcast_conversation_needs_human(conversation)
        except Exception:
            pass
        return

    provider = get_provider(whatsapp_number.provider, whatsapp_number)
    send_status = 'sent'
    failed_reason = ''
    error_code = ''
    error_payload: dict = {}
    result: dict = {}

    try:
        result = send_with_retry(
            provider,
            to=conversation.contact.phone,
            body=match.answer,
            from_number=whatsapp_number.phone_number,
        )
    except Exception as exc:
        logger.error("Auto-reply send failed for conv %s: %s", conversation.id, exc)
        send_status = 'failed'
        failed_reason = str(exc)
        error_code = 'PROVIDER_ERROR'

    outbound_msg = Message.objects.create(
        tenant=tenant,
        conversation=conversation,
        direction='outbound',
        message_type='text',
        body=match.answer,
        status=send_status,
        is_ai_generated=True,
        provider_message_id=result.get('message_id', ''),
        metadata={'knowledge_item_id': str(match.id)},
        failed_reason=failed_reason,
        provider_error_code=error_code,
        provider_error_payload=error_payload,
    )

    conversation.last_message_at = timezone.now()
    conversation.save(update_fields=['last_message_at', 'updated_at'])

    # Broadcast auto-reply
    try:
        from services.realtime import broadcast_message_created, broadcast_conversation_updated
        broadcast_message_created(outbound_msg)
        broadcast_conversation_updated(conversation)
    except Exception as exc:
        logger.warning("Auto-reply broadcast failed (non-fatal): %s", exc)
