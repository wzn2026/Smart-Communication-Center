"""
Phase 2B tests — WebSocket / Realtime layer

Covers:
  - Tenant isolation: broadcast goes only to the correct group
  - realtime.py: all broadcast helpers fire without raising
  - reply endpoint emits broadcast
  - set_status endpoint emits broadcast (including needs_human)
  - process_inbound_message emits broadcast (via services)
  - WS consumers: DB helpers enforce tenant boundaries
"""
from unittest.mock import patch, MagicMock, AsyncMock
from django.test import TestCase, TransactionTestCase, override_settings
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.tenants.models import Tenant, TenantMembership
from apps.channels.models import WhatsAppNumber, Contact
from apps.conversations.models import Conversation, Message


# ─── Helpers ──────────────────────────────────────────────────────────────────

def jwt(user):
    return str(RefreshToken.for_user(user).access_token)


def make_tenant(name, slug):
    return Tenant.objects.create(name=name, slug=slug, tenant_type='platform', status='active')


def make_wa(tenant, phone):
    return WhatsAppNumber.objects.create(
        tenant=tenant, provider='mock',
        display_name='WA', phone_number=phone, status='active',
    )


def make_user_with_membership(username, tenant):
    user = User.objects.create_user(username=username, password='pass123')
    TenantMembership.objects.create(user=user, tenant=tenant, role='agent', is_active=True)
    return user


def make_conversation(tenant, wa, phone='+966111111111'):
    contact, _ = Contact.objects.get_or_create(
        tenant=tenant, phone=phone,
        defaults={'name': phone, 'source_platform': 'mock'},
    )
    return Conversation.objects.create(
        tenant=tenant, contact=contact,
        whatsapp_number=wa, status='open', category='other', ai_enabled=False,
    )


def _make_mock_layer():
    """Return a MagicMock channel layer whose group_send is an AsyncMock."""
    layer = MagicMock()
    layer.group_send = AsyncMock()
    return layer


def _sent_groups(mock_layer):
    """Return the set of group names that group_send was called with."""
    return {call.args[0] for call in mock_layer.group_send.call_args_list}


# ─── Broadcast helpers ────────────────────────────────────────────────────────

class RealtimeBroadcastTests(TestCase):
    """
    Verify every public broadcast function in services/realtime.py calls
    group_send on the correct channel groups without raising.
    """

    def setUp(self):
        self.tenant = make_tenant('Alpha', 'alpha')
        wa = make_wa(self.tenant, '+966000000001')
        self.conv = make_conversation(self.tenant, wa)
        self.msg = Message.objects.create(
            tenant=self.tenant, conversation=self.conv,
            direction='inbound', message_type='text',
            body='hello', status='delivered',
        )

    def test_broadcast_message_created(self):
        layer = _make_mock_layer()
        with patch('channels.layers.get_channel_layer', return_value=layer):
            from services.realtime import broadcast_message_created
            broadcast_message_created(self.msg)
        groups = _sent_groups(layer)
        self.assertIn('inbox_tenant_alpha', groups)
        self.assertIn(f'conv_{self.conv.id}', groups)

    def test_broadcast_message_status_updated(self):
        layer = _make_mock_layer()
        with patch('channels.layers.get_channel_layer', return_value=layer):
            from services.realtime import broadcast_message_status_updated
            broadcast_message_status_updated(self.msg)
        self.assertIn('inbox_tenant_alpha', _sent_groups(layer))

    def test_broadcast_conversation_created(self):
        layer = _make_mock_layer()
        with patch('channels.layers.get_channel_layer', return_value=layer):
            from services.realtime import broadcast_conversation_created
            broadcast_conversation_created(self.conv)
        self.assertIn('inbox_tenant_alpha', _sent_groups(layer))

    def test_broadcast_conversation_updated(self):
        layer = _make_mock_layer()
        with patch('channels.layers.get_channel_layer', return_value=layer):
            from services.realtime import broadcast_conversation_updated
            broadcast_conversation_updated(self.conv)
        self.assertIn('inbox_tenant_alpha', _sent_groups(layer))

    def test_broadcast_conversation_needs_human(self):
        layer = _make_mock_layer()
        with patch('channels.layers.get_channel_layer', return_value=layer):
            from services.realtime import broadcast_conversation_needs_human
            broadcast_conversation_needs_human(self.conv)
        self.assertIn('inbox_tenant_alpha', _sent_groups(layer))

    def test_broadcast_conversation_assigned(self):
        layer = _make_mock_layer()
        with patch('channels.layers.get_channel_layer', return_value=layer):
            from services.realtime import broadcast_conversation_assigned
            broadcast_conversation_assigned(self.conv)
        self.assertIn('inbox_tenant_alpha', _sent_groups(layer))


# ─── Tenant isolation ─────────────────────────────────────────────────────────

class TenantIsolationBroadcastTests(TestCase):
    """A message in Tenant B must NOT broadcast to Tenant A's group."""

    def setUp(self):
        self.tenant_a = make_tenant('Alpha', 'alpha')
        self.tenant_b = make_tenant('Beta', 'beta')
        wa_b = make_wa(self.tenant_b, '+966000000002')
        self.conv_b = make_conversation(self.tenant_b, wa_b, '+966222222222')
        self.msg_b = Message.objects.create(
            tenant=self.tenant_b, conversation=self.conv_b,
            direction='inbound', message_type='text',
            body='from B', status='delivered',
        )

    def test_message_in_b_does_not_reach_a(self):
        layer = _make_mock_layer()
        with patch('channels.layers.get_channel_layer', return_value=layer):
            from services.realtime import broadcast_message_created
            broadcast_message_created(self.msg_b)
        groups = _sent_groups(layer)
        self.assertNotIn('inbox_tenant_alpha', groups)
        self.assertIn('inbox_tenant_beta', groups)


# ─── API endpoints emit broadcast ─────────────────────────────────────────────

class EndpointBroadcastTests(TestCase):

    def setUp(self):
        self.tenant = make_tenant('Alpha', 'alpha')
        self.wa = make_wa(self.tenant, '+966000000001')
        self.user = make_user_with_membership('agent1', self.tenant)
        self.conv = make_conversation(self.tenant, self.wa)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {jwt(self.user)}')

    def test_reply_endpoint_broadcasts(self):
        layer = _make_mock_layer()
        with patch('channels.layers.get_channel_layer', return_value=layer):
            resp = self.client.post(
                f'/api/conversations/{self.conv.id}/reply/',
                {'body': 'hello from agent'},
                format='json',
            )
        self.assertEqual(resp.status_code, 201)
        self.assertIn('inbox_tenant_alpha', _sent_groups(layer))

    def test_set_status_broadcasts(self):
        layer = _make_mock_layer()
        with patch('channels.layers.get_channel_layer', return_value=layer):
            resp = self.client.patch(
                f'/api/conversations/{self.conv.id}/status/',
                {'status': 'closed'},
                format='json',
            )
        self.assertEqual(resp.status_code, 200)
        self.assertIn('inbox_tenant_alpha', _sent_groups(layer))

    def test_set_status_needs_human_broadcasts(self):
        layer = _make_mock_layer()
        with patch('channels.layers.get_channel_layer', return_value=layer):
            resp = self.client.patch(
                f'/api/conversations/{self.conv.id}/status/',
                {'status': 'needs_human'},
                format='json',
            )
        self.assertEqual(resp.status_code, 200)
        self.assertIn('inbox_tenant_alpha', _sent_groups(layer))


# ─── process_inbound_message emits broadcast ──────────────────────────────────

class InboundPipelineBroadcastTests(TestCase):

    def setUp(self):
        self.tenant = make_tenant('Alpha', 'alpha')
        self.wa = make_wa(self.tenant, '+966000000001')

    def test_new_inbound_broadcasts(self):
        layer = _make_mock_layer()
        with patch('channels.layers.get_channel_layer', return_value=layer):
            from apps.providers.base import InboundMessage
            from apps.external_api.services import process_inbound_message
            inbound = InboundMessage(
                from_number='+966999999999',
                to_number='+966000000001',
                body='hi',
                message_id='msg_new_001',
                timestamp=timezone.now().isoformat(),
            )
            conv = process_inbound_message('mock', inbound)
        self.assertIsNotNone(conv)
        self.assertIn('inbox_tenant_alpha', _sent_groups(layer))

    def test_duplicate_inbound_does_not_double_broadcast(self):
        layer = _make_mock_layer()
        with patch('channels.layers.get_channel_layer', return_value=layer):
            from apps.providers.base import InboundMessage
            from apps.external_api.services import process_inbound_message
            inbound = InboundMessage(
                from_number='+966999999998',
                to_number='+966000000001',
                body='dup',
                message_id='msg_dup_001',
                timestamp=timezone.now().isoformat(),
            )
            process_inbound_message('mock', inbound)
            first_count = layer.group_send.call_count

            # Second call — duplicate, must not broadcast again
            process_inbound_message('mock', inbound)

        self.assertEqual(
            layer.group_send.call_count, first_count,
            "Duplicate inbound must not re-broadcast",
        )


# ─── WS consumer DB helpers ───────────────────────────────────────────────────

class ConsumerAuthTests(TransactionTestCase):
    """
    Test the DB helpers used by WS consumers.
    Uses TransactionTestCase to allow cross-thread DB access (needed for
    database_sync_to_async helpers called via asyncio.run()).
    """

    def setUp(self):
        self.tenant = make_tenant('Alpha', 'alpha')
        self.wa = make_wa(self.tenant, '+966000000001')
        self.user = make_user_with_membership('agent_ws', self.tenant)
        self.conv = make_conversation(self.tenant, self.wa)

    def test_get_tenant_for_user_returns_tenant(self):
        import asyncio
        from apps.ws.consumers import _get_tenant_for_user
        tenant = asyncio.run(_get_tenant_for_user(self.user))
        self.assertIsNotNone(tenant)
        self.assertEqual(tenant.slug, 'alpha')

    def test_get_tenant_for_user_returns_none_for_no_membership(self):
        import asyncio
        from apps.ws.consumers import _get_tenant_for_user
        orphan = User.objects.create_user(username='orphan', password='pass')
        tenant = asyncio.run(_get_tenant_for_user(orphan))
        self.assertIsNone(tenant)

    def test_user_can_access_own_conversation(self):
        import asyncio
        from apps.ws.consumers import _user_can_access_conversation
        can = asyncio.run(_user_can_access_conversation(self.user, str(self.conv.id)))
        self.assertTrue(can)

    def test_user_cannot_access_other_tenant_conversation(self):
        import asyncio
        from apps.ws.consumers import _user_can_access_conversation
        other_tenant = make_tenant('Beta', 'beta')
        other_wa = make_wa(other_tenant, '+966000000002')
        other_conv = make_conversation(other_tenant, other_wa, '+966333333333')
        can = asyncio.run(_user_can_access_conversation(self.user, str(other_conv.id)))
        self.assertFalse(can)
