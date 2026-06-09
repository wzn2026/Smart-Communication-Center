export type MemberRole = 'owner' | 'admin' | 'agent' | 'viewer'

export interface UserInfo {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
  is_active: boolean
  date_joined: string
}

export interface TenantMembership {
  id: number
  tenant: string
  user: number
  username: string
  full_name: string
  role: MemberRole
  is_active: boolean
}

export interface MeResponse {
  type: 'user'
  user: UserInfo
  tenants: { tenant: Tenant; role: MemberRole }[]
}

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
  provider_phone_id: string
  status: 'active' | 'inactive' | 'pending'
  has_credentials: boolean
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

export interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  description: string
  price_monthly: string
  price_yearly: string
  currency: string
  max_whatsapp_numbers: number | null
  max_agents: number | null
  max_messages_per_month: number | null
  features: string[]
  is_active: boolean
  is_featured: boolean
  sort_order: number
  created_at: string
  subscriber_count: number
}

export interface Subscription {
  id: string
  tenant: string
  tenant_name: string
  plan: string
  plan_name: string
  plan_slug: string
  plan_price_monthly: string
  status: 'trial' | 'active' | 'expired' | 'cancelled' | 'past_due'
  billing_cycle: 'monthly' | 'yearly'
  start_date: string
  end_date: string | null
  trial_ends_at: string | null
  auto_renew: boolean
  notes: string
  is_currently_active: boolean
  created_at: string
  updated_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
