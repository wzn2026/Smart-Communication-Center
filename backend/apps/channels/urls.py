from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WhatsAppNumberViewSet, ContactViewSet
from .broadcast import BroadcastSendView, BroadcastSendOneView

router = DefaultRouter()
router.register('whatsapp-numbers', WhatsAppNumberViewSet, basename='whatsapp-number')
router.register('contacts', ContactViewSet, basename='contact')

urlpatterns = [
    path('', include(router.urls)),
    path('broadcast/send/',     BroadcastSendView.as_view(),    name='broadcast-send'),
    path('broadcast/send-one/', BroadcastSendOneView.as_view(), name='broadcast-send-one'),
]
