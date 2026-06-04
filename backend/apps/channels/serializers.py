from rest_framework import serializers
from .models import WhatsAppNumber, Contact


class WhatsAppNumberSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)

    class Meta:
        model = WhatsAppNumber
        fields = [
            'id', 'tenant', 'tenant_name', 'provider', 'display_name',
            'phone_number', 'provider_phone_id', 'status', 'settings', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = [
            'id', 'tenant', 'name', 'phone', 'email',
            'source_platform', 'metadata', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']
