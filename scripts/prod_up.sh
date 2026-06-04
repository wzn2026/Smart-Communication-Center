#!/bin/bash
# ─── Start production stack ───────────────────────────────────────────────────
# Usage: ./scripts/prod_up.sh [--build]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"

if [ ! -f .env.production ]; then
    echo "ERROR: .env.production not found."
    echo "  Copy .env.production.example and fill in all values."
    exit 1
fi

if [[ "${1:-}" == "--build" ]]; then
    echo "[prod] Building images..."
    $COMPOSE build
fi

echo "[prod] Starting services..."
$COMPOSE up -d

echo "[prod] Waiting for services to become healthy..."
sleep 5
$COMPOSE ps

echo ""
echo "[prod] Tail logs: ./scripts/prod_logs.sh"
echo "[prod] Health check: ./scripts/prod_health_check.sh"
