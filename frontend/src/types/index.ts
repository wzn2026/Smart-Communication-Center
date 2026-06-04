export interface Tenant {
  id: string
  name: string
  slug: string
  tenant_type: 'platform' | 'family_fund' | 'company' | 'other'
  status: 'active' | 'suspended'
  plan: string
  created_at: string
  updated_at: string
}

export interface WhatsAppNumber {
  id: string
  tenant: string
  tenant_name: string
  provider: 'mock' | '360dialog' | 'whatsapp_cloud'
  display_name: string
  phone_number: string
  status: 'active' | 'inactive' | 'pending'
  created_at: string
}

export interface Contact {
  id: string
  tenant: string
  name: string
  phone: string
  email: string
  source_platform: string
  created_at: string
}

export type ConversationStatus = 'open' | 'pending' | 'needs_human' | 'closed'
export type ConversationCategory =
  | 'sales' | 'support' | 'complaint' | 'faq' | 'subscription' | 'other'

export interface ConversationListItem {
  id: string
  status: ConversationStatus
  category: ConversationCategory
  contact_name: string
  contact_phone: string
  assigned_to_name: string | null
  whatsapp_display_name: string | null
  ai_enabled: boolean
  last_message_at: string | null
  last_message: { body: string; direction: string; created_at: string } | null
  created_at: string
  updated_at: string
}

export interface ConversationDetail extends ConversationListItem {
  contact: Contact
  whatsapp_number: string
  assigned_to: number | null
  summary: string
}

export interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  message_type: 'text' | 'template' | 'system'
  body: string
  provider_message_id: string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  is_ai_generated: boolean
  metadata: Record<string, unknown>
  failed_reason: string
  provider_error_code: string
  provider_error_payload: Record<string, unknown>
  created_at: string
}

export interface KnowledgeItem {
  id: string
  tenant: string
  knowledge_base: string | null
  question: string
  answer: string
  category: string
  keywords: string
  is_active: boolean
  allow_ai_rephrase: boolean
  requires_human: boolean
  priority: number
  created_at: string
  updated_at: string
}

export interface QuickReply {
  id: string
  tenant: string
  title: string
  body: string
  category: string
  is_active: boolean
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
