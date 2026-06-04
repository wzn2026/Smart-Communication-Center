#!/bin/bash
# ─── PostgreSQL Restore Script ────────────────────────────────────────────────
# Usage:
#   ./scripts/restore_db.sh backups/scc_db_20260605_120000.sql.gz
#
# WARNING: This will DROP and recreate the database. All current data is lost.
# Run a backup first: ./scripts/backup_db.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
    echo "Error: backup file path required."
    echo "Usage: $0 <backup_file.sql.gz>"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: backup file not found: $BACKUP_FILE"
    exit 1
fi

# Read DB credentials from .env.production
if [ -f .env.production ]; then
    # shellcheck disable=SC1091
    set -a; source .env.production; set +a
fi

POSTGRES_USER="${POSTGRES_USER:-scc_user}"
POSTGRES_DB="${POSTGRES_DB:-scc_db}"

echo "=========================================================="
echo "  RESTORE: ${BACKUP_FILE}"
echo "  TARGET:  ${POSTGRES_DB} (user: ${POSTGRES_USER})"
echo "  WARNING: All current data will be REPLACED."
echo "=========================================================="
read -rp "Type 'yes' to confirm: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "[restore] Stopping backend and celery to prevent writes..."
docker compose -f "$COMPOSE_FILE" stop backend celery_worker

echo "[restore] Dropping and recreating database..."
docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U "$POSTGRES_USER" -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U "$POSTGRES_USER" -c "CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};"

echo "[restore] Loading backup..."
gunzip -c "$BACKUP_FILE" | \
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "[restore] Restarting services..."
docker compose -f "$COMPOSE_FILE" start backend celery_worker

echo "[restore] Done. Verify the application is healthy:"
echo "  docker compose -f $COMPOSE_FILE ps"
echo "  curl https://api.comm.wasal.sa/health/"
