import api from './client'
import type {
  PaginatedResponse, ConversationListItem, ConversationDetail,
  Message, KnowledgeItem, QuickReply, Tenant, WhatsAppNumber,
} from '../types'

// Auth
export const login = (username: string, password: string) =>
  api.post<{ access: string; refresh: string }>('/auth/token/', { username, password })

export const getMe = () => api.get('/me/')

// Tenants
export const getTenants = () => api.get<PaginatedResponse<Tenant>>('/tenants/')

// WhatsApp Numbers
export const getWhatsAppNumbers = () =>
  api.get<PaginatedResponse<WhatsAppNumber>>('/whatsapp-numbers/')

// Conversations
export const getConversations = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<ConversationListItem>>('/conversations/', { params })

export const getConversation = (id: string) =>
  api.get<ConversationDetail>(`/conversations/${id}/`)

export const getMessages = (id: string) =>
  api.get<Message[]>(`/conversations/${id}/messages/`)

export const replyToConversation = (id: string, body: string) =>
  api.post<Message>(`/conversations/${id}/reply/`, { body })

export const assignConversation = (id: string, userId: number | null) =>
  api.patch(`/conversations/${id}/assign/`, { user_id: userId })

export const setConversationStatus = (id: string, status: string) =>
  api.patch(`/conversations/${id}/status/`, { status })

// Knowledge
export const getKnowledgeItems = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<KnowledgeItem>>('/knowledge-items/', { params })

export const createKnowledgeItem = (data: Partial<KnowledgeItem>) =>
  api.post<KnowledgeItem>('/knowledge-items/', data)

export const updateKnowledgeItem = (id: string, data: Partial<KnowledgeItem>) =>
  api.patch<KnowledgeItem>(`/knowledge-items/${id}/`, data)

export const deleteKnowledgeItem = (id: string) =>
  api.delete(`/knowledge-items/${id}/`)

// Quick Replies
export const getQuickReplies = () =>
  api.get<PaginatedResponse<QuickReply>>('/quick-replies/')

export const createQuickReply = (data: Partial<QuickReply>) =>
  api.post<QuickReply>('/quick-replies/', data)

// Mock
export const sendMockInbound = (from: string, to: string, body: string) =>
  api.post('/mock/inbound-message/', { from_number: from, to_number: to, body })
