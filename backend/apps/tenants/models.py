import uuid
import secrets
import hashlib
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Tenant(models.Model):
    TENANT_TYPES = [
        ('platform', 'Platform'),
        ('family_fund', 'Family Fund'),
        ('company', 'Company'),
        ('other', 'Other'),
    ]
    STATUS = [('active', 'Active'), ('suspended', 'Suspended')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, max_length=100)
    tenant_type = models.CharField(max_length=20, choices=TENANT_TYPES, default='other')
    status = models.CharField(max_length=20, choices=STATUS, default='active')
    plan = models.CharField(max_length=50, default='free')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class TenantMembership(models.Model):
    ROLES = [
        ('owner', 'Owner'),
        ('admin', 'Admin'),
        ('agent', 'Agent'),
        ('viewer', 'Viewer'),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tenant_memberships')
    role = models.CharField(max_length=20, choices=ROLES, default='agent')
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [('tenant', 'user')]

    def __str__(self):
        return f"{self.user.username} @ {self.tenant.name} ({self.role})"


class ApiKey(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='api_keys')
    name = models.CharField(max_length=100)
    # Only the hash is stored — the raw key is shown once and never persisted
    key_hash = models.CharField(max_length=64, unique=True)
    prefix = models.CharField(max_length=10)
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True, help_text='Leave blank for no expiry')
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.prefix}...)"

    @property
    def is_revoked(self):
        return self.revoked_at is not None

    @property
    def is_expired(self):
        if not self.expires_at:
            return False
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return self.is_active and not self.is_revoked and not self.is_expired

    def revoke(self):
        self.revoked_at = timezone.now()
        self.is_active = False
        self.save(update_fields=['revoked_at', 'is_active'])

    @classmethod
    def generate(cls, tenant, name, expires_at=None):
        raw_key = f"scc_{secrets.token_urlsafe(32)}"
        prefix = raw_key[:10]
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        obj = cls.objects.create(
            tenant=tenant, name=name, key_hash=key_hash,
            prefix=prefix, expires_at=expires_at
        )
        return obj, raw_key

    @classmethod
    def verify(cls, raw_key):
        """Return the ApiKey if valid, None otherwise."""
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        try:
            api_key = cls.objects.select_related('tenant').get(
                key_hash=key_hash, is_active=True
            )
        except cls.DoesNotExist:
            return None

        if api_key.is_revoked:
            return None
        if api_key.is_expired:
            return None
        return api_key


class TenantSettings(models.Model):
    REPLY_TONES = [
        ('formal', 'رسمي'),
        ('friendly', 'ودّي'),
        ('neutral', 'محايد'),
    ]

    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name='settings')
    auto_reply_enabled = models.BooleanField(default=True)
    human_escalation_enabled = models.BooleanField(default=True)
    business_hours_enabled = models.BooleanField(default=False)
    default_language = models.CharField(max_length=10, default='ar')
    reply_tone = models.CharField(max_length=20, choices=REPLY_TONES, default='formal')
    max_auto_replies_per_conversation = models.PositiveIntegerField(default=10)
    low_confidence_threshold = models.FloatField(
        default=1.5,
        help_text='Minimum FAQ match score; below this the conversation escalates to human.'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Settings — {self.tenant.name}"

    @classmethod
    def get_for_tenant(cls, tenant):
        """Return settings, creating defaults if missing."""
        obj, _ = cls.objects.get_or_create(tenant=tenant)
        return obj


class SubscriptionPlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, max_length=50)
    description = models.TextField(blank=True)
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    price_yearly = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default='SAR')
    max_whatsapp_numbers = models.IntegerField(null=True, blank=True)
    max_agents = models.IntegerField(null=True, blank=True)
    max_messages_per_month = models.IntegerField(null=True, blank=True)
    features = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order', 'price_monthly']

    def __str__(self):
        return self.name


class Subscription(models.Model):
    STATUS_CHOICES = [
        ('trial',    'تجريبي'),
        ('active',   'نشط'),
        ('expired',  'منتهي'),
        ('cancelled','ملغي'),
        ('past_due', 'متأخر السداد'),
    ]
    BILLING_CYCLE = [
        ('monthly', 'شهري'),
        ('yearly',  'سنوي'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='subscriptions')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, related_name='subscriptions')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='trial')
    billing_cycle = models.CharField(max_length=10, choices=BILLING_CYCLE, default='monthly')
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    trial_ends_at = models.DateField(null=True, blank=True)
    auto_renew = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.tenant.name} — {self.plan.name} ({self.status})"

    @property
    def is_currently_active(self):
        today = timezone.now().date()
        if self.status not in ('active', 'trial'):
            return False
        if self.end_date and today > self.end_date:
            return False
        return True


# Auto-create settings when a new tenant is created
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=Tenant)
def create_tenant_settings(sender, instance, created, **kwargs):
    if created:
        TenantSettings.objects.get_or_create(tenant=instance)
