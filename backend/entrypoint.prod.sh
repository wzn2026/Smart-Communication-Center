#!/bin/sh
# Production entrypoint — runs before the main process (Daphne or Celery).
# Applies only to the backend service; celery_worker image skips collectstatic.
set -e

SETTINGS=config.settings.production

echo "[entrypoint] Running database migrations..."
python manage.py migrate --settings=$SETTINGS --noinput

# Only collect static when starting the web server (not celery)
if [ "$1" = "daphne" ]; then
    echo "[entrypoint] Collecting static files..."
    python manage.py collectstatic --settings=$SETTINGS --noinput --clear
fi

echo "[entrypoint] Starting: $*"
exec "$@"
