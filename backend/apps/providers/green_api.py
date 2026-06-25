import hashlib
import hmac
import logging
from typing import Any, Dict, List, Optional

import requests

from .base import BaseWhatsAppProvider, InboundMessage, StatusUpdate

logger = logging.getLogger(__name__)

_STATUS_MAP = {
    'sent': 'sent',
    'delivered': 'delivered',
    'read': 'read',
    'failed': 'failed',
    'pending': 'pending',
}


def _server_from_instance(instance_id: str) -> str:
    """Extract server prefix from instance id (e.g. '7107664512' → '7107')."""
    return instance_id[:4]


def _base_url(instance_id: str, token: str) -> str:
    server = _server_from_instance(instance_id)
    return f"https://{server}.api.greenapi.com/waInstance{instance_id}"


def _chat_id(phone: str) -> str:
    """Convert phone number to Green API chatId format: 966XXXXXXXXX@c.us"""
    phone = phone.strip().lstrip('+')
    if not phone.endswith('@c.us') and not phone.endswith('@g.us'):
        phone = f"{phone}@c.us"
    return phone


class GreenAPIProvider(BaseWhatsAppProvider):
    """
    Green API WhatsApp provider.
    Docs: https://green-api.com/en/docs/
    """

    def __init__(self, instance_id: str, token: str):
        self.instance_id = instance_id
        self.token = token
        self._base = _base_url(instance_id, token)

    def _post(self, method: str, payload: dict) -> dict:
        url = f"{self._base}/{method}/{self.token}"
        try:
            resp = requests.post(url, json=payload, timeout=15)
            if not resp.ok:
                logger.error(f"GreenAPI {method} → {resp.status_code}: {resp.text[:300]}")
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logger.error(f"GreenAPI {method} error: {e}")
            raise

    def send_text_message(self, to: str, body: str, from_number: str) -> Dict[str, Any]:
        chat_id = _chat_id(to)
        data = self._post('sendMessage', {'chatId': chat_id, 'message': body})
        return {
            'message_id': data.get('idMessage', ''),
            'status': 'sent',
        }

    def send_template_message(
        self, to: str, template_name: str,
        variables: List[str], from_number: str
    ) -> Dict[str, Any]:
        # Green API has no template system — send as plain text
        body = template_name
        if variables:
            body = template_name + '\n' + '\n'.join(variables)
        return self.send_text_message(to, body, from_number)

    def parse_inbound_webhook(self, payload: Dict[str, Any]) -> Optional[InboundMessage]:
        if payload.get('typeWebhook') != 'incomingMessageReceived':
            return None
        msg_data = payload.get('messageData', {})
        if msg_data.get('typeMessage') != 'textMessage':
            return None
        sender = payload.get('senderData', {})
        instance = payload.get('instanceData', {})
        body = msg_data.get('textMessageData', {}).get('textMessage', '')
        from_raw = sender.get('sender', '').replace('@c.us', '').replace('@g.us', '')
        to_raw = str(instance.get('wid', '')).replace('@c.us', '')
        return InboundMessage(
            from_number=f"+{from_raw}",
            to_number=f"+{to_raw}",
            body=body,
            message_id=payload.get('idMessage', ''),
            timestamp=str(payload.get('timestamp', '')),
            metadata={'raw': payload},
        )

    def parse_status_webhook(self, payload: Dict[str, Any]) -> Optional[StatusUpdate]:
        if payload.get('typeWebhook') != 'outgoingMessageStatus':
            return None
        raw_status = payload.get('status', 'sent')
        return StatusUpdate(
            message_id=payload.get('idMessage', ''),
            status=_STATUS_MAP.get(raw_status, 'sent'),
            timestamp=str(payload.get('timestamp', '')),
        )

    def validate_webhook_signature(
        self, payload_bytes: bytes, signature_header: str, secret: str
    ) -> bool:
        # Green API doesn't use HMAC signatures by default
        return True
