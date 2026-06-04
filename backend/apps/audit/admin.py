from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'entity_type', 'entity_id', 'tenant', 'user', 'created_at']
    list_filter = ['tenant', 'action', 'entity_type']
    search_fields = ['entity_id', 'action']
    readonly_fields = ['id', 'tenant', 'user', 'action', 'entity_type', 'entity_id', 'metadata', 'created_at']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
