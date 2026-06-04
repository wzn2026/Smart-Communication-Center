#!/bin/bash
# ─── Run Django migrations in production ─────────────────────────────────────
# Usage: ./scripts/prod_migrate.sh
#
# The entrypoint.prod.sh already runs this on every backend container start.
# Use this script to run migrations manually (e.g. after a forced restart).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "[migrate] Running migrations..."
$COMPOSE exec backend \
    python manage.py migrate --settings=config.settings.production

echo "[migrate] Current migration state:"
$COMPOSE exec backend \
    python manage.py showmigrations --settings=config.settings.production

echo "[migrate] Done."
