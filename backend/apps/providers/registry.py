from django.conf import settings
from .base import BaseWhatsAppProvider
from .mock import MockWhatsAppProvider
from .dialog360 import Dialog360Provider


def get_provider(
    provider_name: str = None,
    whatsapp_number=None,
) -> BaseWhatsAppProvider:
    """
    Return the provider instance for the given name.
    If whatsapp_number is provided, use its per-number encrypted credentials first,
    falling back to global env vars.
    """
    name = provider_name or getattr(settings, 'WHATSAPP_PROVIDER', 'mock')

    if name == '360dialog':
        api_key = ''
        if whatsapp_number is not None:
            api_key = whatsapp_number.get_provider_api_key()
        if not api_key:
            api_key = getattr(settings, 'DIALOG360_API_KEY', '')
        return Dialog360Provider(api_key=api_key)

    return MockWhatsAppProvider()
