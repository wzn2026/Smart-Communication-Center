#!/bin/bash
# ─── Stop production stack ────────────────────────────────────────────────────
# Usage:
#   ./scripts/prod_down.sh          # stop containers, keep volumes
#   ./scripts/prod_down.sh --clean  # stop + remove volumes (DESTROYS DATA)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"

if [[ "${1:-}" == "--clean" ]]; then
    echo "WARNING: This will remove all volumes including the database."
    read -rp "Type 'destroy' to confirm: " CONFIRM
    if [ "$CONFIRM" != "destroy" ]; then
        echo "Cancelled."
        exit 0
    fi
    echo "[prod] Stopping and removing volumes..."
    $COMPOSE down -v
else
    echo "[prod] Stopping services (volumes preserved)..."
    $COMPOSE down
fi

echo "[prod] Done."
