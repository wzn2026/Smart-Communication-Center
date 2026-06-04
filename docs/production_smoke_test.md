# Production Smoke Test Checklist

Run these tests in order after every deploy.
Replace `<TOKEN>` with a JWT from step 2, and `<PASSWORD>` with your admin password.

---

## Pre-flight

```bash
# All containers healthy?
docker compose -f docker-compose.prod.yml ps
# Expected: all services "running" or "healthy", nginx shows 0.0.0.0:80->80, 0.0.0.0:443->443
```

---

## 1. TLS / HTTPS Verification

```bash
# Check response code and that Cloudflare served it over HTTP/2
curl -sI https://api.comm.wasal.sa/health/
# Expected headers:
#   HTTP/2 200
#   content-type: application/json
#   server: cloudflare          ← confirms traffic went through Cloudflare

curl -sI https://app.comm.wasal.sa/
# Expected:
#   HTTP/2 200
#   content-type: text/html
#   server: cloudflare

# Check TLS chain (should show Cloudflare CA or origin cert)
curl -vI https://api.comm.wasal.sa/health/ 2>&1 | grep -E "issuer|subject|SSL|TLS|HTTP/"
# Expected: SSL connection using TLSv1.3 / TLSv1.2
```

---

## 2. Health Endpoints

```bash
curl -s https://api.comm.wasal.sa/health/ | python3 -m json.tool
```
**Expected:**
```json
{
  "app": "ok",
  "database": "ok",
  "redis": "ok",
  "celery": "ok (1 worker(s))"
}
```

```bash
curl -s https://api.comm.wasal.sa/api/health/ | python3 -m json.tool
```
Same expected output.

```bash
# HTTP/2 redirect test — port 80 must redirect to 443
curl -sI http://api.comm.wasal.sa/health/
# Expected: HTTP/1.1 301 Moved Permanently  (Nginx redirects to https)
# Note: Cloudflare may intercept this before reaching Nginx — 301 or 308 is acceptable
```

---

## 3. Login

```bash
curl -s -X POST https://api.comm.wasal.sa/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<PASSWORD>"}' \
  | python3 -m json.tool
# Expected: {"access": "...", "refresh": "..."}

# Save token for subsequent tests
TOKEN=$(curl -s -X POST https://api.comm.wasal.sa/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<PASSWORD>"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access'])")
echo "Token: ${TOKEN:0:40}..."
```

---

## 4. Frontend Loads

```bash
curl -sI https://app.comm.wasal.sa/
# Expected: HTTP/2 200

# Verify SPA bundle references exist in HTML
curl -s https://app.comm.wasal.sa/ | grep -c "assets/"
# Expected: ≥ 1
```

In browser:
1. Open `https://app.comm.wasal.sa`
2. Check DevTools → Console: **no errors**
3. Check DevTools → Network: **all requests use HTTPS**
4. The login page should load without mixed-content warnings

---

## 5. WebSocket Connects over WSS

```bash
# Install once: npm install -g wscat
wscat -c "wss://api.comm.wasal.sa/ws/inbox/?token=$TOKEN" --wait 3
# Expected: connection opens → waits → closes cleanly (code 1000, no error output)
```

In browser:
1. Log in to `https://app.comm.wasal.sa`
2. DevTools → Network → WS tab
3. Navigate to Inbox page
4. **Expected**: WebSocket to `wss://api.comm.wasal.sa/ws/inbox/` appears with status **101**
5. Inbox header shows **"مباشر" (green)** indicator

---

## 6. Mock Inbound Message Appears Live

Keep the Inbox page open in a browser tab, then:

```bash
curl -s -X POST https://api.comm.wasal.sa/api/mock/inbound-message/ \
  -H "Content-Type: application/json" \
  -d '{
    "from_number": "+966500000099",
    "to_number": "+966500000001",
    "body": "smoke test — هل تظهر هذه الرسالة فوراً؟"
  }' | python3 -m json.tool
# Expected: {"conversation_id": "...", "status": "open", ...}
```

**Expected in browser**: Conversation appears in the inbox list **within 1–2 seconds** — no page refresh needed.

---

## 7. Reply Sends and Broadcasts

```bash
CONV_ID=<conversation_id_from_step_6>

curl -s -X POST "https://api.comm.wasal.sa/api/conversations/${CONV_ID}/reply/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body": "smoke test reply"}' | python3 -m json.tool
# Expected: {"direction": "outbound", "status": "sent", ...}
```

**Expected in browser**: Reply appears in the conversation thread within 1–2 seconds.

---

## 8. Status Update Broadcasts

```bash
curl -s -X PATCH "https://api.comm.wasal.sa/api/conversations/${CONV_ID}/status/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}' | python3 -m json.tool
# Expected: {"status": "closed", ...}
```

**Expected in browser**: Status badge in the conversation list updates live.

---

## 9. Tenant Isolation

```bash
# agent1 token (if seed_data was run)
AGENT_TOKEN=$(curl -s -X POST https://api.comm.wasal.sa/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"agent1","password":"agent123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('access',''))")

if [ -n "$AGENT_TOKEN" ]; then
  curl -s "https://api.comm.wasal.sa/api/conversations/" \
    -H "Authorization: Bearer $AGENT_TOKEN" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('Count:', d.get('count',0))"
  # Expected: only conversations from agent1's tenant (nedaa)
else
  echo "agent1 not seeded — skip isolation test"
fi
```

---

## 10. Celery Processes Webhook

```bash
curl -s -X POST https://api.comm.wasal.sa/api/mock/inbound-message/ \
  -H "Content-Type: application/json" \
  -d '{"from_number":"+966500000088","to_number":"+966500000001","body":"celery check"}'

docker compose -f docker-compose.prod.yml logs celery_worker --tail=10
# Expected log line: "WebhookEvent ... processed OK (inbound_message)"
```

---

## 11. Audit Log Created

```bash
docker compose -f docker-compose.prod.yml exec backend \
    python manage.py shell --settings=config.settings.production \
    -c "
from apps.audit.models import AuditLog
for log in AuditLog.objects.order_by('-created_at')[:5]:
    print(log.action, '|', log.entity_type, '|', str(log.created_at)[:19])
"
# Expected: reply_sent, status_changed entries visible
```

---

## 12. Encrypted Provider Key Decrypts

```bash
docker compose -f docker-compose.prod.yml exec backend \
    python manage.py shell --settings=config.settings.production \
    -c "
from apps.channels.models import WhatsAppNumber
for wa in WhatsAppNumber.objects.filter(provider='360dialog'):
    key = wa.get_provider_api_key()
    print(f'{wa.phone_number}: decrypts OK = {bool(key)}')
print('Total 360dialog numbers:', WhatsAppNumber.objects.filter(provider=\"360dialog\").count())
"
# Expected: each 360dialog number decrypts OK = True
```

---

## Post-Smoke-Test Checklist

| # | Check | Expected | Result |
|---|---|---|---|
| 1 | TLS — `curl -I https://api.comm.wasal.sa/health/` | HTTP/2 200, server: cloudflare | ☐ |
| 2 | TLS — `curl -I https://app.comm.wasal.sa/` | HTTP/2 200 | ☐ |
| 3 | HTTP→HTTPS redirect on port 80 | 301/308 | ☐ |
| 4 | `/health/` all fields ok | `"database":"ok","redis":"ok","celery":"ok"` | ☐ |
| 5 | Login returns JWT | access + refresh tokens | ☐ |
| 6 | Frontend loads — no console errors | HTTP 200, SPA bundle present | ☐ |
| 7 | WebSocket connects | Status 101, "مباشر" green indicator | ☐ |
| 8 | Mock inbound appears live | < 2s, no refresh | ☐ |
| 9 | Reply sends and appears live | `status: "sent"`, < 2s | ☐ |
| 10 | Status update broadcasts | live badge update | ☐ |
| 11 | Tenant isolation | agent1 sees only nedaa conversations | ☐ |
| 12 | Celery processes webhook | log shows "processed OK" | ☐ |
| 13 | Audit log entries created | reply_sent + status_changed visible | ☐ |
| 14 | Encrypted fields decrypt | OK = True for 360dialog numbers | ☐ |

**All 14 checks must pass before connecting a real 360dialog number.**
