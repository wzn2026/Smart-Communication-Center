from django.contrib import admin
from .models import WhatsAppNumber, Contact


@admin.register(WhatsAppNumber)
class WhatsAppNumberAdmin(admin.ModelAdmin):
    list_display = ['display_name', 'phone_number', 'provider', 'tenant', 'status']
    list_filter = ['provider', 'status', 'tenant']
    search_fields = ['display_name', 'phone_number']


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'tenant', 'source_platform', 'created_at']
    list_filter = ['tenant', 'source_platform']
    search_fields = ['name', 'phone', 'email']
