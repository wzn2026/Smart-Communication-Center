# Deployment Guide — Hetzner VPS + Cloudflare

Target domains:
- `app.comm.wasal.sa` → React SPA (frontend)
- `api.comm.wasal.sa` → Django/Daphne (HTTP API + WebSocket)

SSL architecture: **Cloudflare Full Strict** — Cloudflare validates the origin cert.

```
Browser ──HTTPS──▶ Cloudflare ──HTTPS (Origin Cert)──▶ Nginx :443 ──HTTP──▶ Daphne / Frontend
```

---

## Quick Reference — Production Command Sequence

```bash
# Exact order — first-time deploy:
git clone <repo> smart-comm && cd smart-comm

# 1. Cert (do this before compose up)
mkdir -p /opt/cloudflare
# paste origin.pem and origin.key (see Section 3)
chmod 600 /opt/cloudflare/origin.key

# 2. Environment
cp .env.production.example .env.production && nano .env.production

# 3. UFW
# (see Section 2 — allow CF IPs on 80 + 443)

# 4. Build + infra
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d postgres redis
# wait for healthy...

# 5. Migrate + validate
docker compose -f docker-compose.prod.yml run --rm backend \
    python manage.py migrate --settings=config.settings.production
docker compose -f docker-compose.prod.yml run --rm backend \
    python manage.py check_production_env --settings=config.settings.production
docker compose -f docker-compose.prod.yml run --rm backend \
    python manage.py createsuperuser --settings=config.settings.production

# 6. Start all
docker compose -f docker-compose.prod.yml up -d && sleep 35

# 7. Verify
docker compose -f docker-compose.prod.yml exec backend \
    python manage.py smoke_check --settings=config.settings.production
./scripts/prod_health_check.sh --remote
curl -I https://api.comm.wasal.sa/health/
curl -I https://app.comm.wasal.sa/
./scripts/backup_db.sh
```

---

## 1. Server Setup (Hetzner VPS)

### Recommended Specs
| Component | Minimum | Recommended |
|---|---|---|
| Instance | CX21 (2 vCPU, 4 GB) | CPX31 (4 vCPU, 8 GB) |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Storage | 40 GB SSD | 80 GB + block volume |

### System Setup
```bash
apt-get update && apt-get upgrade -y

# Docker (official method)
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER
newgrp docker
docker compose version   # must show v2.x

# Tools
apt-get install -y git curl jq htop fail2ban ufw

# Fail2ban (protect SSH)
systemctl enable fail2ban && systemctl start fail2ban
```

---

## 2. Firewall (UFW)

Nginx listens on **443** (HTTPS with Cloudflare Origin Cert) and **80** (redirect to 443).
Only Cloudflare IP ranges are allowed on both ports.

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh

# Cloudflare IPv4 — allow 80 and 443
for ip in \
  173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 \
  141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 \
  197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 \
  104.24.0.0/14 172.64.0.0/13 131.0.72.0/22; do
  ufw allow from $ip to any port 80
  ufw allow from $ip to any port 443
done

# Cloudflare IPv6 — allow 80 and 443
for ip in \
  2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32 \
  2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32; do
  ufw allow from $ip to any port 80
  ufw allow from $ip to any port 443
done

ufw enable
ufw status verbose
```

**Expected output (abbreviated):**
```
To                         Action  From
--                         ------  ----
22/tcp                     ALLOW   Anywhere
80                         ALLOW   173.245.48.0/20
443                        ALLOW   173.245.48.0/20
... (all CF ranges) ...
```

> **Security**: PostgreSQL (5432), Redis (6379), and Daphne (8000) are on internal Docker
> networks only — no port bindings, never reachable from the host or internet.

---

## 3. Cloudflare Origin Certificate

Cloudflare Origin Certificates are free TLS certs issued by Cloudflare CA.
They are **only valid when traffic comes through Cloudflare** (Full Strict mode).

### 3A — Generate the certificate

1. Cloudflare Dashboard → your zone (`wasal.sa`)
2. **SSL/TLS → Origin Server → Create Certificate**
3. Settings:
   - Key type: **RSA (2048)**
   - Hostnames: `*.comm.wasal.sa`, `comm.wasal.sa`
   - Validity: **15 years**
4. Click **Create**
5. Copy the two values:
   - **Origin Certificate** → paste into `origin.pem`
   - **Private Key** → paste into `origin.key`

### 3B — Install on the server

```bash
mkdir -p /opt/cloudflare

# Paste the certificate (multi-line — use heredoc or nano):
nano /opt/cloudflare/origin.pem
# Paste: -----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----

nano /opt/cloudflare/origin.key
# Paste: -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----

# Secure the private key
chmod 600 /opt/cloudflare/origin.key
chmod 644 /opt/cloudflare/origin.pem
ls -la /opt/cloudflare/
# Expected:
# -rw-r--r-- root root origin.pem
# -rw------- root root origin.key
```

### 3C — Set Cloudflare SSL mode

In Cloudflare Dashboard → SSL/TLS → Overview:
- **Mode: Full (strict)** ← set this

| Mode | Cloudflare → Origin | Security |
|---|---|---|
| Off | HTTP | ❌ |
| Flexible | HTTP | ⚠️ |
| Full | HTTPS (any cert) | ⚠️ |
| **Full (strict)** | **HTTPS (valid cert)** | **✅ Correct** |

Also enable:
- **Always Use HTTPS**: On
- **Minimum TLS Version**: TLS 1.2
- **Network → WebSockets**: On

---

## 4. Clone Repository

```bash
cd /opt
git clone <your-repo-url> smart-comm
cd smart-comm
```

---

## 5. Configure Environment

```bash
cp .env.production.example .env.production
nano .env.production   # fill ALL values — never commit this file
```

### Generate Required Keys

```bash
# DJANGO_SECRET_KEY
python3 -c "import secrets; print(secrets.token_hex(50))"

# FIELD_ENCRYPTION_KEY (Fernet — back this up securely off-server!)
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# WEBHOOK_SECRET (for 360dialog — prepare now, enable later)
python3 -c "import secrets; print(secrets.token_hex(32))"

# POSTGRES_PASSWORD
python3 -c "import secrets; print(secrets.token_urlsafe(24))"
```

### Minimum Required `.env.production` Values
```ini
DEBUG=false
DJANGO_SECRET_KEY=<100 hex chars>
FIELD_ENCRYPTION_KEY=<Fernet key>
POSTGRES_PASSWORD=<strong password>
DATABASE_URL=postgresql://scc_user:<password>@postgres:5432/scc_db
REDIS_URL=redis://redis:6379/0
CHANNEL_LAYER_REDIS_URL=redis://redis:6379/1
ALLOWED_HOSTS=api.comm.wasal.sa,app.comm.wasal.sa
CORS_ALLOWED_ORIGINS=https://app.comm.wasal.sa
CSRF_TRUSTED_ORIGINS=https://api.comm.wasal.sa,https://app.comm.wasal.sa
WHATSAPP_PROVIDER=mock
WEBHOOK_SECRET=<prepared but not active until 360dialog>
```

---

## 6. Cloudflare DNS Records

In the Cloudflare dashboard for `wasal.sa`:

| Type | Name | Content | TTL | Proxy status |
|---|---|---|---|---|
| A | `app.comm` | `<VPS_IP>` | Auto | ✅ Proxied (orange cloud) |
| A | `api.comm` | `<VPS_IP>` | Auto | ✅ Proxied (orange cloud) |

> DNS-only (grey cloud) will bypass Cloudflare entirely — always use orange cloud.

---

## 7. Cloudflare Cache Rules

Create a Cache Rule to bypass cache for dynamic paths:

**Cache → Cache Rules → Create Rule**

```
Rule name: bypass-dynamic-paths
If: URI Path starts with /api/
  OR URI Path starts with /ws/
  OR URI Path starts with /admin/
  OR URI Path starts with /health/
Then: Cache status = Bypass
```

---

## 8. Build Images

```bash
docker compose -f docker-compose.prod.yml build
# Builds: scc_backend:latest, scc_frontend:latest
# Frontend bakes VITE_API_BASE_URL=https://api.comm.wasal.sa/api
#                VITE_WS_BASE_URL=wss://api.comm.wasal.sa/ws
```

---

## 9. Start Infrastructure

```bash
docker compose -f docker-compose.prod.yml up -d postgres redis

# Wait until both show "healthy" (up to 60s)
watch -n 3 "docker compose -f docker-compose.prod.yml ps"
# Press Ctrl+C when both are "healthy"
```

---

## 10. Run Migrations

```bash
docker compose -f docker-compose.prod.yml run --rm backend \
    python manage.py migrate --settings=config.settings.production
```

All lines should end in `... OK`.

---

## 11. Validate Environment

```bash
docker compose -f docker-compose.prod.yml run --rm backend \
    python manage.py check_production_env --settings=config.settings.production
```

**Required: zero `[ERROR]` lines.** One `[WARN]` about mock provider is expected.

---

## 12. Create Superuser

```bash
docker compose -f docker-compose.prod.yml run --rm backend \
    python manage.py createsuperuser --settings=config.settings.production
```

---

## 13. (Optional) Seed Demo Data

Only run on fresh staging — **do not run if you already have production data**:
```bash
docker compose -f docker-compose.prod.yml run --rm backend \
    python manage.py seed_data --settings=config.settings.production
# Creates: admin/admin123, agent1/agent123, nedaa + family-fund tenants
```

---

## 14. Start All Services

```bash
docker compose -f docker-compose.prod.yml up -d
```

Wait 30–40s then verify:
```bash
docker compose -f docker-compose.prod.yml ps
```

**Expected:**
```
NAME              STATUS              PORTS
scc_postgres      Up (healthy)
scc_redis         Up (healthy)
backend           Up (healthy)
celery_worker     Up (healthy)
frontend          Up
nginx             Up    0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

> If any container shows `Restarting`: run `./scripts/prod_logs.sh <name>` and share the output.

---

## 15. Smoke Check

```bash
docker compose -f docker-compose.prod.yml exec backend \
    python manage.py smoke_check --settings=config.settings.production
```

**Required: 7/7 PASS.**

---

## 16. HTTPS Verification

```bash
# Health endpoint — check response code and headers
curl -I https://api.comm.wasal.sa/health/
# Expected:
#   HTTP/2 200
#   server: cloudflare
#   content-type: application/json

# Full response body
curl -s https://api.comm.wasal.sa/health/ | python3 -m json.tool
# Expected: {"app":"ok","database":"ok","redis":"ok","celery":"ok (1 worker(s))"}

# Frontend
curl -I https://app.comm.wasal.sa/
# Expected: HTTP/2 200
```

**Verify TLS grade (optional):**
```bash
# From another machine — checks Cloudflare presents a valid cert
curl -vI https://api.comm.wasal.sa/health/ 2>&1 | grep -E "SSL|TLS|issuer|subject|HTTP"
```

---

## 17. API and WebSocket Test

```bash
# Login
TOKEN=$(curl -s -X POST https://api.comm.wasal.sa/api/auth/token/ \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"<your-password>"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['access'])")
echo "Token (first 40): ${TOKEN:0:40}..."

# API call
curl -s https://api.comm.wasal.sa/api/conversations/ \
    -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# WebSocket (requires: npm install -g wscat)
wscat -c "wss://api.comm.wasal.sa/ws/inbox/?token=$TOKEN" --wait 3
# Expected: connected → disconnected cleanly (code 1000, no error)
```

---

## 18. Celery Verification

```bash
# Trigger a mock inbound
curl -s -X POST https://api.comm.wasal.sa/api/mock/inbound-message/ \
    -H "Content-Type: application/json" \
    -d '{"from_number":"+966500000099","to_number":"+966500000001","body":"celery smoke"}'

# Verify celery processed it
docker compose -f docker-compose.prod.yml logs celery_worker --tail=20
# Expected: "WebhookEvent ... processed OK (inbound_message)"
```

---

## 19. First Backup

```bash
chmod +x scripts/*.sh
./scripts/backup_db.sh
ls -lh backups/
# Expected: scc_db_<timestamp>.sql.gz
```

---

## 20. Operations Reference

```bash
# Status
docker compose -f docker-compose.prod.yml ps

# Logs (follow)
./scripts/prod_logs.sh backend
./scripts/prod_logs.sh celery_worker
./scripts/prod_logs.sh nginx

# Health check (local + remote)
./scripts/prod_health_check.sh --remote

# Restart a single service
docker compose -f docker-compose.prod.yml restart backend

# Run Django management command
docker compose -f docker-compose.prod.yml exec backend \
    python manage.py <cmd> --settings=config.settings.production

# Backup
./scripts/backup_db.sh

# Restore (stops backend + celery, prompts for confirmation)
./scripts/restore_db.sh backups/scc_db_<timestamp>.sql.gz
```

---

## 21. Update / Redeploy

```bash
./scripts/backup_db.sh            # always backup before deploy

git pull origin main
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d   # rolling restart

# entrypoint.prod.sh runs migrations on backend restart automatically.
./scripts/prod_health_check.sh --remote
```

---

## 22. Rollback

```bash
./scripts/backup_db.sh            # if not already done

git checkout <previous-commit>
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# If schema changed:
./scripts/restore_db.sh backups/scc_db_<pre-deploy-timestamp>.sql.gz
```

---

## 23. Connecting a Real 360dialog Number

**Pre-flight checklist before switching WHATSAPP_PROVIDER=360dialog:**
- [ ] All smoke tests pass (7/7)
- [ ] `./scripts/prod_health_check.sh --remote` passes
- [ ] Mock inbound → live inbox update works
- [ ] `FIELD_ENCRYPTION_KEY` backed up securely (off-server)
- [ ] `WEBHOOK_SECRET` prepared in `.env.production`
- [ ] `DIALOG360_API_KEY` from 360dialog partner dashboard

**Switch:**
```bash
nano .env.production
# Set: WHATSAPP_PROVIDER=360dialog
# Set: DIALOG360_API_KEY=<from 360dialog>
# Confirm: WEBHOOK_SECRET is set

docker compose -f docker-compose.prod.yml run --rm backend \
    python manage.py check_production_env --settings=config.settings.production
# Must pass with zero errors

docker compose -f docker-compose.prod.yml restart backend

# In 360dialog dashboard:
# Webhook URL: https://api.comm.wasal.sa/api/webhooks/whatsapp/360dialog/
# Secret: <same value as WEBHOOK_SECRET>
```

---

## Remaining Risks Before 360dialog

| Risk | Details | Mitigation |
|---|---|---|
| `FIELD_ENCRYPTION_KEY` loss | Encrypted API keys unreadable | Store in password manager off-server |
| WebSocket drops under Cloudflare | Long-idle WS may be terminated | Reconnect logic in `useInboxSocket.ts` handles this |
| Redis data loss | Tasks in flight lost if Redis crashes | Redis persistence configured (`--save 60 1`) |
| HSTS not yet enabled | `SECURE_HSTS_SECONDS=0` | Enable only after SSL confirmed stable for 2+ weeks |
| Webhook signature bypass disabled | `BYPASS_WEBHOOK_SIGNATURE=False` ✅ | Verified by `check_production_env` |
| 360dialog IP allowlist | No WAF rule yet restricting webhook path | Add Cloudflare WAF rule after first successful webhook |
