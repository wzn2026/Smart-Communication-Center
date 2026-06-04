import logging
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.tenants.permissions import TenantIsolationMixin
from .models import Conversation, Message
from .serializers import (
    ConversationListSerializer, ConversationDetailSerializer,
    MessageSerializer, ReplySerializer,
)

logger = logging.getLogger(__name__)


class ConversationViewSet(TenantIsolationMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'category', 'ai_enabled']
    search_fields = ['contact__name', 'contact__phone', 'summary']
    ordering_fields = ['last_message_at', 'created_at']

    def get_queryset(self):
        tenant = self.get_tenant()
        if not tenant:
            return Conversation.objects.none()
        return (
            Conversation.objects
            .filter(tenant=tenant)
            .select_related('contact', 'whatsapp_number', 'assigned_to')
        )

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ConversationDetailSerializer
        return ConversationListSerializer

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        conversation = self.get_object()
        msgs = conversation.messages.all()
        serializer = MessageSerializer(msgs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        conversation = self.get_object()
        serializer = ReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        body = serializer.validated_data['body']
        msg_type = serializer.validated_data['message_type']

        from apps.providers.registry import get_provider
        provider_name = (
            conversation.whatsapp_number.provider
            if conversation.whatsapp_number else 'mock'
        )
        from_number = (
            conversation.whatsapp_number.phone_number
            if conversation.whatsapp_number else ''
        )
        provider = get_provider(provider_name)
        result = provider.send_text_message(
            to=conversation.contact.phone,
            body=body,
            from_number=from_number,
        )

        message = Message.objects.create(
            tenant=conversation.tenant,
            conversation=conversation,
            direction='outbound',
            message_type=msg_type,
            body=body,
            status='sent',
            is_ai_generated=False,
            provider_message_id=result.get('message_id', ''),
        )
        conversation.last_message_at = timezone.now()
        conversation.save(update_fields=['last_message_at', 'updated_at'])

        from apps.audit.models import AuditLog
        AuditLog.objects.create(
            tenant=conversation.tenant,
            user=request.user if getattr(request.user, 'pk', None) else None,
            action='reply_sent',
            entity_type='conversation',
            entity_id=str(conversation.id),
            metadata={'body_preview': body[:100]},
        )

        try:
            from services.realtime import broadcast_message_created, broadcast_conversation_updated
            broadcast_message_created(message)
            broadcast_conversation_updated(conversation)
        except Exception:
            pass

        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'])
    def assign(self, request, pk=None):
        conversation = self.get_object()
        user_id = request.data.get('user_id')
        if user_id:
            from django.contrib.auth.models import User
            try:
                user = User.objects.get(pk=user_id)
                conversation.assigned_to = user
            except User.DoesNotExist:
                return Response({'error': 'User not found'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            conversation.assigned_to = None
        conversation.save(update_fields=['assigned_to', 'updated_at'])
        return Response(ConversationDetailSerializer(conversation).data)

    @action(detail=True, methods=['patch'], url_path='status')
    def set_status(self, request, pk=None):
        conversation = self.get_object()
        new_status = request.data.get('status')
        valid = [s[0] for s in Conversation.STATUS]
        if new_status not in valid:
            return Response(
                {'error': f'Invalid status. Choose from: {valid}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        old_status = conversation.status
        conversation.status = new_status
        conversation.save(update_fields=['status', 'updated_at'])

        from apps.audit.models import AuditLog
        AuditLog.objects.create(
            tenant=conversation.tenant,
            user=request.user if getattr(request.user, 'pk', None) else None,
            action='status_changed',
            entity_type='conversation',
            entity_id=str(conversation.id),
            metadata={'old_status': old_status, 'new_status': new_status},
        )

        try:
            if new_status == 'needs_human':
                from services.realtime import broadcast_conversation_needs_human
                broadcast_conversation_needs_human(conversation)
            else:
                from services.realtime import broadcast_conversation_updated
                broadcast_conversation_updated(conversation)
        except Exception:
            pass

        return Response(ConversationDetailSerializer(conversation).data)
