import uuid
from django.db import models
from django.contrib.auth.models import User
from apps.tenants.models import Tenant
from apps.channels.models import WhatsAppNumber, Contact


class Conversation(models.Model):
    STATUS = [
        ('open', 'Open'),
        ('pending', 'Pending'),
        ('needs_human', 'Needs Human'),
        ('closed', 'Closed'),
    ]
    CATEGORIES = [
        ('sales', 'Sales'),
        ('support', 'Support'),
        ('complaint', 'Complaint'),
        ('faq', 'FAQ'),
        ('subscription', 'Subscription'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='conversations')
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='conversations')
    whatsapp_number = models.ForeignKey(
        WhatsAppNumber, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='conversations'
    )
    status = models.CharField(max_length=20, choices=STATUS, default='open')
    category = models.CharField(max_length=20, choices=CATEGORIES, default='other')
    assigned_to = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assigned_conversations'
    )
    ai_enabled = models.BooleanField(default=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    summary = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-last_message_at', '-created_at']

    def __str__(self):
        return f"Conv {str(self.id)[:8]} — {self.contact} ({self.status})"


class Message(models.Model):
    DIRECTIONS = [('inbound', 'Inbound'), ('outbound', 'Outbound')]
    MSG_TYPES = [('text', 'Text'), ('template', 'Template'), ('system', 'System')]
    STATUSES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('read', 'Read'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='messages')
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    direction = models.CharField(max_length=10, choices=DIRECTIONS)
    message_type = models.CharField(max_length=20, choices=MSG_TYPES, default='text')
    body = models.TextField()
    provider_message_id = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUSES, default='pending')
    is_ai_generated = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)
    # Failure details — populated only when status='failed'
    failed_reason = models.CharField(max_length=500, blank=True)
    provider_error_code = models.CharField(max_length=50, blank=True)
    provider_error_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.direction}] {self.body[:60]}"
