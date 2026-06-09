from rest_framework import serializers
from .models import WhatsAppNumber, Contact


class WhatsAppNumberSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    # Write-only — never returned in responses
    access_token = serializers.CharField(write_only=True, required=False, allow_blank=True)
    has_credentials = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppNumber
        fields = [
            'id', 'tenant', 'tenant_name', 'provider', 'display_name',
            'phone_number', 'provider_phone_id', 'status',
            'access_token', 'has_credentials', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'tenant']

    def get_has_credentials(self, obj):
        """True if an access token is stored — without exposing the token."""
        return bool(obj.settings.get('api_key'))

    def create(self, validated_data):
        token = validated_data.pop('access_token', '')
        instance = super().create(validated_data)
        if token:
            instance.set_provider_api_key(token)
            instance.save(update_fields=['settings'])
        return instance

    def update(self, instance, validated_data):
        token = validated_data.pop('access_token', '')
        instance = super().update(instance, validated_data)
        if token:
            instance.set_provider_api_key(token)
            instance.save(update_fields=['settings'])
        return instance


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = [
            'id', 'tenant', 'name', 'phone', 'email',
            'source_platform', 'metadata', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']
