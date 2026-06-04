#!/bin/bash
# ─── Production health check ──────────────────────────────────────────────────
# Usage: ./scripts/prod_health_check.sh [--remote]
#
# Without --remote: checks via Docker network (local container)
# With --remote: checks via public URL (requires API_HOST to be set)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"
API_HOST="${API_HOST:-https://api.comm.wasal.sa}"
EXIT_CODE=0

pass() { echo "  [PASS] $1"; }
fail() { echo "  [FAIL] $1"; EXIT_CODE=1; }
warn() { echo "  [WARN] $1"; }

echo "═══════════════════════════════════════"
echo "  Production Health Check"
echo "═══════════════════════════════════════"

# ── Container status ──────────────────────────────────────────────────────────
echo ""
echo "Container status:"
$COMPOSE ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"

# ── Django health endpoint (internal) ─────────────────────────────────────────
echo ""
echo "Django /health/ (internal):"
HEALTH=$($COMPOSE exec -T backend \
    python -c "
import urllib.request, json, sys
try:
    r = urllib.request.urlopen('http://localhost:8000/health/', timeout=5)
    d = json.loads(r.read())
    print(json.dumps(d, indent=2))
    sys.exit(0 if d.get('status') == 'ok' else 1)
except Exception as e:
    print(f'ERROR: {e}')
    sys.exit(1)
" 2>&1) && STATUS=0 || STATUS=$?

echo "$HEALTH"
if [ "$STATUS" -eq 0 ]; then
    pass "Django health endpoint OK"
else
    fail "Django health endpoint FAILED"
fi

# ── Celery worker ──────────────────────────────────────────────────────────────
echo ""
echo "Celery worker ping:"
CELERY=$($COMPOSE exec -T celery_worker \
    celery -A config.celery inspect ping --timeout 5 2>&1) && CSTATUS=0 || CSTATUS=$?
if echo "$CELERY" | grep -q "pong"; then
    pass "Celery worker responding"
else
    fail "Celery worker not responding — $CELERY"
fi

# ── Remote health (optional) ──────────────────────────────────────────────────
if [[ "${1:-}" == "--remote" ]]; then
    echo ""
    echo "Remote health check ($API_HOST):"
    REMOTE=$(curl -sf --max-time 10 "$API_HOST/health/" 2>&1) && RSTATUS=0 || RSTATUS=$?
    if [ "$RSTATUS" -eq 0 ]; then
        echo "$REMOTE" | python3 -m json.tool 2>/dev/null || echo "$REMOTE"
        pass "Remote /health/ OK"
    else
        fail "Remote /health/ FAILED: $REMOTE"
    fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════"
if [ "$EXIT_CODE" -eq 0 ]; then
    echo "  Result: ALL CHECKS PASSED"
else
    echo "  Result: SOME CHECKS FAILED — review output above"
fi
echo "═══════════════════════════════════════"
exit $EXIT_CODE
