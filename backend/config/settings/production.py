"""
Production settings for Smart Communication Center.
Loaded when DJANGO_SETTINGS_MODULE=config.settings.production.

Required env vars (will raise ImproperlyConfigured if missing):
  DJANGO_SECRET_KEY
  DATABASE_URL
  REDIS_URL
  FIELD_ENCRYPTION_KEY
  WEBHOOK_SECRET  (required when WHATSAPP_PROVIDER=360dialog)
"""
import logging
from django.core.exceptions import ImproperlyConfigured
from .base import *  # noqa

# ─── Core ─────────────────────────────────────────────────────────────────────

DEBUG = False

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=[
    'api.comm.wasal.sa',
    'app.comm.wasal.sa',
])

# ─── Security ─────────────────────────────────────────────────────────────────

# Cloudflare/Nginx sets X-Forwarded-Proto: https — trust it
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# SSL redirect is handled by Cloudflare; set True only if you terminate SSL on Nginx
SECURE_SSL_REDIRECT = env.bool('SECURE_SSL_REDIRECT', default=False)

SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'

CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'

CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=[
    'https://api.comm.wasal.sa',
    'https://app.comm.wasal.sa',
])

# HSTS — enable after confirming SSL is stable
SECURE_HSTS_SECONDS = env.int('SECURE_HSTS_SECONDS', default=0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', default=False)
SECURE_HSTS_PRELOAD = False

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# Explicit: never bypass webhook signature validation in production
BYPASS_WEBHOOK_SIGNATURE = False

# ─── CORS ─────────────────────────────────────────────────────────────────────

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[
    'https://app.comm.wasal.sa',
])
CORS_ALLOW_CREDENTIALS = True

# ─── Logging ──────────────────────────────────────────────────────────────────

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'production': {
            'format': '{asctime} {levelname} [{name}] {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'production',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.security': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console'],
            'level': env('LOG_LEVEL', default='INFO'),
            'propagate': False,
        },
        'services': {
            'handlers': ['console'],
            'level': env('LOG_LEVEL', default='INFO'),
            'propagate': False,
        },
        'celery': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}

# ─── Startup validation ───────────────────────────────────────────────────────

def _require(var_name: str, value: str, hint: str = '') -> None:
    if not value:
        msg = f"{var_name} is required in production."
        if hint:
            msg += f" {hint}"
        raise ImproperlyConfigured(msg)


_require(
    'DJANGO_SECRET_KEY',
    SECRET_KEY if SECRET_KEY != 'dev-secret-key-change-in-production' else '',
    "Set a long random string (e.g. python -c \"import secrets; print(secrets.token_hex(50))\").",
)

_require(
    'FIELD_ENCRYPTION_KEY',
    FIELD_ENCRYPTION_KEY,
    "Generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"",
)

_provider = env('WHATSAPP_PROVIDER', default='mock')
if _provider == '360dialog':
    _require(
        'WEBHOOK_SECRET',
        WEBHOOK_SECRET,
        "Required when WHATSAPP_PROVIDER=360dialog.",
    )

# Log startup validation success (avoids silent misconfiguration)
_logger = logging.getLogger(__name__)
_logger.info(
    "Production settings loaded. Provider=%s HSTS=%ds",
    _provider, SECURE_HSTS_SECONDS,
)
