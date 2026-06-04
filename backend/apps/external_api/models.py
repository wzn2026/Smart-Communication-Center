import uuid
from django.db import models
from apps.tenants.models import Tenant


class ExternalEvent(models.Model):
    STATUS = [('pending', 'Pending'), ('processed', 'Processed'), ('failed', 'Failed')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='external_events')
    source_platform = models.CharField(max_length=100)
    event_type = models.CharField(max_length=100)
    payload = models.JSONField(default=dict)
    processed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.event_type} from {self.source_platform} [{self.status}]"


class WebhookEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='webhook_events'
    )
    provider = models.CharField(max_length=50)
    event_type = models.CharField(max_length=100, blank=True)
    raw_payload = models.JSONField(default=dict)
    processed = models.BooleanField(default=False)
    error_message = models.TextField(blank=True)
    # Used for idempotency: provider message id / event id
    deduplication_key = models.CharField(max_length=200, blank=True, db_index=True)
    # Celery task ID for tracking async processing
    celery_task_id = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.provider} — {self.event_type} ({'ok' if self.processed else 'pending'})"
