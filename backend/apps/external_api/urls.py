from django.urls import path
from .views import ExternalEventView, WhatsAppWebhookView, MockInboundMessageView

urlpatterns = [
    path('external/events/', ExternalEventView.as_view(), name='external-events'),
    path('webhooks/whatsapp/<str:provider>/', WhatsAppWebhookView.as_view(), name='whatsapp-webhook'),
    path('mock/inbound-message/', MockInboundMessageView.as_view(), name='mock-inbound'),
]
