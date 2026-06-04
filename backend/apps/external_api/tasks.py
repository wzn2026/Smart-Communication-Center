"""
Celery tasks for async webhook and outbound message processing.
"""
import logging
import requests
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

# Errors that are safe to retry (transient / network)
_RETRYABLE = (requests.ConnectionError, requests.Timeout)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
    reject_on_worker_lost=True,
)
def process_webhook_task(self, webhook_event_id: str) -> None:
    """
    Process a single WebhookEvent asynchronously.

    Idempotency:
    - Checks `processed` flag before running.
    - Updates flag atomically after success.
    - Stores errors in `error_message` for inspection.
    """
    from apps.external_api.models import WebhookEvent
    from apps.providers.registry import get_provider
    from apps.external_api.services import process_inbound_message, handle_status_update

    try:
        webhook = WebhookEvent.objects.get(id=webhook_event_id)
    except WebhookEvent.DoesNotExist:
        logger.error("WebhookEvent %s not found — task aborted", webhook_event_id)
        return

    if webhook.processed:
        logger.info("WebhookEvent %s already processed — skip", webhook_event_id)
        return

    try:
        prov = get_provider(webhook.provider)

        inbound = prov.parse_inbound_webhook(webhook.raw_payload)
        if inbound:
            process_inbound_message(webhook.provider, inbound)
            webhook.event_type = 'inbound_message'
            webhook.processed = True
        else:
            status_upd = prov.parse_status_webhook(webhook.raw_payload)
            if status_upd:
                handle_status_update(status_upd)
                webhook.event_type = 'status_update'
                webhook.processed = True

        webhook.save(update_fields=['processed', 'event_type'])
        logger.info("WebhookEvent %s processed OK (%s)", webhook_event_id, webhook.event_type)

    except _RETRYABLE as exc:
        webhook.error_message = str(exc)
        webhook.save(update_fields=['error_message'])
        logger.warning("Transient error for %s: %s — retrying", webhook_event_id, exc)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 15)

    except Exception as exc:
        webhook.error_message = str(exc)
        webhook.save(update_fields=['error_message'])
        logger.exception("Permanent error for WebhookEvent %s: %s", webhook_event_id, exc)
        # Do not retry non-transient errors


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=15,
    acks_late=True,
)
def send_outbound_message_task(
    self,
    provider_name: str,
    to: str,
    body: str,
    from_number: str,
    message_id: str,
) -> None:
    """
    Send an outbound message via the provider, with retry on transient failures.
    Updates the Message record with the result.
    """
    from apps.conversations.models import Message
    from apps.providers.registry import get_provider

    try:
        msg = Message.objects.get(id=message_id)
    except Message.DoesNotExist:
        logger.error("Message %s not found for outbound send", message_id)
        return

    try:
        prov = get_provider(provider_name)
        result = prov.send_text_message(to=to, body=body, from_number=from_number)
        msg.provider_message_id = result.get('message_id', '')
        msg.status = 'sent'
        msg.metadata = {**msg.metadata, 'retry_count': self.request.retries}
        msg.save(update_fields=['provider_message_id', 'status', 'metadata'])
        logger.info("Outbound message %s sent via %s", message_id, provider_name)

    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else 0
        is_retryable = status_code in {429, 500, 502, 503, 504}

        if is_retryable:
            raise self.retry(exc=exc, countdown=2 ** self.request.retries * 10)

        # Non-retryable (4xx validation error) — mark failed
        body_text = exc.response.text[:300] if exc.response is not None else ''
        msg.status = 'failed'
        msg.failed_reason = f"HTTP {status_code}: {body_text}"
        msg.provider_error_code = str(status_code)
        msg.provider_error_payload = {'response': body_text}
        msg.metadata = {**msg.metadata, 'retry_count': self.request.retries}
        msg.save(update_fields=['status', 'failed_reason', 'provider_error_code',
                                'provider_error_payload', 'metadata'])
        logger.error("Non-retryable send failure for %s: HTTP %d", message_id, status_code)

    except _RETRYABLE as exc:
        msg.metadata = {**msg.metadata, 'retry_count': self.request.retries}
        msg.save(update_fields=['metadata'])
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 10)

    except Exception as exc:
        msg.status = 'failed'
        msg.failed_reason = str(exc)
        msg.provider_error_code = 'UNKNOWN'
        msg.metadata = {**msg.metadata, 'retry_count': self.request.retries}
        msg.save(update_fields=['status', 'failed_reason', 'provider_error_code', 'metadata'])
        logger.exception("Unexpected send failure for %s: %s", message_id, exc)
