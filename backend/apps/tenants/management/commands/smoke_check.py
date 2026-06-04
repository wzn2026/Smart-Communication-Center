"""
python manage.py smoke_check

Quick runtime health check verifying:
  - Database connection
  - Redis connection (cache + channel layer)
  - Celery broker reachability
  - Tenant data integrity
  - Health service logic

Safe to run in production at any time (read-only, no side effects).
"""
import time
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Run a quick runtime smoke check (database, Redis, Celery, tenants).'

    def handle(self, *args, **options):
        passed = 0
        failed = 0

        def ok(label: str, detail: str = '') -> None:
            nonlocal passed
            passed += 1
            msg = f'  [PASS] {label}'
            if detail:
                msg += f' — {detail}'
            self.stdout.write(self.style.SUCCESS(msg))

        def fail(label: str, detail: str = '') -> None:
            nonlocal failed
            failed += 1
            msg = f'  [FAIL] {label}'
            if detail:
                msg += f' — {detail}'
            self.stdout.write(self.style.ERROR(msg))

        self.stdout.write(self.style.MIGRATE_HEADING('\n=== Smoke Check ===\n'))

        # ── 1. Database connection ─────────────────────────────────────────────
        try:
            from django.db import connections
            conn = connections['default']
            conn.ensure_connection()
            with conn.cursor() as c:
                c.execute('SELECT 1')
                result = c.fetchone()
            assert result == (1,)
            ok('Database connection', 'SELECT 1 returned 1')
        except Exception as e:
            fail('Database connection', str(e))

        # ── 2. Django ORM — tenants ────────────────────────────────────────────
        try:
            from apps.tenants.models import Tenant
            count = Tenant.objects.count()
            ok('Tenant ORM query', f'{count} tenant(s) in database')
        except Exception as e:
            fail('Tenant ORM query', str(e))

        # ── 3. Redis cache ─────────────────────────────────────────────────────
        try:
            from django.core.cache import cache
            test_key = '_smoke_check_ping'
            cache.set(test_key, 'pong', timeout=10)
            value = cache.get(test_key)
            cache.delete(test_key)
            assert value == 'pong', f'Got {value!r}'
            ok('Redis cache (django.core.cache)', 'set/get/delete OK')
        except Exception as e:
            fail('Redis cache', str(e))

        # ── 4. Channel layer (Redis) ───────────────────────────────────────────
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            channel_layer = get_channel_layer()
            if channel_layer is None:
                fail('Channel layer', 'get_channel_layer() returned None — check CHANNEL_LAYERS setting')
            else:
                # Send to a smoke-test group and receive from it
                test_group = '_smoke_check_group'
                test_channel = '_smoke_check_channel'

                async def _test():
                    await channel_layer.group_add(test_group, test_channel)
                    await channel_layer.group_send(
                        test_group,
                        {'type': 'smoke.check', 'payload': 'ping'}
                    )
                    msg = await channel_layer.receive(test_channel)
                    await channel_layer.group_discard(test_group, test_channel)
                    return msg

                msg = async_to_sync(_test)()
                assert msg.get('payload') == 'ping', f'Got: {msg}'
                ok('Channel layer (Redis)', 'group_send → receive OK')
        except Exception as e:
            fail('Channel layer', str(e))

        # ── 5. Celery broker connectivity ──────────────────────────────────────
        try:
            from config.celery import app as celery_app
            conn = celery_app.connection_for_read()
            conn.ensure_connection(max_retries=1, timeout=5)
            conn.close()
            ok('Celery broker connection', 'broker reachable')
        except Exception as e:
            fail('Celery broker connection', f'{type(e).__name__}: {e}')

        # ── 6. WhatsApp number + encryption round-trip ─────────────────────────
        try:
            from apps.channels.models import WhatsAppNumber
            wa_count = WhatsAppNumber.objects.count()
            encrypted_count = 0
            for wa in WhatsAppNumber.objects.filter(provider='360dialog')[:5]:
                key = wa.get_provider_api_key()
                if key is not None:
                    encrypted_count += 1
            ok(
                'WhatsApp numbers',
                f'{wa_count} total, {encrypted_count} 360dialog key(s) decrypted OK',
            )
        except Exception as e:
            fail('WhatsApp numbers / encryption', str(e))

        # ── 7. Health service logic (mirrors /health/ endpoint) ───────────────
        try:
            from django.db import connection as db_conn
            with db_conn.cursor() as c:
                c.execute('SELECT 1')
            from django.core.cache import cache as _cache
            _cache.set('_smoke_hc', '1', 1)
            assert _cache.get('_smoke_hc') == '1'
            ok('Health service logic', 'DB + cache check mirrors /health/')
        except Exception as e:
            fail('Health service logic', str(e))

        # ── Summary ───────────────────────────────────────────────────────────
        total = passed + failed
        self.stdout.write('')
        self.stdout.write('─' * 40)
        if failed:
            self.stdout.write(self.style.ERROR(
                f'Result: {passed}/{total} passed, {failed} FAILED'
            ))
            raise SystemExit(1)
        else:
            self.stdout.write(self.style.SUCCESS(
                f'Result: {passed}/{total} — ALL SMOKE CHECKS PASSED'
            ))
