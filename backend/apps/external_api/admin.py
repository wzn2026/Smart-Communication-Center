from django.contrib import admin
from .models import ExternalEvent, WebhookEvent


@admin.register(ExternalEvent)
class ExternalEventAdmin(admin.ModelAdmin):
    list_display = ['event_type', 'source_platform', 'tenant', 'status', 'created_at']
    list_filter = ['tenant', 'status', 'source_platform']
    readonly_fields = ['id', 'created_at']


@admin.register(WebhookEvent)
class WebhookEventAdmin(admin.ModelAdmin):
    list_display = ['provider', 'event_type', 'processed', 'created_at']
    list_filter = ['provider', 'processed']
    readonly_fields = ['id', 'created_at', 'raw_payload']
