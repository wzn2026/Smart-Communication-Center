# 360dialog WhatsApp Integration Guide

## Overview

Smart Communication Center uses 360dialog as the production WhatsApp Business API provider.
During local development the MockWhatsAppProvider is used (no real API calls made).

---

## Required Environment Variables

```env
WHATSAPP_PROVIDER=360dialog
DIALOG360_API_KEY=your_360dialog_api_key_here
WEBHOOK_SECRET=your_webhook_signing_secret
FIELD_ENCRYPTION_KEY=your_32_byte_random_key
```

Generate a secure encryption key:
```bash
openssl rand -base64 32
```

---

## 360dialog Dashboard Setup

1. Log in at https://hub.360dialog.com
2. Select your WABA (WhatsApp Business Account)
3. Go to **Developers → API Keys** → Generate API Key
4. Copy the key and set `DIALOG360_API_KEY=<key>` in your environment
5. Under **Webhooks**, add your webhook URL:
   ```
   https://yourdomain.com/api/webhooks/whatsapp/360dialog/
   ```
6. Generate a webhook secret and set `WEBHOOK_SECRET=<secret>` in your environment

---

## Webhook URL

```
POST /api/webhooks/whatsapp/360dialog/
```

### Required header from 360dialog:
```
X-D360-Signature: sha256=<hmac_sha256_hex>
```

The signature is computed as:
```
HMAC-SHA256(raw_request_body, WEBHOOK_SECRET)
```

### Behavior:
- **DEBUG=True + WEBHOOK_SECRET empty**: All webhooks accepted (local dev)
- **DEBUG=False + WEBHOOK_SECRET set**: Signature validated strictly — invalid = 401
- **DEBUG=False + WEBHOOK_SECRET empty**: All webhooks rejected (misconfigured production)

---

## Per-Number Credentials (Multi-Tenant)

Each `WhatsAppNumber` can have its own encrypted API key and webhook secret.
These override the global env vars when set.

```python
# In the Django shell or seed data:
wa_number = WhatsAppNumber.objects.get(phone_number='+966500000001')
wa_number.set_provider_api_key('per_number_api_key')
wa_number.set_provider_webhook_secret('per_number_webhook_secret')
wa_number.save()
```

**Security**: Credentials are stored AES-128-CBC encrypted (Fernet) in the `settings` JSON field.
Never store plain text secrets in the `settings` field directly.

---

## Local Mock Testing Flow

1. Start the server: `python manage.py runserver`
2. Use the mock inbound endpoint to simulate messages:

```bash
curl -X POST http://localhost:8000/api/mock/inbound-message/ \
  -H "Content-Type: application/json" \
  -d '{
    "from_number": "+966512345678",
    "to_number": "+966500000001",
    "body": "كيف أسجل في نداء؟",
    "message_id": "test-001"
  }'
```

3. The system will:
   - Find the active WhatsApp number `+966500000001`
   - Create/update the contact
   - Create/update the conversation
   - Run FAQ auto-reply if a match is found
   - Return the conversation ID and status

---

## Async Webhook Processing

Webhooks are processed asynchronously:

1. Webhook arrives → signature validated → `WebhookEvent` stored
2. Celery task `process_webhook_task` enqueued immediately
3. HTTP 200 returned to provider (provider doesn't wait for processing)
4. Celery worker picks up the task → processes inbound/status update
5. On transient failure: automatic retry with exponential backoff (up to 3 times)

### Start Celery worker:
```bash
celery -A config.celery worker --loglevel=info --concurrency=2
```

### With Docker Compose:
```bash
docker-compose up celery_worker
```

---

## Production Security Notes

| Setting | Requirement |
|---------|-------------|
| `FIELD_ENCRYPTION_KEY` | Required — 32+ byte random string. Losing this key = losing all encrypted credentials |
| `WEBHOOK_SECRET` | Required — set in 360dialog dashboard and here |
| `DEBUG=False` | Required in production |
| `DJANGO_SECRET_KEY` | Required — change from default |
| HTTPS | Required — 360dialog only sends to HTTPS endpoints |
| Rate limiting | Configured via `THROTTLE_*` env vars |

---

## Nedaa Platform Integration

When Nedaa or another platform needs to push events to SCC:

1. Generate an API key: `POST /api/tenants/{tenant_id}/generate_api_key/`
2. Store the key securely on the Nedaa side
3. Push events with the `X-API-Key` header:

```bash
curl -X POST https://scc.yourdomain.com/api/external/events/ \
  -H "X-API-Key: scc_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "source_platform": "nedaa",
    "event_type": "new_subscriber",
    "payload": {"user_id": "123", "plan": "premium"}
  }'
```

---

## Phase 2B Readiness Checklist

Before going live with real WhatsApp:

- [ ] `WHATSAPP_PROVIDER=360dialog` set in production env
- [ ] `DIALOG360_API_KEY` set with real key from 360dialog dashboard
- [ ] `WEBHOOK_SECRET` set and configured in 360dialog dashboard
- [ ] `FIELD_ENCRYPTION_KEY` set and backed up securely
- [ ] `DEBUG=False` in production
- [ ] HTTPS endpoint reachable from the internet
- [ ] Celery worker running with at least 2 workers
- [ ] Redis available (broker + result backend)
- [ ] PostgreSQL running with proper backups
- [ ] Webhook URL registered in 360dialog dashboard
- [ ] Test end-to-end with a real phone number in sandbox mode first
