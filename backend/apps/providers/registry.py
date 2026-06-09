from django.conf import settings
from .base import BaseWhatsAppProvider
from .mock import MockWhatsAppProvider
from .dialog360 import Dialog360Provider
from .whatsapp_cloud import WhatsAppCloudProvider


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

    if name == 'whatsapp_cloud':
        access_token = ''
        phone_number_id = ''
        if whatsapp_number is not None:
            access_token = whatsapp_number.get_provider_api_key()
            phone_number_id = whatsapp_number.provider_phone_id or ''
        if not access_token:
            access_token = getattr(settings, 'WHATSAPP_CLOUD_ACCESS_TOKEN', '')
        if not phone_number_id:
            phone_number_id = getattr(settings, 'WHATSAPP_CLOUD_PHONE_NUMBER_ID', '')
        return WhatsAppCloudProvider(access_token=access_token, phone_number_id=phone_number_id)

    if name == '360dialog':
        api_key = ''
        if whatsapp_number is not None:
            api_key = whatsapp_number.get_provider_api_key()
        if not api_key:
            api_key = getattr(settings, 'DIALOG360_API_KEY', '')
        return Dialog360Provider(api_key=api_key)

    return MockWhatsAppProvider()
