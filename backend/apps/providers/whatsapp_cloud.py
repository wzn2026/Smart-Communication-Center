"""
Meta WhatsApp Cloud API provider (free — no monthly subscription).

Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
Webhook signature: HMAC-SHA256 over raw body using App Secret.
Header: X-Hub-Signature-256 (value: sha256=<hex>)

Each WhatsApp number needs:
  - phone_number_id  (provider_phone_id on the model)
  - access_token     (stored encrypted in settings['api_key'])
"""
import hmac
import hashlib
import logging
import requests
from typing import Any, Dict, List, Optional

from .base import BaseWhatsAppProvider, InboundMessage, StatusUpdate

logger = logging.getLogger(__name__)

_STATUS_MAP: Dict[str, str] = {
    'sent': 'sent',
    'delivered': 'delivered',
    'read': 'read',
    'failed': 'failed',
    'deleted': 'failed',
}

_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

GRAPH_API_VERSION = 'v19.0'
BASE_URL = f'https://graph.facebook.com/{GRAPH_API_VERSION}'


class WhatsAppCloudProvider(BaseWhatsAppProvider):
    """
    Meta WhatsApp Cloud API — zero monthly cost, pay per conversation.
    First 1,000 conversations/month are free.
    """

    def __init__(self, access_token: str, phone_number_id: str):
        self.access_token = access_token
        self.phone_number_id = phone_number_id

    # ─── Outbound ─────────────────────────────────────────────────────────────

    def send_text_message(self, to: str, body: str, from_number: str = '') -> Dict[str, Any]:
        payload = {
            'messaging_product': 'whatsapp',
            'recipient_type': 'individual',
            'to': to,
            'type': 'text',
            'text': {'preview_url': False, 'body': body},
        }
        return self._post(payload)

    def send_template_message(
        self, to: str, template_name: str,
        variables: List[str], from_number: str = ''
    ) -> Dict[str, Any]:
        components = []
        if variables:
            components.append({
                'type': 'body',
                'parameters': [{'type': 'text', 'text': v} for v in variables],
            })
        payload = {
            'messaging_product': 'whatsapp',
            'to': to,
            'type': 'template',
            'template': {
                'name': template_name,
                'language': {'code': 'ar'},
                'components': components,
            },
        }
        return self._post(payload)

    def _post(self, payload: Dict) -> Dict[str, Any]:
        url = f'{BASE_URL}/{self.phone_number_id}/messages'
        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'application/json',
        }
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            msg_id = data.get('messages', [{}])[0].get('id', '') if data.get('messages') else ''
            return {'message_id': msg_id, 'status': 'sent'}
        except requests.HTTPError as exc:
            code = exc.response.status_code if exc.response is not None else 0
            body_text = exc.response.text[:300] if exc.response is not None else ''
            logger.error("WhatsApp Cloud API %d: %s", code, body_text)
            raise

    # ─── Inbound parsing ──────────────────────────────────────────────────────

    def parse_inbound_webhook(self, payload: Dict[str, Any]) -> Optional[InboundMessage]:
        try:
            entry = payload.get('entry', [{}])[0]
            changes = entry.get('changes', [{}])[0]
            value = changes.get('value', {})

            messages = value.get('messages', [])
            if not messages:
                return None

            msg = messages[0]
            msg_type = msg.get('type', '')

            if msg_type not in ('text', 'interactive', 'button'):
                logger.debug("Ignoring non-text Cloud API message type: %s", msg_type)
                return None

            body = ''
            if msg_type == 'text':
                body = msg.get('text', {}).get('body', '')
            elif msg_type == 'interactive':
                interactive = msg.get('interactive', {})
                if interactive.get('type') == 'button_reply':
                    body = interactive.get('button_reply', {}).get('title', '')
                elif interactive.get('type') == 'list_reply':
                    body = interactive.get('list_reply', {}).get('title', '')
            elif msg_type == 'button':
                body = msg.get('button', {}).get('text', '')

            contacts = value.get('contacts', [])
            from_number = msg.get('from', '')
            metadata = value.get('metadata', {})
            to_number = metadata.get('phone_number_id', '') or from_number

            return InboundMessage(
                from_number=from_number,
                to_number=to_number,
                body=body,
                message_id=msg['id'],
                timestamp=str(msg.get('timestamp', '')),
                metadata={'raw_msg': msg, 'contacts': contacts, 'meta': metadata},
            )
        except (KeyError, IndexError, TypeError) as exc:
            logger.warning("Failed to parse Cloud API inbound payload: %s", exc)
            return None

    def parse_status_webhook(self, payload: Dict[str, Any]) -> Optional[StatusUpdate]:
        try:
            entry = payload.get('entry', [{}])[0]
            changes = entry.get('changes', [{}])[0]
            value = changes.get('value', {})

            statuses = value.get('statuses', [])
            if not statuses:
                return None

            s = statuses[0]
            raw_status = s.get('status', '')
            canonical = _STATUS_MAP.get(raw_status, 'sent')

            error_data: Dict[str, Any] = {}
            if canonical == 'failed' and s.get('errors'):
                err = s['errors'][0]
                error_data = {
                    'code': str(err.get('code', '')),
                    'title': err.get('title', ''),
                    'message': err.get('message', ''),
                }

            return StatusUpdate(
                message_id=s['id'],
                status=canonical,
                timestamp=str(s.get('timestamp', '')),
                error_data=error_data,
            )
        except (KeyError, IndexError, TypeError) as exc:
            logger.warning("Failed to parse Cloud API status payload: %s", exc)
            return None

    # ─── Webhook GET verification (Meta challenge) ────────────────────────────

    @staticmethod
    def verify_challenge(request_params: Dict[str, str], verify_token: str) -> Optional[str]:
        """
        Meta sends a GET request to verify the webhook URL.
        Returns the hub.challenge string if valid, None otherwise.
        """
        mode = request_params.get('hub.mode')
        token = request_params.get('hub.verify_token')
        challenge = request_params.get('hub.challenge')
        if mode == 'subscribe' and token == verify_token:
            return challenge
        return None

    # ─── Signature validation ──────────────────────────────────────────────────

    def validate_webhook_signature(
        self, payload_bytes: bytes, signature_header: str, secret: str
    ) -> bool:
        if not secret:
            return True

        if not signature_header:
            return False

        sig = signature_header
        if sig.startswith('sha256='):
            sig = sig[7:]

        try:
            expected = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
            return hmac.compare_digest(expected, sig)
        except Exception:
            return False

    @staticmethod
    def is_retryable_error(exc: Exception) -> bool:
        if isinstance(exc, (requests.ConnectionError, requests.Timeout)):
            return True
        if isinstance(exc, requests.HTTPError) and exc.response is not None:
            return exc.response.status_code in _RETRYABLE_STATUS_CODES
        return False
