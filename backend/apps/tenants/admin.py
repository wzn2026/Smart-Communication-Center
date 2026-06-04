from django.contrib import admin
from .models import Tenant, TenantMembership, ApiKey, TenantSettings


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'tenant_type', 'status', 'plan', 'created_at']
    list_filter = ['tenant_type', 'status', 'plan']
    search_fields = ['name', 'slug']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(TenantMembership)
class TenantMembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'tenant', 'role', 'is_active']
    list_filter = ['tenant', 'role', 'is_active']
    search_fields = ['user__username', 'tenant__name']


@admin.register(ApiKey)
class ApiKeyAdmin(admin.ModelAdmin):
    list_display = ['name', 'tenant', 'prefix', 'is_active', 'is_revoked', 'is_expired', 'last_used_at', 'expires_at']
    list_filter = ['tenant', 'is_active']
    readonly_fields = ['id', 'key_hash', 'prefix', 'last_used_at', 'revoked_at', 'created_at']


@admin.register(TenantSettings)
class TenantSettingsAdmin(admin.ModelAdmin):
    list_display = ['tenant', 'auto_reply_enabled', 'max_auto_replies_per_conversation',
                    'low_confidence_threshold', 'reply_tone']
    list_filter = ['auto_reply_enabled', 'reply_tone']
    readonly_fields = ['created_at', 'updated_at']
