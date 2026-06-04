import { useQuery } from '@tanstack/react-query'
import {
  MessageSquare, Users, BookOpen, TrendingUp,
  Clock, ArrowLeft, Phone, Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { getConversations, getKnowledgeItems, getWhatsAppNumbers } from '../api'
import { Spinner } from '../components/ui/Spinner'

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  iconBg: string
  iconColor: string
  accent: string   // border-top color
}

function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor, accent }: StatCardProps) {
  return (
    <div className="card p-6 relative overflow-hidden transition-all group"
      style={{ transition: 'box-shadow 0.2s' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
    >
      {/* top accent line */}
      <div className="absolute top-0 right-0 left-0 h-0.5 rounded-t-2xl" style={{ background: accent }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-neutral-900 mt-1.5 tabular-nums">{value}</p>
          {sub && <p className="text-xs text-neutral-400 mt-1">{sub}</p>}
        </div>
        <div className="p-3 rounded-2xl shrink-0" style={{ background: iconBg }}>
          <Icon size={22} className={iconColor} />
        </div>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],   queryFn: () => getConversations(),
  })
  const { data: knowledge } = useQuery({
    queryKey: ['knowledge-items'], queryFn: () => getKnowledgeItems(),
  })
  const { data: waNumbers } = useQuery({
    queryKey: ['whatsapp-numbers'], queryFn: () => getWhatsAppNumbers(),
  })

  const convs      = conversations?.data.results || []
  const total      = conversations?.data.count  || 0
  const open       = convs.filter((c) => c.status === 'open').length
  const needsHuman = convs.filter((c) => c.status === 'needs_human').length
  const kbCount    = knowledge?.data.count || 0

  if (isLoading) return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="label-section">نظرة عامة</p>
          <h1 className="page-title mt-1">لوحة التحكم</h1>
          <p className="page-subtitle">إليك ملخص نشاط المنصة</p>
        </div>
        <Link to="/inbox" className="btn-primary flex items-center gap-2">
          <MessageSquare size={15} />
          صندوق الوارد
        </Link>
      </div>

      {/* ── Stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={MessageSquare} label="إجمالي المحادثات" value={total}      sub="منذ البداية"
          accent="linear-gradient(90deg,#2563EB,#0891B2)"
          iconBg="rgba(37,99,235,0.10)"  iconColor="text-brand-600" />
        <StatCard icon={TrendingUp}   label="مفتوحة الآن"      value={open}       sub="نشطة"
          accent="linear-gradient(90deg,#10B981,#34D399)"
          iconBg="rgba(16,185,129,0.10)" iconColor="text-emerald-600" />
        <StatCard icon={Clock}        label="تحتاج تدخل"       value={needsHuman} sub="بانتظار وكيل"
          accent="linear-gradient(90deg,#F59E0B,#FBBF24)"
          iconBg="rgba(245,158,11,0.10)" iconColor="text-amber-600" />
        <StatCard icon={BookOpen}     label="قاعدة المعرفة"    value={kbCount}    sub="سؤال متاح"
          accent="linear-gradient(90deg,#8B5CF6,#A78BFA)"
          iconBg="rgba(139,92,246,0.10)" iconColor="text-violet-600" />
      </div>

      {/* ── WhatsApp Numbers ──────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="label-section">قنوات التواصل</p>
            <h2 className="font-bold text-neutral-900 mt-1 flex items-center gap-2">
              <Zap size={16} className="text-teal-600" />
              أرقام واتساب النشطة
            </h2>
          </div>
          <Link to="/whatsapp-numbers"
            className="text-brand-600 hover:text-brand-700 text-xs font-semibold flex items-center gap-1">
            إدارة <ArrowLeft size={13} />
          </Link>
        </div>

        {!waNumbers?.data.results.length ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-neutral-100">
              <Phone size={20} className="text-neutral-400" />
            </div>
            <p className="text-neutral-400 text-sm">لا توجد أرقام مفعّلة بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {waNumbers.data.results.map((n) => (
              <div key={n.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${n.status === 'active' ? 'bg-emerald-400' : 'bg-neutral-300'}`} />
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">{n.display_name}</p>
                    <p className="text-xs text-neutral-400">{n.phone_number}</p>
                  </div>
                </div>
                <span className="text-xs text-neutral-500 px-2.5 py-1 rounded-full bg-neutral-100 border border-neutral-200">
                  {n.provider}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Needs Human ───────────────────────────────────────── */}
      {needsHuman > 0 && (
        <div className="card-amber p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="label-section" style={{ color: '#D97706' }}>تحتاج متابعة عاجلة</p>
              <h2 className="font-bold text-neutral-900 mt-1 flex items-center gap-2">
                <Users size={16} className="text-amber-600" />
                محادثات تحتاج تدخل بشري
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-700 border border-amber-300">
                  {needsHuman}
                </span>
              </h2>
            </div>
          </div>
          <div className="space-y-2">
            {convs.filter((c) => c.status === 'needs_human').slice(0, 5).map((c) => (
              <div key={c.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-amber-200">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-800 truncate">{c.contact_name || c.contact_phone}</p>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">{c.last_message?.body}</p>
                </div>
                <Link to={`/inbox?conv=${c.id}`}
                  className="text-brand-600 hover:text-brand-700 text-xs font-semibold flex items-center gap-1 mr-3 shrink-0">
                  فتح <ArrowLeft size={12} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
