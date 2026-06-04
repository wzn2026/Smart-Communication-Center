"""
External API views:
  - ExternalEventView       POST /api/external/events/
  - WhatsAppWebhookView     POST /api/webhooks/whatsapp/{provider}/
  - MockInboundMessageView  POST /api/mock/inbound-message/
"""
import logging
import uuid
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.tenants.authentication import ApiKeyAuthentication, ApiKeyUser
from apps.providers.registry import get_provider
from apps.providers.base import InboundMessage
from .models import ExternalEvent, WebhookEvent
from .serializers import ExternalEventSerializer, InboundWebhookSerializer
from .services import process_inbound_message
from .throttles import WebhookThrottle, MockInboundThrottle, ExternalEventsThrottle

logger = logging.getLogger(__name__)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_webhook_secret(provider: str, wa_number=None) -> str:
    """
    Resolve the webhook signing secret for a provider.
    Per-number secret takes precedence over the global WEBHOOK_SECRET.
    """
    if wa_number:
        per_number = wa_number.get_provider_webhook_secret()
        if per_number:
            return per_number
    return getattr(settings, 'WEBHOOK_SECRET', '') or ''


def _validate_signature(request, provider: str, raw_body: bytes, wa_number=None) -> bool:
    """
    Validate webhook signature. Rules:
    - If DEBUG=True and WEBHOOK_SECRET is empty: always allow (dev mode).
    - If WEBHOOK_SECRET is set (or per-number secret): validate strictly.
    Returns True if the request is valid, False if it should be rejected.
    """
    secret = _get_webhook_secret(provider, wa_number)

    if not secret:
        # Explicit test bypass OR debug mode with no secret configured
        if getattr(settings, 'BYPASS_WEBHOOK_SIGNATURE', False):
            return True
        if settings.DEBUG:
            return True
        logger.warning("Webhook from %s rejected: no WEBHOOK_SECRET configured", provider)
        return False

    prov = get_provider(provider, wa_number)
    sig_header = (
        request.META.get('HTTP_X_D360_SIGNATURE', '')
        or request.META.get('HTTP_X_HUB_SIGNATURE_256', '')
        or request.META.get('HTTP_X_SIGNATURE', '')
    )

    valid = prov.validate_webhook_signature(raw_body, sig_header, secret)
    if not valid:
        logger.warning(
            "Invalid webhook signature from provider '%s'. "
            "Header: '%s'. Expected HMAC-SHA256 over request body.",
            provider, sig_header[:20] if sig_header else '(missing)',
        )
    return valid


# ─── Views ────────────────────────────────────────────────────────────────────

class ExternalEventView(APIView):
    """POST /api/external/events/ — Nedaa and other platforms push events here."""
    authentication_classes = [ApiKeyAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [ExternalEventsThrottle]

    def post(self, request):
        if not isinstance(request.user, ApiKeyUser):
            return Response(
                {'error': 'API key authentication required.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        tenant = request.user.tenant
        serializer = ExternalEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        event = ExternalEvent.objects.create(
            tenant=tenant,
            source_platform=serializer.validated_data['source_platform'],
            event_type=serializer.validated_data['event_type'],
            payload=serializer.validated_data['payload'],
        )
        return Response(
            {'id': str(event.id), 'status': 'received'},
            status=status.HTTP_201_CREATED,
        )


class WhatsAppWebhookView(APIView):
    """
    POST /api/webhooks/whatsapp/{provider}/

    Security: validates HMAC-SHA256 signature when WEBHOOK_SECRET is configured.
    Processing: stores WebhookEvent and dispatches async Celery task immediately.
    Idempotency: de-duplicates on (provider, deduplication_key) before enqueuing.
    """
    permission_classes = [AllowAny]
    throttle_classes = [WebhookThrottle]

    def post(self, request, provider):
        # 1. Get raw request body for signature validation
        raw_body = request.body  # DRF doesn't consume this before we read it

        # 2. Signature validation
        if not _validate_signature(request, provider, raw_body):
            return Response(
                {'error': 'Invalid or missing webhook signature.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        prov = get_provider(provider)
        raw = request.data
        dedup_key = ''

        # 3. Extract deduplication key
        try:
            inbound_preview = prov.parse_inbound_webhook(raw)
            if inbound_preview:
                dedup_key = inbound_preview.message_id or ''
            elif not dedup_key:
                status_preview = prov.parse_status_webhook(raw)
                if status_preview:
                    dedup_key = status_preview.message_id or ''
        except Exception:
            pass

        # 4. Idempotency check
        if dedup_key and WebhookEvent.objects.filter(
            provider=provider,
            deduplication_key=dedup_key,
            processed=True,
        ).exists():
            logger.info("Duplicate webhook '%s' from %s — skipping", dedup_key, provider)
            return Response({'status': 'ok', 'note': 'duplicate'})

        # 5. Persist
        webhook = WebhookEvent.objects.create(
            provider=provider,
            raw_payload=raw,
            deduplication_key=dedup_key,
        )

        # 6. Enqueue async task and return immediately
        from .tasks import process_webhook_task
        from django.conf import settings as dj_settings

        # In ALWAYS_EAGER mode (tests) use apply() to avoid broker connection;
        # in production use delay() to enqueue on the real broker.
        if getattr(dj_settings, 'CELERY_TASK_ALWAYS_EAGER', False):
            result = process_webhook_task.apply(args=(str(webhook.id),))
            task_id = result.id or ''
        else:
            task = process_webhook_task.delay(str(webhook.id))
            task_id = task.id

        webhook.celery_task_id = task_id
        webhook.save(update_fields=['celery_task_id'])

        logger.info(
            "WebhookEvent %s enqueued as Celery task %s",
            webhook.id, task_id,
        )
        return Response({'status': 'queued', 'event_id': str(webhook.id)})


class MockInboundMessageView(APIView):
    """
    POST /api/mock/inbound-message/
    Simulate inbound for local development — always synchronous.
    """
    permission_classes = [AllowAny]
    throttle_classes = [MockInboundThrottle]

    def post(self, request):
        serializer = InboundWebhookSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        inbound = InboundMessage(
            from_number=serializer.validated_data['from_number'],
            to_number=serializer.validated_data['to_number'],
            body=serializer.validated_data['body'],
            message_id=(
                serializer.validated_data.get('message_id')
                or f"mock_{uuid.uuid4().hex[:8]}"
            ),
            timestamp=timezone.now().isoformat(),
        )

        conversation = process_inbound_message('mock', inbound)
        if not conversation:
            return Response(
                {'error': 'No active WhatsApp number found for the given to_number.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            'conversation_id': str(conversation.id),
            'status': conversation.status,
            'contact_phone': conversation.contact.phone,
        })
