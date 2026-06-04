from django.contrib import admin
from .models import KnowledgeBase, KnowledgeItem, QuickReplyTemplate


@admin.register(KnowledgeBase)
class KnowledgeBaseAdmin(admin.ModelAdmin):
    list_display = ['name', 'tenant', 'is_active']
    list_filter = ['tenant', 'is_active']


@admin.register(KnowledgeItem)
class KnowledgeItemAdmin(admin.ModelAdmin):
    list_display = ['question', 'tenant', 'category', 'is_active', 'requires_human', 'priority']
    list_filter = ['tenant', 'is_active', 'requires_human', 'category']
    search_fields = ['question', 'answer', 'keywords']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(QuickReplyTemplate)
class QuickReplyTemplateAdmin(admin.ModelAdmin):
    list_display = ['title', 'tenant', 'category', 'is_active']
    list_filter = ['tenant', 'is_active', 'category']
