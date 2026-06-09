from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Tenant, TenantMembership, ApiKey, TenantSettings, SubscriptionPlan, Subscription


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
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_active', 'date_joined']
        read_only_fields = ['id', 'date_joined']


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    subscriber_count = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPlan
        fields = [
            'id', 'name', 'slug', 'description',
            'price_monthly', 'price_yearly', 'currency',
            'max_whatsapp_numbers', 'max_agents', 'max_messages_per_month',
            'features', 'is_active', 'is_featured', 'sort_order',
            'created_at', 'subscriber_count',
        ]
        read_only_fields = ['id', 'created_at', 'subscriber_count']

    def get_subscriber_count(self, obj):
        return obj.subscriptions.filter(status__in=['active', 'trial']).count()


class SubscriptionSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    plan_slug = serializers.CharField(source='plan.slug', read_only=True)
    plan_price_monthly = serializers.DecimalField(source='plan.price_monthly', max_digits=10, decimal_places=2, read_only=True)
    is_currently_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = Subscription
        fields = [
            'id', 'tenant', 'tenant_name', 'plan', 'plan_name', 'plan_slug',
            'plan_price_monthly', 'status', 'billing_cycle',
            'start_date', 'end_date', 'trial_ends_at',
            'auto_renew', 'notes', 'is_currently_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_currently_active']
