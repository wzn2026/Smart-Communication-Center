import hmac
import hashlib
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from .base import BaseWhatsAppProvider, InboundMessage, StatusUpdate

_sent_messages: List[Dict] = []


class MockWhatsAppProvider(BaseWhatsAppProvider):
    """
    Local development provider.
    Stores outbound messages in memory; never calls a real API.
    """

    def send_text_message(self, to: str, body: str, from_number: str) -> Dict[str, Any]:
        message_id = f"mock_{uuid.uuid4().hex[:12]}"
        _sent_messages.append({
            'message_id': message_id,
            'to': to,
            'from': from_number,
            'body': body,
            'type': 'text',
            'timestamp': datetime.now().isoformat(),
        })
        return {'message_id': message_id, 'status': 'sent'}

    def send_template_message(
        self, to: str, template_name: str,
        variables: List[str], from_number: str
    ) -> Dict[str, Any]:
        message_id = f"mock_{uuid.uuid4().hex[:12]}"
        _sent_messages.append({
            'message_id': message_id,
            'to': to,
            'from': from_number,
            'template': template_name,
            'variables': variables,
            'type': 'template',
            'timestamp': datetime.now().isoformat(),
        })
        return {'message_id': message_id, 'status': 'sent'}

    def parse_inbound_webhook(self, payload: Dict[str, Any]) -> Optional[InboundMessage]:
        try:
            return InboundMessage(
                from_number=payload['from'],
                to_number=payload.get('to', ''),
                body=payload['body'],
                message_id=payload.get('message_id', f"mock_{uuid.uuid4().hex[:12]}"),
                timestamp=payload.get('timestamp', datetime.now().isoformat()),
                metadata=payload.get('metadata', {}),
            )
        except KeyError:
            return None

    def parse_status_webhook(self, payload: Dict[str, Any]) -> Optional[StatusUpdate]:
        try:
            return StatusUpdate(
                message_id=payload['message_id'],
                status=payload['status'],
                timestamp=payload.get('timestamp', datetime.now().isoformat()),
            )
        except KeyError:
            return None

    def validate_webhook_signature(
        self, payload_bytes: bytes, signature_header: str, secret: str
    ) -> bool:
        """Use same HMAC-SHA256 logic as Dialog360 so tests are meaningful."""
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

    @classmethod
    def get_sent_messages(cls) -> List[Dict]:
        return list(_sent_messages)

    @classmethod
    def clear_sent_messages(cls) -> None:
        _sent_messages.clear()
