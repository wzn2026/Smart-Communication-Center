"""Test settings — uses SQLite and in-memory Celery broker."""
from .base import *  # noqa

# Use SQLite in-memory for tests (no PostgreSQL required)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Use in-memory cache (no Redis required)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# Celery: in-memory broker + synchronous execution
CELERY_BROKER_URL = 'memory://'
CELERY_RESULT_BACKEND = 'cache+memory://'
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Django Channels: use in-memory layer so tests don't need a real Redis
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}

# Webhook validation — explicit bypass flag for tests
# (individual tests that need strict validation use override_settings to unset this)
WEBHOOK_SECRET = ''
DEBUG = True
BYPASS_WEBHOOK_SIGNATURE = True  # always allow in tests unless overridden

# Field encryption key for consistent test behavior
FIELD_ENCRYPTION_KEY = 'test-only-key-not-for-production-use-32b'

# Fast password hashing
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# Disable throttling in tests
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []
