import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Star, Zap, Building2, Crown, Sparkles } from 'lucide-react'
import { getSubscriptionPlans } from '../api'
import { Spinner } from '../components/ui/Spinner'
import type { SubscriptionPlan } from '../types'

function fmt(n: number | null, currency = 'ر.س') {
  if (n === null) return 'غير محدود'
  return n.toLocaleString('ar') + (currency ? ' ' + currency : '')
}

const planIcons: Record<string, React.ElementType> = {
  free:       Zap,
  starter:    Sparkles,
  pro:        Star,
  enterprise: Crown,
}

const planColors: Record<string, { from: string; to: string; ring: string; badge: string }> = {
  free:       { from: '#64748b', to: '#94a3b8', ring: '#e2e8f0', badge: 'bg-neutral-100 text-neutral-600' },
  starter:    { from: '#0d9488', to: '#0891b2', ring: '#99f6e4', badge: 'bg-teal-100 text-teal-700' },
  pro:        { from: '#2563eb', to: '#7c3aed', ring: '#bfdbfe', badge: 'bg-blue-100 text-blue-700' },
  enterprise: { from: '#d97706', to: '#b45309', ring: '#fde68a', badge: 'bg-amber-100 text-amber-700' },
}

function PlanCard({ plan, yearly }: { plan: SubscriptionPlan; yearly: boolean }) {
  const price = yearly ? parseFloat(plan.price_yearly) : parseFloat(plan.price_monthly)
  const Icon = planIcons[plan.slug] ?? Star
  const colors = planColors[plan.slug] ?? planColors.pro
  const isFeatured = plan.is_featured
  const isFree = price === 0

  return (
    <div className={`relative bg-white rounded-3xl border overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 ${
      isFeatured
        ? 'border-brand-300 shadow-[0_8px_32px_rgba(37,99,235,0.18)] ring-2 ring-brand-100'
        : 'border-neutral-200 shadow-card hover:shadow-card-md'
    }`}>
      {/* Featured banner */}
      {isFeatured && (
        <div className="flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white"
          style={{ background: `linear-gradient(135deg,${colors.from},${colors.to})` }}>
          <Star size={12} className="fill-white" /> الأكثر شعبية
        </div>
      )}

      {/* Top gradient bar (non-featured) */}
      {!isFeatured && (
        <div className="h-1" style={{ background: `linear-gradient(90deg,${colors.from},${colors.to})` }} />
      )}

      <div className="p-7 flex flex-col flex-1">
        {/* Icon + Name */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
            style={{ background: `linear-gradient(135deg,${colors.from},${colors.to})` }}>
            <Icon size={22} className="text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black text-neutral-900">{plan.name}</h3>
            {plan.description && <p className="text-xs text-neutral-500 mt-0.5">{plan.description}</p>}
          </div>
        </div>

        {/* Price */}
        <div className="mb-6">
          {isFree ? (
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-neutral-900">مجاني</span>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-black text-neutral-900">
                  {price.toLocaleString('ar')}
                </span>
                <span className="text-neutral-400 text-sm font-medium">ر.س</span>
                <span className="text-neutral-400 text-sm">/{yearly ? 'سنة' : 'شهر'}</span>
              </div>
              {yearly && parseFloat(plan.price_monthly) > 0 && (
                <p className="text-sm text-teal-600 font-semibold mt-1">
                  وفّر {Math.round((1 - parseFloat(plan.price_yearly) / (parseFloat(plan.price_monthly) * 12)) * 100)}% مقارنةً بالشهري
                </p>
              )}
              {!yearly && (
                <p className="text-xs text-neutral-400 mt-1">
                  أو {parseFloat(plan.price_yearly).toLocaleString('ar')} ر.س/سنة
                </p>
              )}
            </>
          )}
        </div>

        {/* Limits */}
        <div className="grid grid-cols-3 gap-2 mb-6 p-4 bg-neutral-50 rounded-2xl">
          {[
            { label: 'أرقام واتساب', value: plan.max_whatsapp_numbers },
            { label: 'الوكلاء',      value: plan.max_agents },
            { label: 'رسائل/شهر',   value: plan.max_messages_per_month, currency: '' },
          ].map(({ label, value, currency }) => (
            <div key={label} className="text-center">
              <p className={`text-lg font-black ${value === null ? 'text-brand-600' : 'text-neutral-800'}`}>
                {value === null ? '∞' : value.toLocaleString('ar')}
              </p>
              <p className="text-[10px] text-neutral-400 mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* Features */}
        <ul className="space-y-2.5 mb-7 flex-1">
          {plan.features.map(feature => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `linear-gradient(135deg,${colors.from},${colors.to})` }}>
                <Check size={11} className="text-white" strokeWidth={3} />
              </div>
              <span className="text-neutral-700">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-all hover:brightness-110 active:scale-98 ${
            isFeatured ? 'text-white shadow-lg' : 'text-white'
          }`}
          style={{
            background: `linear-gradient(135deg,${colors.from},${colors.to})`,
            boxShadow: isFeatured ? `0 8px 24px ${colors.ring}` : `0 4px 12px ${colors.ring}`,
          }}>
          {isFree ? 'ابدأ مجاناً' : 'اشترك الآن'}
        </button>
      </div>
    </div>
  )
}

export function PricingPage() {
  const [yearly, setYearly] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['subscription-plans'], queryFn: getSubscriptionPlans })
  const plans = (data?.data.results || []).filter(p => p.is_active)

  return (
    <div className="min-h-full bg-ink-50">

      {/* Hero */}
      <div className="hero-banner mx-8 mt-8 rounded-3xl text-center py-12 px-6">
        <div className="inline-flex items-center gap-2 bg-white/15 text-white/90 text-xs font-bold px-4 py-1.5 rounded-full mb-4">
          <Building2 size={13} /> الباقات والأسعار
        </div>
        <h1 className="text-4xl font-black text-white mb-3">ابدأ بالتواصل الذكي</h1>
        <p className="text-white/60 text-lg max-w-lg mx-auto">
          خطط مرنة تناسب كل الأحجام — من الناشئ حتى المؤسسة
        </p>

        {/* Toggle */}
        <div className="inline-flex items-center gap-3 mt-8 bg-white/10 p-1 rounded-2xl">
          <button onClick={() => setYearly(false)}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${!yearly ? 'bg-white text-neutral-800 shadow' : 'text-white/70 hover:text-white'}`}>
            شهري
          </button>
          <button onClick={() => setYearly(true)}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${yearly ? 'bg-white text-neutral-800 shadow' : 'text-white/70 hover:text-white'}`}>
            سنوي
            <span className="text-xs bg-teal-500 text-white px-2 py-0.5 rounded-full font-bold">وفّر 20%</span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="px-8 py-10">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <div className={`grid gap-6 max-w-6xl mx-auto ${
            plans.length === 4 ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4' :
            plans.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
            'grid-cols-1 md:grid-cols-2'
          }`}>
            {plans.map(plan => <PlanCard key={plan.id} plan={plan} yearly={yearly} />)}
          </div>
        )}

        {/* FAQ note */}
        <div className="text-center mt-12 text-sm text-neutral-400 space-y-1">
          <p>جميع الباقات تشمل دعماً فنياً وتشفيراً كاملاً للبيانات.</p>
          <p>للاستفسار والتخصيص تواصل معنا عبر واتساب أو البريد الإلكتروني.</p>
        </div>
      </div>
    </div>
  )
}
