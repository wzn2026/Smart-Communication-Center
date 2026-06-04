from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.tenants.permissions import TenantIsolationMixin
from apps.audit.models import AuditLog
from .models import WhatsAppNumber, Contact
from .serializers import WhatsAppNumberSerializer, ContactSerializer


def _audit(request, tenant, action, entity_type, entity_id, metadata=None):
    user = request.user if getattr(request.user, 'pk', None) else None
    AuditLog.objects.create(
        tenant=tenant, user=user, action=action,
        entity_type=entity_type, entity_id=str(entity_id),
        metadata=metadata or {},
    )


class WhatsAppNumberViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    serializer_class = WhatsAppNumberSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'provider']

    def get_queryset(self):
        tenant = self.get_tenant()
        if not tenant:
            return WhatsAppNumber.objects.none()
        return WhatsAppNumber.objects.filter(tenant=tenant)

    def perform_create(self, serializer):
        tenant = self.get_tenant()
        obj = serializer.save(tenant=tenant)
        _audit(self.request, tenant, 'whatsapp_number_created', 'whatsapp_number', obj.id,
               {'phone': obj.phone_number, 'display_name': obj.display_name})

    def perform_update(self, serializer):
        obj = serializer.save()
        _audit(self.request, obj.tenant, 'whatsapp_number_updated', 'whatsapp_number', obj.id,
               {'phone': obj.phone_number})


class ContactViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name', 'phone', 'email']
    filterset_fields = ['source_platform']

    def get_queryset(self):
        tenant = self.get_tenant()
        if not tenant:
            return Contact.objects.none()
        return Contact.objects.filter(tenant=tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.get_tenant())
