from rest_framework import serializers
from .models import KnowledgeBase, KnowledgeItem, QuickReplyTemplate


class KnowledgeBaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeBase
        fields = ['id', 'name', 'description', 'is_active']
        read_only_fields = ['id']


class KnowledgeItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeItem
        fields = [
            'id', 'tenant', 'knowledge_base', 'question', 'answer',
            'category', 'keywords', 'is_active', 'allow_ai_rephrase',
            'requires_human', 'priority', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']


class QuickReplyTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuickReplyTemplate
        fields = ['id', 'tenant', 'title', 'body', 'category', 'is_active']
        read_only_fields = ['id', 'tenant']
