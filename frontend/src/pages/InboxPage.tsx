import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Send, User, Bot, Search,
  X, Zap, MessageSquare, Wifi, WifiOff,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  getConversations, getConversation, getMessages,
  replyToConversation, setConversationStatus, getQuickReplies,
} from '../api'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Spinner } from '../components/ui/Spinner'
import { useInboxSocket } from '../hooks/useInboxSocket'
import type { ConversationListItem, ConversationStatus } from '../types'

const statusLabels: Record<string, string> = {
  all:         'الكل',
  open:        'مفتوحة',
  pending:     'بانتظار العميل',
  needs_human: 'تحتاج تدخل',
  closed:      'مغلقة',
}

function ConversationItem({
  conv, isActive, onClick
}: {
  conv: ConversationListItem; isActive: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-right p-4 rounded-xl transition-all border',
        isActive
          ? 'bg-brand-50 border-brand-200 shadow-sm'
          : 'bg-white border-transparent hover:bg-ink-50 hover:border-ink-200'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className={clsx('font-medium text-sm truncate', isActive ? 'text-brand-800' : 'text-neutral-800')}>
          {conv.contact_name || conv.contact_phone}
        </span>
        <StatusBadge status={conv.status} className="shrink-0 text-xs" />
      </div>
      {conv.last_message && (
        <p className="text-neutral-400 text-xs truncate">{conv.last_message.body}</p>
      )}
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-neutral-400 text-xs">{conv.whatsapp_display_name}</span>
      </div>
    </button>
  )
}

export function InboxPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeId, setActiveId] = useState<string | null>(searchParams.get('conv'))
  const [reply, setReply] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { connected } = useInboxSocket()

  const { data: convsData, isLoading } = useQuery({
    queryKey: ['conversations', statusFilter],
    queryFn: () => getConversations(statusFilter !== 'all' ? { status: statusFilter } : undefined),
    refetchInterval: connected ? 60_000 : 10_000,
  })

  const { data: convDetail } = useQuery({
    queryKey: ['conversation', activeId],
    queryFn: () => getConversation(activeId!),
    enabled: !!activeId,
  })

  const { data: messagesData } = useQuery({
    queryKey: ['messages', activeId],
    queryFn: () => getMessages(activeId!),
    enabled: !!activeId,
    refetchInterval: connected ? 60_000 : 5_000,
  })

  const { data: quickRepliesData } = useQuery({
    queryKey: ['quick-replies'],
    queryFn: getQuickReplies,
  })

  const replyMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => replyToConversation(id, body),
    onSuccess: () => {
      setReply('')
      qc.invalidateQueries({ queryKey: ['messages', activeId] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => setConversationStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['conversation', activeId] })
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messagesData?.data])

  const conversations = convsData?.data.results || []
  const messages = messagesData?.data || []
  const quickReplies = quickRepliesData?.data.results || []

  const handleSend = () => {
    if (!reply.trim() || !activeId) return
    replyMutation.mutate({ id: activeId, body: reply })
  }

  return (
    <div className="flex h-screen bg-neutral-50">

      {/* ── Conversation List ──────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 flex flex-col border-l border-neutral-200 bg-white">

        {/* Header */}
        <div className="p-4 border-b border-neutral-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-neutral-900 text-sm">المحادثات</h2>
            <span
              className={clsx(
                'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border',
                connected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-neutral-100 text-neutral-400 border-neutral-200'
              )}
              title={connected ? 'تحديثات فورية عبر WebSocket' : 'جاري الاتصال...'}
            >
              {connected ? <Wifi size={10} /> : <WifiOff size={10} />}
              {connected ? 'مباشر' : 'جاري الاتصال...'}
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="بحث في المحادثات..."
              className="input-field pr-9 text-sm py-2"
            />
          </div>

          {/* Status filters */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {Object.entries(statusLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={clsx(
                  'shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                  statusFilter === key
                    ? 'bg-brand-600 text-white'
                    : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare size={32} className="text-neutral-300 mx-auto mb-2" />
              <p className="text-neutral-400 text-sm">لا توجد محادثات</p>
            </div>
          ) : (
            conversations.map((c) => (
              <ConversationItem
                key={c.id}
                conv={c}
                isActive={c.id === activeId}
                onClick={() => {
                  setActiveId(c.id)
                  setSearchParams({ conv: c.id })
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Message Thread ─────────────────────────────────────────── */}
      {activeId ? (
        <div className="flex-1 flex flex-col">

          {/* Thread header */}
          <div className="px-6 py-4 border-b border-neutral-200 bg-white flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-neutral-900">
                {convDetail?.data.contact.name || convDetail?.data.contact.phone}
              </h2>
              <p className="text-neutral-400 text-xs">{convDetail?.data.contact.phone}</p>
            </div>
            <div className="flex items-center gap-2">
              {convDetail && <StatusBadge status={convDetail.data.status} />}
              <select
                value={convDetail?.data.status || ''}
                onChange={(e) => activeId && statusMutation.mutate({ id: activeId, status: e.target.value })}
                className="bg-white border border-neutral-200 text-neutral-700 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-500"
              >
                <option value="open">مفتوحة</option>
                <option value="pending">بانتظار العميل</option>
                <option value="needs_human">تحتاج تدخل</option>
                <option value="closed">مغلقة</option>
              </select>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50">
            {messages.map((msg) => {
              const isFailed = msg.status === 'failed'
              const isOut = msg.direction === 'outbound'
              return (
                <div
                  key={msg.id}
                  className={clsx('flex gap-2.5 max-w-lg', isOut ? 'mr-auto flex-row-reverse' : '')}
                >
                  <div className={clsx(
                    'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 border',
                    isFailed
                      ? 'bg-red-50 border-red-200 text-red-500'
                      : isOut
                        ? 'bg-brand-50 border-brand-200 text-brand-600'
                        : 'bg-white border-neutral-200 text-neutral-500'
                  )}>
                    {msg.is_ai_generated ? <Bot size={13} /> : <User size={13} />}
                  </div>

                  <div>
                    <div className={clsx(
                      'px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm',
                      isFailed
                        ? 'bg-red-50 text-red-700 border border-red-200 rounded-tr-sm'
                        : isOut
                          ? 'bg-brand-600 text-white rounded-tr-sm'
                          : 'bg-white text-neutral-800 border border-neutral-200 rounded-tl-sm'
                    )}>
                      {msg.body}
                    </div>
                    <p className="text-neutral-400 text-xs mt-1 px-1 flex items-center gap-2">
                      <span>
                        {new Date(msg.created_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.is_ai_generated && (
                        <span className="text-brand-500">· ذكاء اصطناعي</span>
                      )}
                      {isFailed && (
                        <span className="text-red-500" title={msg.failed_reason}>
                          · فشل الإرسال
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply box */}
          <div className="p-4 border-t border-neutral-200 bg-white">
            {showQuickReplies && (
              <div className="mb-3 bg-neutral-50 border border-neutral-200 rounded-xl p-3 space-y-1 max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-neutral-600">ردود سريعة</span>
                  <button onClick={() => setShowQuickReplies(false)} className="text-neutral-400 hover:text-neutral-600">
                    <X size={14} />
                  </button>
                </div>
                {quickReplies.filter((q) => q.is_active).map((qr) => (
                  <button
                    key={qr.id}
                    onClick={() => { setReply(qr.body); setShowQuickReplies(false) }}
                    className="w-full text-right px-3 py-2 rounded-lg bg-white border border-neutral-200 hover:border-brand-300 hover:bg-brand-50 text-sm transition-colors"
                  >
                    <span className="text-neutral-500 text-xs block mb-0.5">{qr.title}</span>
                    <span className="text-neutral-700 text-xs line-clamp-1">{qr.body}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <button
                onClick={() => setShowQuickReplies(!showQuickReplies)}
                className={clsx(
                  'p-2.5 rounded-xl border transition-colors shrink-0',
                  showQuickReplies
                    ? 'bg-brand-50 border-brand-200 text-brand-600'
                    : 'bg-neutral-100 border-neutral-200 text-neutral-500 hover:bg-neutral-200'
                )}
                title="ردود سريعة"
              >
                <Zap size={16} />
              </button>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="اكتب ردك هنا..."
                rows={2}
                className="input-field flex-1 resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
              <button
                onClick={handleSend}
                disabled={!reply.trim() || replyMutation.isPending}
                className="btn-primary p-2.5 shrink-0"
              >
                {replyMutation.isPending ? <Spinner size="sm" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-neutral-50">
          <div className="text-center">
            <div className="w-16 h-16 bg-white border-2 border-neutral-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <MessageSquare size={28} className="text-neutral-400" />
            </div>
            <p className="text-neutral-500 font-medium">اختر محادثة للبدء</p>
            <p className="text-neutral-400 text-sm mt-1">
              {conversations.length > 0 ? `${conversations.length} محادثة متاحة` : 'لا توجد محادثات بعد'}
            </p>
          </div>
        </div>
      )}

      {/* ── Contact details panel ──────────────────────────────────── */}
      {activeId && convDetail && (
        <div className="w-72 flex-shrink-0 border-r border-neutral-200 bg-white p-5 space-y-6 overflow-y-auto">
          <div>
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-3">
              بيانات المتواصل
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center">
                <User size={18} className="text-brand-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-neutral-900">
                  {convDetail.data.contact.name || 'بدون اسم'}
                </p>
                <p className="text-neutral-400 text-xs">{convDetail.data.contact.phone}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-3">
              تفاصيل المحادثة
            </p>
            <div className="space-y-3">
              {[
                { label: 'الحالة', value: <StatusBadge status={convDetail.data.status} /> },
                { label: 'التصنيف', value: convDetail.data.category },
                {
                  label: 'الذكاء الاصطناعي',
                  value: (
                    <span className={clsx(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      convDetail.data.ai_enabled
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-neutral-100 text-neutral-500'
                    )}>
                      {convDetail.data.ai_enabled ? 'مفعّل' : 'معطّل'}
                    </span>
                  )
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">{label}</span>
                  <span className="text-xs text-neutral-800">{value}</span>
                </div>
              ))}
              {convDetail.data.assigned_to_name && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">المُسنَد إلى</span>
                  <span className="text-xs text-neutral-800">{convDetail.data.assigned_to_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
