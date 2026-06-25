from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class InboundMessage:
    from_number: str
    to_number: str
    body: str
    message_id: str
    timestamp: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StatusUpdate:
    message_id: str
    status: str        # normalised: sent | delivered | read | failed
    timestamp: str
    error_data: Dict[str, Any] = field(default_factory=dict)


# Canonical status values — providers must normalise to these
CANONICAL_STATUSES = frozenset({'sent', 'delivered', 'read', 'failed', 'pending'})


class BaseWhatsAppProvider(ABC):

    @abstractmethod
    def send_text_message(self, to: str, body: str, from_number: str) -> Dict[str, Any]:
        """Send plain text. Returns {'message_id': '...', 'status': 'sent'}."""

    @abstractmethod
    def send_template_message(
        self, to: str, template_name: str,
        variables: List[str], from_number: str
    ) -> Dict[str, Any]:
        """Send a template message."""

    def send_image_message(
        self, to: str, body: str, from_number: str,
        image_b64: str, filename: str = 'image.jpg', mimetype: str = 'image/jpeg',
    ) -> Dict[str, Any]:
        """Send image with caption. Falls back to text if provider doesn't support images."""
        return self.send_text_message(to=to, body=body, from_number=from_number)

    @abstractmethod
    def parse_inbound_webhook(self, payload: Dict[str, Any]) -> Optional[InboundMessage]:
        """Parse raw webhook payload into InboundMessage, or None if not applicable."""

    @abstractmethod
    def parse_status_webhook(self, payload: Dict[str, Any]) -> Optional[StatusUpdate]:
        """Parse raw webhook payload into StatusUpdate with canonical status, or None."""

    def validate_webhook_signature(
        self, payload_bytes: bytes, signature_header: str, secret: str
    ) -> bool:
        """
        Validate HMAC-SHA256 webhook signature.
        Override per provider if the algorithm differs.
        Default: True (no validation) — providers must override.
        """
        return True
