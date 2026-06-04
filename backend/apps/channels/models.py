import uuid
from django.db import models
from apps.tenants.models import Tenant


class WhatsAppNumber(models.Model):
    PROVIDERS = [
        ('mock', 'Mock (Dev)'),
        ('360dialog', '360dialog'),
        ('whatsapp_cloud', 'WhatsApp Cloud API'),
    ]
    STATUS = [('active', 'Active'), ('inactive', 'Inactive'), ('pending', 'Pending')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='whatsapp_numbers')
    provider = models.CharField(max_length=20, choices=PROVIDERS, default='mock')
    display_name = models.CharField(max_length=200)
    phone_number = models.CharField(max_length=20)
    provider_phone_id = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default='active')
    # Sensitive provider credentials are stored encrypted within this JSON field.
    # Use get_provider_api_key() / set_provider_api_key() etc. — never read raw.
    settings = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [('tenant', 'phone_number')]

    def __str__(self):
        return f"{self.display_name} ({self.phone_number}) [{self.provider}]"

    # ─── Encrypted credential accessors ───────────────────────────────────────

    def get_provider_api_key(self) -> str:
        from apps.providers.encryption import decrypt_value
        return decrypt_value(self.settings.get('api_key', ''))

    def set_provider_api_key(self, value: str) -> None:
        from apps.providers.encryption import encrypt_value
        self.settings = {**self.settings, 'api_key': encrypt_value(value)}

    def get_provider_webhook_secret(self) -> str:
        from apps.providers.encryption import decrypt_value
        return decrypt_value(self.settings.get('webhook_secret', ''))

    def set_provider_webhook_secret(self, value: str) -> None:
        from apps.providers.encryption import encrypt_value
        self.settings = {**self.settings, 'webhook_secret': encrypt_value(value)}

    def get_provider_token(self) -> str:
        from apps.providers.encryption import decrypt_value
        return decrypt_value(self.settings.get('provider_token', ''))

    def set_provider_token(self, value: str) -> None:
        from apps.providers.encryption import encrypt_value
        self.settings = {**self.settings, 'provider_token': encrypt_value(value)}


class Contact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='contacts')
    name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True)
    source_platform = models.CharField(max_length=100, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [('tenant', 'phone')]

    def __str__(self):
        return f"{self.name or self.phone} @ {self.tenant.name}"
