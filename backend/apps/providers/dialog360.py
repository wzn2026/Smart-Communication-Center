"""
360dialog WhatsApp Business API provider.

API docs: https://docs.360dialog.com/whatsapp-api/whatsapp-api/
Webhook signature: HMAC-SHA256 over raw request body using channel webhook secret.
Header name: X-D360-Signature  (or X-Hub-Signature-256 for Meta-compatible clients)
"""
import hmac
import hashlib
import logging
import requests
from typing import Any, Dict, List, Optional

from .base import BaseWhatsAppProvider, InboundMessage, StatusUpdate

logger = logging.getLogger(__name__)

# Map 360dialog status values → canonical internal statuses
_STATUS_MAP: Dict[str, str] = {
    'sent': 'sent',
    'delivered': 'delivered',
    'read': 'read',
    'failed': 'failed',
    'error': 'failed',
    'deleted': 'failed',
}

# Network/server errors that are safe to retry
_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


class Dialog360Provider(BaseWhatsAppProvider):
    """
    Production-ready 360dialog provider.
    Raises requests.HTTPError for 4xx (no retry), ConnectionError/Timeout for network issues.
    """

    SIGNATURE_HEADER = 'X-D360-Signature'

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = 'https://waba.360dialog.io/v1'

    # ─── Outbound ─────────────────────────────────────────────────────────────

    def send_text_message(self, to: str, body: str, from_number: str) -> Dict[str, Any]:
        payload = {
            'to': to,
            'type': 'text',
            'text': {'body': body},
            'recipient_type': 'individual',
        }
        return self._post('/messages', payload)

    def send_template_message(
        self, to: str, template_name: str,
        variables: List[str], from_number: str
    ) -> Dict[str, Any]:
        components = []
        if variables:
            components.append({
                'type': 'body',
                'parameters': [{'type': 'text', 'text': v} for v in variables],
            })
        payload = {
            'to': to,
            'type': 'template',
            'template': {
                'name': template_name,
                'language': {'code': 'ar', 'policy': 'deterministic'},
                'components': components,
            },
        }
        return self._post('/messages', payload)

    def _post(self, path: str, payload: Dict) -> Dict[str, Any]:
        url = self.base_url + path
        headers = {
            'D360-API-KEY': self.api_key,
            'Content-Type': 'application/json',
        }
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            msg_id = data.get('messages', [{}])[0].get('id', '') if data.get('messages') else ''
            return {'message_id': msg_id, 'status': 'sent'}
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else 0
            body_text = exc.response.text[:300] if exc.response is not None else ''
            logger.error(
                "360dialog API %d for %s: %s",
                status_code, path, body_text
            )
            raise

    # ─── Inbound parsing ──────────────────────────────────────────────────────

    def parse_inbound_webhook(self, payload: Dict[str, Any]) -> Optional[InboundMessage]:
        """
        Parses a 360dialog inbound webhook payload.
        Returns None if the payload is a status update or unsupported type.
        """
        try:
            messages = payload.get('messages', [])
            if not messages:
                return None

            msg = messages[0]
            msg_type = msg.get('type', '')

            # Only process text (and basic interactive) messages
            if msg_type not in ('text', 'interactive', 'button'):
                logger.debug("Ignoring non-text message type: %s", msg_type)
                return None

            body = ''
            if msg_type == 'text':
                body = msg.get('text', {}).get('body', '')
            elif msg_type in ('interactive', 'button'):
                # Extract button reply text
                interactive = msg.get('interactive', {})
                if interactive.get('type') == 'button_reply':
                    body = interactive.get('button_reply', {}).get('title', '')
                elif interactive.get('type') == 'list_reply':
                    body = interactive.get('list_reply', {}).get('title', '')

            contacts = payload.get('contacts', [])
            from_number = msg.get('from', '')
            to_number = contacts[0].get('wa_id', from_number) if contacts else from_number

            return InboundMessage(
                from_number=from_number,
                to_number=to_number,
                body=body,
                message_id=msg['id'],
                timestamp=str(msg.get('timestamp', '')),
                metadata={'raw_msg': msg, 'contacts': contacts},
            )
        except (KeyError, IndexError, TypeError) as exc:
            logger.warning("Failed to parse 360dialog inbound payload: %s", exc)
            return None

    def parse_status_webhook(self, payload: Dict[str, Any]) -> Optional[StatusUpdate]:
        """
        Parses a 360dialog status webhook payload.
        Returns None if the payload is an inbound message.
        """
        try:
            statuses = payload.get('statuses', [])
            if not statuses:
                return None

            s = statuses[0]
            raw_status = s.get('status', '')
            canonical = _STATUS_MAP.get(raw_status, 'sent')

            # Extract error details for failed status
            error_data: Dict[str, Any] = {}
            if canonical == 'failed' and s.get('errors'):
                err = s['errors'][0]
                error_data = {
                    'code': str(err.get('code', '')),
                    'title': err.get('title', ''),
                    'details': err.get('details', ''),
                }

            return StatusUpdate(
                message_id=s['id'],
                status=canonical,
                timestamp=str(s.get('timestamp', '')),
                error_data=error_data,
            )
        except (KeyError, IndexError, TypeError) as exc:
            logger.warning("Failed to parse 360dialog status payload: %s", exc)
            return None

    # ─── Signature validation ──────────────────────────────────────────────────

    def validate_webhook_signature(
        self, payload_bytes: bytes, signature_header: str, secret: str
    ) -> bool:
        """
        Validates HMAC-SHA256 signature from 360dialog.
        Header value format: sha256=<hex_digest>  (Meta-compatible)
        or raw hex string (some 360dialog setups).
        """
        if not secret:
            return True  # no secret configured → skip (dev mode)

        if not signature_header:
            return False

        # Strip 'sha256=' prefix if present
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
        """True if the exception represents a transient error worth retrying."""
        if isinstance(exc, (requests.ConnectionError, requests.Timeout)):
            return True
        if isinstance(exc, requests.HTTPError) and exc.response is not None:
            return exc.response.status_code in _RETRYABLE_STATUS_CODES
        return False
