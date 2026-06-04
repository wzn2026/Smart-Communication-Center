"""
Field-level encryption for sensitive provider credentials.

Uses Fernet symmetric encryption (AES-128-CBC + HMAC-SHA256).
Key is derived from FIELD_ENCRYPTION_KEY env var (or SECRET_KEY in dev).
The derived key is stable: same plaintext → same ciphertext only per key.
"""
import base64
import hashlib
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_ENCRYPTED_PREFIX = 'enc:'


def _get_fernet():
    from django.conf import settings
    from cryptography.fernet import Fernet

    raw = getattr(settings, 'FIELD_ENCRYPTION_KEY', '') or settings.SECRET_KEY
    # Fernet requires a 32-byte URL-safe base64-encoded key
    key_bytes = hashlib.sha256(raw.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt_value(value: str) -> str:
    """Return an encrypted string prefixed with 'enc:'. Empty string passthrough."""
    if not value:
        return value
    if value.startswith(_ENCRYPTED_PREFIX):
        return value  # already encrypted
    try:
        f = _get_fernet()
        return _ENCRYPTED_PREFIX + f.encrypt(value.encode()).decode()
    except Exception as exc:
        logger.error("Encryption failed: %s", exc)
        raise


def decrypt_value(value: str) -> str:
    """Decrypt a value encrypted with encrypt_value(). Passthrough for unencrypted values."""
    if not value:
        return value
    if not value.startswith(_ENCRYPTED_PREFIX):
        return value  # not encrypted — backward-compatible passthrough
    try:
        f = _get_fernet()
        return f.decrypt(value[len(_ENCRYPTED_PREFIX):].encode()).decode()
    except Exception:
        logger.warning("Could not decrypt value; returning empty string for safety.")
        return ''


def is_encrypted(value: str) -> bool:
    return bool(value and value.startswith(_ENCRYPTED_PREFIX))
