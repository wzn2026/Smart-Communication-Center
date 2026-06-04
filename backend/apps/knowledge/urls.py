from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import KnowledgeBaseViewSet, KnowledgeItemViewSet, QuickReplyTemplateViewSet

router = DefaultRouter()
router.register('knowledge-bases', KnowledgeBaseViewSet, basename='knowledge-base')
router.register('knowledge-items', KnowledgeItemViewSet, basename='knowledge-item')
router.register('quick-replies', QuickReplyTemplateViewSet, basename='quick-reply')

urlpatterns = [path('', include(router.urls))]
