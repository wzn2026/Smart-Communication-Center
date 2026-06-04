from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.tenants.permissions import TenantIsolationMixin
from apps.audit.models import AuditLog
from .models import KnowledgeBase, KnowledgeItem, QuickReplyTemplate
from .serializers import (
    KnowledgeBaseSerializer, KnowledgeItemSerializer, QuickReplyTemplateSerializer
)


def _audit(request, tenant, action, entity_type, entity_id, metadata=None):
    user = request.user if getattr(request.user, 'pk', None) else None
    AuditLog.objects.create(
        tenant=tenant, user=user, action=action,
        entity_type=entity_type, entity_id=str(entity_id),
        metadata=metadata or {},
    )


class KnowledgeBaseViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    serializer_class = KnowledgeBaseSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['is_active']

    def get_queryset(self):
        tenant = self.get_tenant()
        if not tenant:
            return KnowledgeBase.objects.none()
        return KnowledgeBase.objects.filter(tenant=tenant)

    def perform_create(self, serializer):
        tenant = self.get_tenant()
        obj = serializer.save(tenant=tenant)
        _audit(self.request, tenant, 'knowledge_base_created', 'knowledge_base', obj.id,
               {'name': obj.name})

    def perform_update(self, serializer):
        obj = serializer.save()
        _audit(self.request, obj.tenant, 'knowledge_base_updated', 'knowledge_base', obj.id)

    def perform_destroy(self, instance):
        _audit(self.request, instance.tenant, 'knowledge_base_deleted',
               'knowledge_base', instance.id, {'name': instance.name})
        instance.delete()


class KnowledgeItemViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    serializer_class = KnowledgeItemSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['is_active', 'category', 'requires_human', 'knowledge_base']
    search_fields = ['question', 'answer', 'keywords']
    ordering_fields = ['priority', 'created_at']

    def get_queryset(self):
        tenant = self.get_tenant()
        if not tenant:
            return KnowledgeItem.objects.none()
        return KnowledgeItem.objects.filter(tenant=tenant)

    def perform_create(self, serializer):
        tenant = self.get_tenant()
        obj = serializer.save(tenant=tenant)
        _audit(self.request, tenant, 'knowledge_item_created', 'knowledge_item', obj.id,
               {'question': obj.question[:80]})

    def perform_update(self, serializer):
        obj = serializer.save()
        _audit(self.request, obj.tenant, 'knowledge_item_updated', 'knowledge_item', obj.id,
               {'question': obj.question[:80]})

    def perform_destroy(self, instance):
        _audit(self.request, instance.tenant, 'knowledge_item_deleted',
               'knowledge_item', instance.id, {'question': instance.question[:80]})
        instance.delete()


class QuickReplyTemplateViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    serializer_class = QuickReplyTemplateSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['is_active', 'category']
    search_fields = ['title', 'body']

    def get_queryset(self):
        tenant = self.get_tenant()
        if not tenant:
            return QuickReplyTemplate.objects.none()
        return QuickReplyTemplate.objects.filter(tenant=tenant)

    def perform_create(self, serializer):
        tenant = self.get_tenant()
        obj = serializer.save(tenant=tenant)
        _audit(self.request, tenant, 'quick_reply_created', 'quick_reply', obj.id,
               {'title': obj.title})

    def perform_update(self, serializer):
        obj = serializer.save()
        _audit(self.request, obj.tenant, 'quick_reply_updated', 'quick_reply', obj.id,
               {'title': obj.title})

    def perform_destroy(self, instance):
        _audit(self.request, instance.tenant, 'quick_reply_deleted',
               'quick_reply', instance.id, {'title': instance.title})
        instance.delete()
