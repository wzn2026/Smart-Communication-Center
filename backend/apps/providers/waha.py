import logging
import re
from typing import Any, Dict, List, Optional

import requests

from .base import BaseWhatsAppProvider, InboundMessage, StatusUpdate

logger = logging.getLogger(__name__)

PHONE_RE = re.compile(r'[^\d]')


def _chat_id(phone: str) -> str:
    phone = PHONE_RE.sub('', phone)
    if not phone.endswith('@c.us'):
        phone = f"{phone}@c.us"
    return phone


class WahaProvider(BaseWhatsAppProvider):
    """
    WAHA (WhatsApp HTTP API) — self-hosted provider.
    Docs: https://waha.devlike.pro/docs/
    """

    def __init__(self, base_url: str, session: str = 'default', api_key: str = ''):
        self.base_url = base_url.rstrip('/')
        self.session  = session
        self._headers = {'Content-Type': 'application/json'}
        if api_key:
            self._headers['X-Api-Key'] = api_key

    def _post(self, path: str, payload: dict) -> dict:
        url  = f"{self.base_url}{path}"
        resp = requests.post(url, json=payload, headers=self._headers, timeout=15)
        if not resp.ok:
            logger.error(f"WAHA {path} → {resp.status_code}: {resp.text[:300]}")
        resp.raise_for_status()
        return resp.json() if resp.content else {}

    def send_text_message(self, to: str, body: str, from_number: str) -> Dict[str, Any]:
        chat_id = _chat_id(to)
        data = self._post('/api/sendText', {
            'chatId':  chat_id,
            'text':    body,
            'session': self.session,
        })
        return {
            'message_id': data.get('id', ''),
            'status':     'sent',
        }

    def send_image_message(
        self, to: str, body: str, from_number: str,
        image_b64: str, filename: str = 'image.jpg', mimetype: str = 'image/jpeg',
    ) -> Dict[str, Any]:
        chat_id = _chat_id(to)
        data = self._post('/api/sendImage', {
            'chatId':  chat_id,
            'session': self.session,
            'caption': body,
            'file': {
                'mimetype': mimetype,
                'filename': filename,
                'data':     image_b64,
            },
        })
        return {'message_id': data.get('id', ''), 'status': 'sent'}

    def send_template_message(
        self, to: str, template_name: str,
        variables: List[str], from_number: str,
    ) -> Dict[str, Any]:
        body = template_name
        if variables:
            body = template_name + '\n' + '\n'.join(variables)
        return self.send_text_message(to, body, from_number)

    def parse_inbound_webhook(self, payload: Dict[str, Any]) -> Optional[InboundMessage]:
        if payload.get('event') != 'message':
            return None
        msg  = payload.get('payload', {})
        body = msg.get('body', '')
        from_raw = msg.get('from', '').replace('@c.us', '').replace('@g.us', '')
        to_raw   = msg.get('to',   '').replace('@c.us', '')
        return InboundMessage(
            from_number=f"+{from_raw}",
            to_number=f"+{to_raw}",
            body=body,
            message_id=msg.get('id', ''),
            timestamp=str(msg.get('timestamp', '')),
            metadata={'raw': payload},
        )

    def parse_status_webhook(self, payload: Dict[str, Any]) -> Optional[StatusUpdate]:
        if payload.get('event') != 'message.ack':
            return None
        msg = payload.get('payload', {})
        ack_map = {1: 'sent', 2: 'delivered', 3: 'read', -1: 'failed'}
        status  = ack_map.get(msg.get('ack', 1), 'sent')
        return StatusUpdate(
            message_id=msg.get('id', ''),
            status=status,
            timestamp=str(msg.get('timestamp', '')),
        )

    def validate_webhook_signature(
        self, payload_bytes: bytes, signature_header: str, secret: str
    ) -> bool:
        return True
