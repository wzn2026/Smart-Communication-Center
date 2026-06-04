#!/bin/bash
# ─── PostgreSQL Backup Script ─────────────────────────────────────────────────
# Usage:
#   ./scripts/backup_db.sh                        # backup to ./backups/
#   ./scripts/backup_db.sh /mnt/backups           # backup to custom dir
#
# Requires: docker compose -f docker-compose.prod.yml to be running.
# Backups are gzip-compressed pg_dump files with timestamps.
#
# Future: add R2/S3 upload here once bucket is configured.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${1:-$(dirname "$0")/../backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/scc_db_${TIMESTAMP}.sql.gz"

# Read DB credentials from .env.production
if [ -f .env.production ]; then
    # shellcheck disable=SC1091
    set -a; source .env.production; set +a
fi

POSTGRES_USER="${POSTGRES_USER:-scc_user}"
POSTGRES_DB="${POSTGRES_DB:-scc_db}"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting backup of '${POSTGRES_DB}' → ${BACKUP_FILE}"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
    | gzip > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[backup] Done. Size: ${SIZE}"
echo "[backup] File: ${BACKUP_FILE}"

# Keep only the last 30 backups
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/scc_db_*.sql.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 30 ]; then
    echo "[backup] Pruning old backups (keeping 30)..."
    ls -1t "${BACKUP_DIR}"/scc_db_*.sql.gz | tail -n +31 | xargs rm -f
fi

echo "[backup] Complete."

# ─── Restore command (for reference) ─────────────────────────────────────────
# To restore from a backup file:
#   gunzip -c backups/scc_db_<timestamp>.sql.gz | \
#     docker compose -f docker-compose.prod.yml exec -T postgres \
#     psql -U scc_user -d scc_db
