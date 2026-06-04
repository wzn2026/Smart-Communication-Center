from rest_framework import serializers
from apps.channels.serializers import ContactSerializer
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = [
            'id', 'direction', 'message_type', 'body', 'provider_message_id',
            'status', 'is_ai_generated', 'metadata',
            'failed_reason', 'provider_error_code', 'provider_error_payload',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ConversationListSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    contact_phone = serializers.CharField(source='contact.phone', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    whatsapp_display_name = serializers.CharField(
        source='whatsapp_number.display_name', read_only=True
    )

    class Meta:
        model = Conversation
        fields = [
            'id', 'status', 'category', 'contact_name', 'contact_phone',
            'assigned_to_name', 'whatsapp_display_name', 'ai_enabled',
            'last_message_at', 'last_message', 'created_at', 'updated_at',
        ]

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if msg:
            return {
                'body': msg.body[:100],
                'direction': msg.direction,
                'created_at': msg.created_at,
            }
        return None


class ConversationDetailSerializer(serializers.ModelSerializer):
    contact = ContactSerializer(read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    whatsapp_display_name = serializers.CharField(
        source='whatsapp_number.display_name', read_only=True
    )

    class Meta:
        model = Conversation
        fields = [
            'id', 'tenant', 'contact', 'whatsapp_number', 'whatsapp_display_name',
            'status', 'category', 'assigned_to', 'assigned_to_name',
            'ai_enabled', 'last_message_at', 'summary', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None


class ReplySerializer(serializers.Serializer):
    body = serializers.CharField(max_length=4096)
    message_type = serializers.ChoiceField(choices=['text', 'template'], default='text')
