from django.conf import settings
from .base import BaseWhatsAppProvider
from .mock import MockWhatsAppProvider
from .dialog360 import Dialog360Provider
from .whatsapp_cloud import WhatsAppCloudProvider
from .green_api import GreenAPIProvider
from .waha import WahaProvider


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

    if name == 'green_api':
        instance_id = ''
        token = ''
        if whatsapp_number is not None:
            instance_id = whatsapp_number.provider_phone_id or ''
            token = whatsapp_number.get_provider_api_key()
        if not instance_id:
            instance_id = getattr(settings, 'GREEN_API_INSTANCE', '')
        if not token:
            token = getattr(settings, 'GREEN_API_TOKEN', '')
        return GreenAPIProvider(instance_id=instance_id, token=token)

    if name == 'waha':
        base_url = getattr(settings, 'WAHA_URL', 'http://scc_waha:3000')
        session  = getattr(settings, 'WAHA_SESSION', 'default')
        api_key  = getattr(settings, 'WAHA_API_KEY', '')
        if whatsapp_number is not None:
            stored_key = whatsapp_number.get_provider_api_key()
            if stored_key:
                api_key = stored_key
        return WahaProvider(base_url=base_url, session=session, api_key=api_key)

    return MockWhatsAppProvider()
