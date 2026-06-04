"""
python manage.py check_production_env

Validates production environment configuration before or after deploy.
Exits 0 if all required checks pass; exits 1 if any ERRORs found.
"""
import os
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = 'Validate production environment configuration.'

    def handle(self, *args, **options):
        errors: list[str] = []
        warnings: list[str] = []

        def err(msg: str) -> None:
            errors.append(msg)
            self.stdout.write(self.style.ERROR(f'  [ERROR] {msg}'))

        def warn(msg: str) -> None:
            warnings.append(msg)
            self.stdout.write(self.style.WARNING(f'  [WARN]  {msg}'))

        def ok(msg: str) -> None:
            self.stdout.write(self.style.SUCCESS(f'  [OK]    {msg}'))

        self.stdout.write(self.style.MIGRATE_HEADING('\n=== Production Environment Check ===\n'))

        # ── DEBUG ──────────────────────────────────────────────────────────────
        if settings.DEBUG:
            err('DEBUG is True. Must be False in production.')
        else:
            ok('DEBUG=False')

        # ── SECRET_KEY ────────────────────────────────────────────────────────
        sk = settings.SECRET_KEY
        if sk in ('dev-secret-key-change-in-production', 'dev-secret-key'):
            err('SECRET_KEY is using the default dev value.')
        elif len(sk) < 50:
            err(f'SECRET_KEY is too short ({len(sk)} chars, need ≥ 50).')
        else:
            ok(f'SECRET_KEY set ({len(sk)} chars)')

        # ── FIELD_ENCRYPTION_KEY ──────────────────────────────────────────────
        fek = getattr(settings, 'FIELD_ENCRYPTION_KEY', '')
        if not fek:
            err('FIELD_ENCRYPTION_KEY is not set.')
        else:
            try:
                from cryptography.fernet import Fernet, InvalidToken
                Fernet(fek.encode() if isinstance(fek, str) else fek)
                ok('FIELD_ENCRYPTION_KEY is a valid Fernet key')
            except Exception as e:
                err(f'FIELD_ENCRYPTION_KEY is invalid: {e}')

        # ── DATABASE_URL ──────────────────────────────────────────────────────
        db_url = os.environ.get('DATABASE_URL', '')
        if not db_url:
            err('DATABASE_URL environment variable is not set.')
        elif 'localhost' in db_url or '127.0.0.1' in db_url:
            warn('DATABASE_URL points to localhost — ensure this is intentional in Docker.')
        else:
            ok('DATABASE_URL set')

        # ── REDIS_URL ─────────────────────────────────────────────────────────
        redis_url = os.environ.get('REDIS_URL', '')
        if not redis_url:
            err('REDIS_URL environment variable is not set.')
        else:
            ok('REDIS_URL set')

        # ── ALLOWED_HOSTS ─────────────────────────────────────────────────────
        hosts = settings.ALLOWED_HOSTS
        if not hosts or hosts == ['*']:
            err("ALLOWED_HOSTS is ['*'] or empty — too permissive.")
        else:
            ok(f'ALLOWED_HOSTS: {hosts}')
            if 'api.comm.wasal.sa' not in hosts:
                warn('api.comm.wasal.sa is not in ALLOWED_HOSTS.')

        # ── CORS ──────────────────────────────────────────────────────────────
        if getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', False):
            err('CORS_ALLOW_ALL_ORIGINS is True — allows any origin.')
        else:
            cors = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
            if not cors:
                err('CORS_ALLOWED_ORIGINS is empty.')
            else:
                ok(f'CORS_ALLOWED_ORIGINS: {cors}')
                if 'https://app.comm.wasal.sa' not in cors:
                    warn('https://app.comm.wasal.sa not in CORS_ALLOWED_ORIGINS.')

        # ── CSRF ──────────────────────────────────────────────────────────────
        trusted = getattr(settings, 'CSRF_TRUSTED_ORIGINS', [])
        if not trusted:
            err('CSRF_TRUSTED_ORIGINS is empty.')
        else:
            ok(f'CSRF_TRUSTED_ORIGINS: {trusted}')
            for domain in ('https://api.comm.wasal.sa', 'https://app.comm.wasal.sa'):
                if domain not in trusted:
                    warn(f'{domain} not in CSRF_TRUSTED_ORIGINS.')

        # ── Secure cookies ────────────────────────────────────────────────────
        if not settings.SESSION_COOKIE_SECURE:
            err('SESSION_COOKIE_SECURE must be True.')
        else:
            ok('SESSION_COOKIE_SECURE=True')

        if not settings.CSRF_COOKIE_SECURE:
            err('CSRF_COOKIE_SECURE must be True.')
        else:
            ok('CSRF_COOKIE_SECURE=True')

        # ── SECURE_PROXY_SSL_HEADER ───────────────────────────────────────────
        if not getattr(settings, 'SECURE_PROXY_SSL_HEADER', None):
            warn('SECURE_PROXY_SSL_HEADER is not set. HTTPS detection may not work behind Cloudflare/Nginx.')
        else:
            ok(f'SECURE_PROXY_SSL_HEADER={settings.SECURE_PROXY_SSL_HEADER}')

        # ── SECURE_SSL_REDIRECT ───────────────────────────────────────────────
        ssl_redirect = getattr(settings, 'SECURE_SSL_REDIRECT', False)
        if ssl_redirect:
            warn('SECURE_SSL_REDIRECT=True — ensure Cloudflare does not cause a redirect loop.')
        else:
            ok('SECURE_SSL_REDIRECT=False (Cloudflare handles SSL)')

        # ── BYPASS_WEBHOOK_SIGNATURE ──────────────────────────────────────────
        if getattr(settings, 'BYPASS_WEBHOOK_SIGNATURE', False):
            err('BYPASS_WEBHOOK_SIGNATURE is True — webhook signatures are not validated.')
        else:
            ok('BYPASS_WEBHOOK_SIGNATURE=False')

        # ── WhatsApp provider-specific ────────────────────────────────────────
        provider = os.environ.get('WHATSAPP_PROVIDER', 'mock')
        ok(f'WHATSAPP_PROVIDER={provider}')
        if provider == '360dialog':
            if not os.environ.get('WEBHOOK_SECRET'):
                err('WEBHOOK_SECRET is required when WHATSAPP_PROVIDER=360dialog.')
            else:
                ok('WEBHOOK_SECRET set')
            if not os.environ.get('DIALOG360_API_KEY'):
                err('DIALOG360_API_KEY is required when WHATSAPP_PROVIDER=360dialog.')
            else:
                ok('DIALOG360_API_KEY set')
        elif provider == 'mock':
            warn('WHATSAPP_PROVIDER=mock — using mock provider (no real messages).')

        # ── Summary ───────────────────────────────────────────────────────────
        self.stdout.write('')
        self.stdout.write('─' * 40)
        if errors:
            self.stdout.write(self.style.ERROR(
                f'Result: {len(errors)} ERROR(s), {len(warnings)} warning(s) — NOT ready for production.'
            ))
            raise SystemExit(1)
        elif warnings:
            self.stdout.write(self.style.WARNING(
                f'Result: 0 errors, {len(warnings)} warning(s) — review warnings before going live.'
            ))
        else:
            self.stdout.write(self.style.SUCCESS('Result: ALL CHECKS PASSED'))
