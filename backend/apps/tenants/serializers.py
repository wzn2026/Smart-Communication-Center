from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Tenant, TenantMembership, ApiKey, TenantSettings


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = [
            'id', 'name', 'slug', 'tenant_type', 'status',
            'plan', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class TenantMembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = TenantMembership
        fields = ['id', 'tenant', 'user', 'username', 'full_name', 'role', 'is_active']

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class ApiKeySerializer(serializers.ModelSerializer):
    is_revoked = serializers.BooleanField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = ApiKey
        fields = [
            'id', 'name', 'prefix', 'is_active', 'is_revoked', 'is_expired', 'is_valid',
            'last_used_at', 'expires_at', 'revoked_at', 'created_at',
        ]
        read_only_fields = [
            'id', 'prefix', 'last_used_at', 'revoked_at', 'created_at',
            'is_revoked', 'is_expired', 'is_valid',
        ]


class TenantSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantSettings
        fields = [
            'id', 'tenant', 'auto_reply_enabled', 'human_escalation_enabled',
            'business_hours_enabled', 'default_language', 'reply_tone',
            'max_auto_replies_per_conversation', 'low_confidence_threshold',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff']
