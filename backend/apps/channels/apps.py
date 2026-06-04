from django.apps import AppConfig


class ChannelsConfig(AppConfig):
    name = 'apps.channels'
    label = 'scc_channels'  # avoid clash with django-channels ('channels')
    verbose_name = 'WhatsApp Channels'
