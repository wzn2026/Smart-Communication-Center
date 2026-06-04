from rest_framework import serializers
from .models import ExternalEvent, WebhookEvent


class ExternalEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalEvent
        fields = ['id', 'source_platform', 'event_type', 'payload', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']


class InboundWebhookSerializer(serializers.Serializer):
    """Validates mock inbound message simulation payloads."""
    from_number = serializers.CharField(max_length=20)
    to_number = serializers.CharField(max_length=20)
    body = serializers.CharField()
    message_id = serializers.CharField(required=False, allow_blank=True)
