"""
Health check endpoint.
GET /health/ or /api/health/

Returns:
  200 OK   — all critical systems healthy
  503 Service Unavailable — database unreachable (critical)

Redis/Celery failures return degraded status with 200 (non-critical for reads).
"""
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

logger = logging.getLogger(__name__)


class HealthView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        result = {
            'app': 'ok',
            'database': 'unknown',
            'redis': 'unknown',
            'celery': 'not_checked',
        }
        http_status = 200

        # ── Database ──────────────────────────────────────────────────────────
        try:
            from django.db import connection
            connection.ensure_connection()
            result['database'] = 'ok'
        except Exception as exc:
            result['database'] = f'error: {type(exc).__name__}'
            http_status = 503
            logger.error("Health: database unreachable — %s", exc)

        # ── Redis ─────────────────────────────────────────────────────────────
        try:
            from django.conf import settings
            import redis as redis_lib
            redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379/0')
            r = redis_lib.from_url(redis_url, socket_connect_timeout=2)
            r.ping()
            result['redis'] = 'ok'
        except Exception as exc:
            result['redis'] = f'degraded: {type(exc).__name__}'
            logger.warning("Health: Redis unavailable — %s", exc)

        # ── Celery ────────────────────────────────────────────────────────────
        # Only attempt Celery ping if Redis is healthy (it's the broker)
        if result['redis'] == 'ok':
            try:
                from config.celery import app as celery_app
                inspector = celery_app.control.inspect(timeout=1.5)
                ping_result = inspector.ping()
                if ping_result:
                    worker_count = len(ping_result)
                    result['celery'] = f'ok ({worker_count} worker(s))'
                else:
                    result['celery'] = 'degraded: no workers responding'
            except Exception as exc:
                result['celery'] = f'degraded: {type(exc).__name__}'
        else:
            result['celery'] = 'degraded: broker unavailable'

        return Response(result, status=http_status)
