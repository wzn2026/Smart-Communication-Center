from django.contrib import admin
from .models import Conversation, Message


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['id', 'contact', 'tenant', 'status', 'category', 'assigned_to', 'last_message_at']
    list_filter = ['tenant', 'status', 'category', 'ai_enabled']
    search_fields = ['contact__name', 'contact__phone', 'summary']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['conversation', 'direction', 'message_type', 'status', 'is_ai_generated', 'created_at']
    list_filter = ['direction', 'status', 'is_ai_generated', 'message_type']
    search_fields = ['body']
    readonly_fields = ['id', 'created_at']
