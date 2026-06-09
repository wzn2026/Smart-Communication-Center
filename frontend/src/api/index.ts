import api from './client'
import type {
  PaginatedResponse, ConversationListItem, ConversationDetail,
  Message, KnowledgeItem, QuickReply, Tenant, WhatsAppNumber, MeResponse, UserInfo,
  SubscriptionPlan, Subscription,
} from '../types'

// Auth
export const login = (username: string, password: string) =>
  api.post<{ access: string; refresh: string }>('/auth/token/', { username, password })

export const getMe = () => api.get<MeResponse>('/me/')

// Tenants
export const getTenants = () => api.get<PaginatedResponse<Tenant>>('/tenants/')
export const createTenant = (data: Partial<Tenant>) => api.post<Tenant>('/tenants/', data)
export const updateTenant = (id: string, data: Partial<Tenant>) => api.patch<Tenant>(`/tenants/${id}/`, data)
export const deleteTenant = (id: string) => api.delete(`/tenants/${id}/`)

// Users
export const getUsers = () => api.get<PaginatedResponse<UserInfo>>('/users/')
export const createUser = (data: Record<string, string | boolean>) => api.post<UserInfo>('/users/', data)
export const updateUser = (id: number, data: Partial<UserInfo>) => api.patch<UserInfo>(`/users/${id}/`, data)
export const deleteUser = (id: number) => api.delete(`/users/${id}/`)
export const setUserPassword = (id: number, password: string) => api.post(`/users/${id}/set-password/`, { password })

// WhatsApp Numbers
export const getWhatsAppNumbers = () =>
  api.get<PaginatedResponse<WhatsAppNumber>>('/whatsapp-numbers/')

export const createWhatsAppNumber = (data: Record<string, string>) =>
  api.post('/whatsapp-numbers/', data)

export const updateWhatsAppNumber = (id: string, data: Record<string, string>) =>
  api.patch(`/whatsapp-numbers/${id}/`, data)

export const deleteWhatsAppNumber = (id: string) =>
  api.delete(`/whatsapp-numbers/${id}/`)

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

// Members
export const getTenantMembers = (tenantId: string) =>
  api.get(`/tenants/${tenantId}/members/`)

export const addTenantMember = (tenantId: string, username: string, role: string) =>
  api.post(`/tenants/${tenantId}/members/add/`, { username, role })

export const updateMemberRole = (tenantId: string, membershipId: number, role: string) =>
  api.patch(`/tenants/${tenantId}/members/${membershipId}/role/`, { role })

export const removeTenantMember = (tenantId: string, membershipId: number) =>
  api.delete(`/tenants/${tenantId}/members/${membershipId}/`)

// Subscription Plans
export const getSubscriptionPlans = () => api.get<PaginatedResponse<SubscriptionPlan>>('/subscription-plans/')
export const createSubscriptionPlan = (data: Partial<SubscriptionPlan>) => api.post<SubscriptionPlan>('/subscription-plans/', data)
export const updateSubscriptionPlan = (id: string, data: Partial<SubscriptionPlan>) => api.patch<SubscriptionPlan>(`/subscription-plans/${id}/`, data)
export const deleteSubscriptionPlan = (id: string) => api.delete(`/subscription-plans/${id}/`)

// Subscriptions
export const getSubscriptions = () => api.get<PaginatedResponse<Subscription>>('/subscriptions/')
export const createSubscription = (data: Partial<Subscription>) => api.post<Subscription>('/subscriptions/', data)
export const updateSubscription = (id: string, data: Partial<Subscription>) => api.patch<Subscription>(`/subscriptions/${id}/`, data)
export const deleteSubscription = (id: string) => api.delete(`/subscriptions/${id}/`)
export const getSubscriptionStats = () => api.get<Record<string, number>>('/subscriptions/stats/')

// Mock
export const sendMockInbound = (from: string, to: string, body: string) =>
  api.post('/mock/inbound-message/', { from_number: from, to_number: to, body })
