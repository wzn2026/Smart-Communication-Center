#!/bin/bash
# ─── View production logs ─────────────────────────────────────────────────────
# Usage:
#   ./scripts/prod_logs.sh              # all services, last 50 lines
#   ./scripts/prod_logs.sh backend      # single service, follow
#   ./scripts/prod_logs.sh celery_worker 100   # 100 lines
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"
SERVICE="${1:-}"
LINES="${2:-50}"

if [ -n "$SERVICE" ]; then
    exec $COMPOSE logs -f --tail="$LINES" "$SERVICE"
else
    exec $COMPOSE logs -f --tail="$LINES"
fi
