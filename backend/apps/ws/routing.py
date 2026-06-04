from django.urls import re_path
from .consumers import InboxConsumer, ConversationConsumer

websocket_urlpatterns = [
    re_path(r'^ws/inbox/$', InboxConsumer.as_asgi()),
    re_path(
        r'^ws/conversations/(?P<conversation_id>[0-9a-f-]{36})/$',
        ConversationConsumer.as_asgi(),
    ),
]
