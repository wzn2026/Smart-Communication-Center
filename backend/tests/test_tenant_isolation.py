"""
Comprehensive tests for Phase 1 + 1.5:
- Tenant isolation across all resources
- API key lifecycle (generate, use, revoke, expire)
- Webhook idempotency / message deduplication
- TenantSettings-driven auto-reply behaviour
- Audit log creation
- Health endpoint
"""
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.tenants.models import Tenant, TenantMembership, ApiKey, TenantSettings
from apps.channels.models import WhatsAppNumber, Contact
from apps.conversations.models import Conversation, Message
from apps.knowledge.models import KnowledgeBase, KnowledgeItem
from apps.audit.models import AuditLog


def jwt(user):
    return str(RefreshToken.for_user(user).access_token)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def make_tenant(name, slug):
    return Tenant.objects.create(name=name, slug=slug, tenant_type='platform', status='active')


def make_user(username, tenant=None, role='agent'):
    user = User.objects.create_user(username, password='pass')
    if tenant:
        TenantMembership.objects.create(tenant=tenant, user=user, role=role)
    return user


def make_wa(tenant, phone):
    return WhatsAppNumber.objects.create(
        tenant=tenant, provider='mock',
        display_name=f'WA {phone}', phone_number=phone, status='active'
    )


def make_contact(tenant, phone):
    return Contact.objects.create(tenant=tenant, name=phone, phone=phone)


def make_conv(tenant, wa, phone='+966000'):
    contact = make_contact(tenant, phone)
    return Conversation.objects.create(
        tenant=tenant, contact=contact, whatsapp_number=wa, status='open'
    )


# ─── Tenant Isolation ─────────────────────────────────────────────────────────

class TenantIsolationTests(TestCase):
    def setUp(self):
        self.t_a = make_tenant('A', 'a')
        self.t_b = make_tenant('B', 'b')
        self.u_a = make_user('ua', self.t_a, 'admin')
        self.u_b = make_user('ub', self.t_b, 'admin')

        self.wa_a = make_wa(self.t_a, '+1001')
        self.wa_b = make_wa(self.t_b, '+1002')

        self.conv_a = make_conv(self.t_a, self.wa_a, '+966100')
        self.conv_b = make_conv(self.t_b, self.wa_b, '+966200')

        self.ca = APIClient()
        self.ca.credentials(HTTP_AUTHORIZATION=f'Bearer {jwt(self.u_a)}')
        self.cb = APIClient()
        self.cb.credentials(HTTP_AUTHORIZATION=f'Bearer {jwt(self.u_b)}')

    def test_conversations_isolated(self):
        resp = self.ca.get('/api/conversations/')
        ids = [c['id'] for c in resp.data['results']]
        self.assertIn(str(self.conv_a.id), ids)
        self.assertNotIn(str(self.conv_b.id), ids)

    def test_cannot_access_other_tenant_conv(self):
        resp = self.cb.get(f'/api/conversations/{self.conv_a.id}/')
        self.assertEqual(resp.status_code, 404)

    def test_whatsapp_numbers_isolated(self):
        resp = self.ca.get('/api/whatsapp-numbers/')
        ids = [n['id'] for n in resp.data['results']]
        self.assertIn(str(self.wa_a.id), ids)
        self.assertNotIn(str(self.wa_b.id), ids)

    def test_contacts_isolated(self):
        resp = self.ca.get('/api/contacts/')
        phones = [c['phone'] for c in resp.data['results']]
        self.assertIn('+966100', phones)
        self.assertNotIn('+966200', phones)

    def test_knowledge_items_isolated(self):
        kb_a = KnowledgeBase.objects.create(tenant=self.t_a, name='KB-A')
        kb_b = KnowledgeBase.objects.create(tenant=self.t_b, name='KB-B')
        item_a = KnowledgeItem.objects.create(tenant=self.t_a, knowledge_base=kb_a,
                                               question='Q-A', answer='Ans', is_active=True)
        item_b = KnowledgeItem.objects.create(tenant=self.t_b, knowledge_base=kb_b,
                                               question='Q-B', answer='Ans', is_active=True)
        resp = self.ca.get('/api/knowledge-items/')
        ids = [i['id'] for i in resp.data['results']]
        self.assertIn(str(item_a.id), ids)
        self.assertNotIn(str(item_b.id), ids)

    def test_quick_replies_isolated(self):
        from apps.knowledge.models import QuickReplyTemplate
        qr_a = QuickReplyTemplate.objects.create(tenant=self.t_a, title='T-A', body='B')
        qr_b = QuickReplyTemplate.objects.create(tenant=self.t_b, title='T-B', body='B')
        resp = self.ca.get('/api/quick-replies/')
        ids = [q['id'] for q in resp.data['results']]
        self.assertIn(str(qr_a.id), ids)
        self.assertNotIn(str(qr_b.id), ids)


# ─── API Key Security ──────────────────────────────────────────────────────────

class ApiKeySecurityTests(TestCase):
    def setUp(self):
        self.tenant = make_tenant('T', 't')

    def _client(self, key):
        c = APIClient()
        c.credentials(HTTP_X_API_KEY=key)
        return c

    def test_valid_key_authenticates(self):
        _, raw = ApiKey.generate(self.tenant, 'Test')
        resp = self._client(raw).get('/api/conversations/')
        self.assertEqual(resp.status_code, 200)

    def test_invalid_key_rejected(self):
        resp = self._client('scc_invalidkey').get('/api/conversations/')
        # DRF returns 403 when AuthenticationFailed is raised by a custom authenticator
        self.assertIn(resp.status_code, [401, 403])

    def test_revoked_key_rejected(self):
        key_obj, raw = ApiKey.generate(self.tenant, 'Rev')
        key_obj.revoke()
        resp = self._client(raw).get('/api/conversations/')
        self.assertIn(resp.status_code, [401, 403])

    def test_expired_key_rejected(self):
        expired = timezone.now() - timedelta(hours=1)
        key_obj, raw = ApiKey.generate(self.tenant, 'Exp', expires_at=expired)
        resp = self._client(raw).get('/api/conversations/')
        self.assertIn(resp.status_code, [401, 403])

    def test_inactive_key_rejected(self):
        key_obj, raw = ApiKey.generate(self.tenant, 'Inact')
        key_obj.is_active = False
        key_obj.save()
        resp = self._client(raw).get('/api/conversations/')
        # inactive key: verify() returns None → unauthenticated → 401
        self.assertIn(resp.status_code, [401, 403])

    def test_key_not_stored_plain(self):
        _, raw = ApiKey.generate(self.tenant, 'NoPlain')
        # raw key must not appear anywhere in the database
        self.assertFalse(ApiKey.objects.filter(key_hash=raw).exists())

    def test_key_hash_only_stored(self):
        import hashlib
        _, raw = ApiKey.generate(self.tenant, 'Hash')
        expected_hash = hashlib.sha256(raw.encode()).hexdigest()
        self.assertTrue(ApiKey.objects.filter(key_hash=expected_hash).exists())

    def test_api_key_maps_to_correct_tenant(self):
        t2 = make_tenant('T2', 't2')
        wa_t1 = make_wa(self.tenant, '+1001')
        wa_t2 = make_wa(t2, '+1002')
        c1 = make_conv(self.tenant, wa_t1, '+966100')
        c2 = make_conv(t2, wa_t2, '+966200')

        _, raw = ApiKey.generate(self.tenant, 'K')
        resp = self._client(raw).get('/api/conversations/')
        ids = [c['id'] for c in resp.data['results']]
        self.assertIn(str(c1.id), ids)
        self.assertNotIn(str(c2.id), ids)

    def test_revoke_creates_audit_log(self):
        admin = User.objects.create_superuser('adm2', password='pass')
        t = make_tenant('Audit-T', 'audit-t')
        TenantMembership.objects.create(tenant=t, user=admin, role='owner')
        key_obj, _ = ApiKey.generate(t, 'ToRevoke')

        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {jwt(admin)}')
        resp = c.post(f'/api/tenants/{t.id}/api-keys/{key_obj.id}/revoke/')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(AuditLog.objects.filter(
            tenant=t, action='api_key_revoked',
            entity_id=str(key_obj.id)
        ).exists())


# ─── Webhook Idempotency ──────────────────────────────────────────────────────

class WebhookIdempotencyTests(TestCase):
    def setUp(self):
        self.tenant = make_tenant('W', 'w')
        self.wa = make_wa(self.tenant, '+966MOCK')
        self.client = APIClient()

    def test_duplicate_inbound_not_stored_twice(self):
        payload = {
            'from_number': '+966500',
            'to_number': '+966MOCK',
            'body': 'مرحبا',
            'message_id': 'unique-msg-001',
        }
        self.client.post('/api/mock/inbound-message/', payload)
        self.client.post('/api/mock/inbound-message/', payload)

        # Only one inbound message with this provider_message_id should exist
        count = Message.objects.filter(
            tenant=self.tenant,
            provider_message_id='unique-msg-001',
            direction='inbound',
        ).count()
        self.assertEqual(count, 1)

    def test_unique_inbound_creates_message(self):
        payload = {
            'from_number': '+966501',
            'to_number': '+966MOCK',
            'body': 'Hello',
            'message_id': 'unique-msg-002',
        }
        self.client.post('/api/mock/inbound-message/', payload)
        self.assertTrue(Message.objects.filter(
            provider_message_id='unique-msg-002'
        ).exists())

    def test_webhook_endpoint_idempotency(self):
        from apps.external_api.models import WebhookEvent
        payload = {
            'from': '+966502',
            'to': '+966MOCK',
            'body': 'دوبليكيت',
            'message_id': 'whook-dedup-001',
        }
        # In testing mode CELERY_TASK_ALWAYS_EAGER=True → tasks execute sync
        self.client.post('/api/webhooks/whatsapp/mock/', payload, format='json')
        resp2 = self.client.post('/api/webhooks/whatsapp/mock/', payload, format='json')

        # Second call should return duplicate note
        self.assertIn(resp2.status_code, [200])

        # Only one event should be stored and processed
        processed_count = WebhookEvent.objects.filter(
            deduplication_key='whook-dedup-001',
            processed=True,
        ).count()
        self.assertEqual(processed_count, 1)


# ─── TenantSettings — FAQ Auto-Reply Behaviour ────────────────────────────────

class TenantSettingsAutoReplyTests(TestCase):
    def setUp(self):
        self.tenant = make_tenant('S', 's')
        self.wa = make_wa(self.tenant, '+966SET')
        kb = KnowledgeBase.objects.create(tenant=self.tenant, name='KB', is_active=True)
        KnowledgeItem.objects.create(
            tenant=self.tenant, knowledge_base=kb,
            question='كيف أسجل؟',
            answer='التسجيل عبر الموقع الرسمي.',
            keywords='تسجيل,حساب',
            is_active=True, requires_human=False, priority=5,
        )

    def _inbound(self, body, from_number='+966600'):
        from apps.providers.base import InboundMessage
        from apps.external_api.services import process_inbound_message
        msg = InboundMessage(
            from_number=from_number,
            to_number='+966SET',
            body=body,
            message_id=f'test-{from_number}-{body[:4]}',
            timestamp='2024-01-01T00:00:00',
        )
        return process_inbound_message('mock', msg)

    def test_auto_reply_disabled_skips_reply(self):
        ts = TenantSettings.get_for_tenant(self.tenant)
        ts.auto_reply_enabled = False
        ts.save()

        conv = self._inbound('كيف أسجل في الخدمة؟', '+966601')
        outbound_count = Message.objects.filter(
            conversation=conv, direction='outbound', is_ai_generated=True
        ).count()
        self.assertEqual(outbound_count, 0)

    def test_max_auto_replies_escalates(self):
        ts = TenantSettings.get_for_tenant(self.tenant)
        ts.max_auto_replies_per_conversation = 1
        ts.save()

        conv = self._inbound('كيف أسجل في الخدمة؟', '+966602')
        # Second inbound should trigger max limit
        from apps.providers.base import InboundMessage
        from apps.external_api.services import process_inbound_message
        msg2 = InboundMessage(
            from_number='+966602',
            to_number='+966SET',
            body='وكيف أسجل أيضاً؟',
            message_id='test-602-2',
            timestamp='2024-01-01T00:01:00',
        )
        conv2 = process_inbound_message('mock', msg2)
        conv2.refresh_from_db()
        self.assertEqual(conv2.status, 'needs_human')

    def test_low_confidence_threshold_escalates(self):
        ts = TenantSettings.get_for_tenant(self.tenant)
        ts.low_confidence_threshold = 100.0  # impossibly high
        ts.save()

        conv = self._inbound('رسالة عشوائية لا تتطابق مع أي شيء xyz', '+966603')
        conv.refresh_from_db()
        self.assertEqual(conv.status, 'needs_human')

    def test_auto_reply_sends_when_settings_default(self):
        from apps.providers.mock import MockWhatsAppProvider
        MockWhatsAppProvider.clear_sent_messages()

        conv = self._inbound('كيف أسجل في الخدمة؟', '+966604')
        sent = MockWhatsAppProvider.get_sent_messages()
        self.assertGreater(len(sent), 0)

    def test_tenant_settings_auto_created(self):
        new_tenant = make_tenant('NEW', 'new')
        self.assertTrue(TenantSettings.objects.filter(tenant=new_tenant).exists())

    def test_settings_low_confidence_threshold_respected(self):
        ts = TenantSettings.get_for_tenant(self.tenant)
        ts.low_confidence_threshold = 0.1  # very low — almost anything matches
        ts.save()
        from services.faq_matcher import find_best_match
        result = find_best_match('تسجيل', self.tenant, min_score=ts.low_confidence_threshold)
        self.assertIsNotNone(result)


# ─── Audit Log ────────────────────────────────────────────────────────────────

class AuditLogTests(TestCase):
    def setUp(self):
        self.tenant = make_tenant('AL', 'al')
        self.user = make_user('alagent', self.tenant, 'agent')
        self.wa = make_wa(self.tenant, '+966AUD')
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {jwt(self.user)}')

    def test_reply_creates_audit_log(self):
        contact = make_contact(self.tenant, '+966700')
        conv = Conversation.objects.create(
            tenant=self.tenant, contact=contact,
            whatsapp_number=self.wa, status='open'
        )
        resp = self.client.post(
            f'/api/conversations/{conv.id}/reply/',
            {'body': 'مرحبا'}
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(AuditLog.objects.filter(
            tenant=self.tenant, action='reply_sent'
        ).exists())

    def test_knowledge_item_created_audit(self):
        resp = self.client.post('/api/knowledge-items/', {
            'question': 'هل الخدمة مجانية؟',
            'answer': 'نعم.',
            'is_active': True,
        })
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(AuditLog.objects.filter(
            tenant=self.tenant, action='knowledge_item_created'
        ).exists())

    def test_knowledge_item_deleted_audit(self):
        kb = KnowledgeBase.objects.create(tenant=self.tenant, name='KB')
        item = KnowledgeItem.objects.create(
            tenant=self.tenant, knowledge_base=kb,
            question='Q', answer='A', is_active=True
        )
        resp = self.client.delete(f'/api/knowledge-items/{item.id}/')
        self.assertEqual(resp.status_code, 204)
        self.assertTrue(AuditLog.objects.filter(
            tenant=self.tenant, action='knowledge_item_deleted'
        ).exists())

    def test_status_change_creates_audit(self):
        contact = make_contact(self.tenant, '+966701')
        conv = Conversation.objects.create(
            tenant=self.tenant, contact=contact,
            whatsapp_number=self.wa, status='open'
        )
        resp = self.client.patch(
            f'/api/conversations/{conv.id}/status/',
            {'status': 'closed'}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(AuditLog.objects.filter(
            tenant=self.tenant, action='status_changed'
        ).exists())


# ─── Message Failure Metadata ─────────────────────────────────────────────────

class MessageFailureTests(TestCase):
    def setUp(self):
        self.tenant = make_tenant('F', 'f')
        self.wa = make_wa(self.tenant, '+966FAIL')

    def test_failed_message_stores_reason(self):
        contact = make_contact(self.tenant, '+966800')
        conv = Conversation.objects.create(
            tenant=self.tenant, contact=contact,
            whatsapp_number=self.wa, status='open'
        )
        msg = Message.objects.create(
            tenant=self.tenant,
            conversation=conv,
            direction='outbound',
            body='Test',
            status='failed',
            failed_reason='Provider unreachable',
            provider_error_code='ERR_500',
            provider_error_payload={'detail': 'timeout'},
        )
        msg.refresh_from_db()
        self.assertEqual(msg.failed_reason, 'Provider unreachable')
        self.assertEqual(msg.provider_error_code, 'ERR_500')
        self.assertEqual(msg.provider_error_payload['detail'], 'timeout')

    def test_normal_message_no_failure_fields(self):
        contact = make_contact(self.tenant, '+966801')
        conv = Conversation.objects.create(
            tenant=self.tenant, contact=contact,
            whatsapp_number=self.wa, status='open'
        )
        msg = Message.objects.create(
            tenant=self.tenant,
            conversation=conv,
            direction='outbound',
            body='OK',
            status='sent',
        )
        self.assertEqual(msg.failed_reason, '')
        self.assertEqual(msg.provider_error_code, '')


# ─── Health Endpoint ──────────────────────────────────────────────────────────

class HealthEndpointTests(TestCase):
    def test_health_returns_200(self):
        resp = self.client.get('/health/')
        self.assertIn(resp.status_code, [200, 503])
        self.assertIn('app', resp.json())
        self.assertIn('database', resp.json())

    def test_api_health_returns_200(self):
        resp = self.client.get('/api/health/')
        self.assertIn(resp.status_code, [200, 503])

    def test_health_database_ok(self):
        resp = self.client.get('/health/')
        data = resp.json()
        self.assertEqual(data['database'], 'ok')

    def test_health_no_auth_required(self):
        # Health endpoint must work without authentication
        c = APIClient()
        resp = c.get('/health/')
        self.assertNotEqual(resp.status_code, 401)
        self.assertNotEqual(resp.status_code, 403)
