import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  MessageSquare, Phone, Brain, Users, BookOpen, Zap,
  BarChart3, Shield, Check, Star, Crown, Sparkles,
  ArrowLeft, Menu, X, ChevronLeft,
} from 'lucide-react'
import { getSubscriptionPlans } from '../api'
import { useAuthStore } from '../store/authStore'
import type { SubscriptionPlan } from '../types'

// ── Plan helpers (same as admin) ─────────────────────────────────────────────
const planIcons: Record<string, React.ElementType> = {
  free: Zap, starter: Sparkles, pro: Star, enterprise: Crown,
}
const planColors: Record<string, { from: string; to: string }> = {
  free:       { from: '#64748b', to: '#94a3b8' },
  starter:    { from: '#0d9488', to: '#0891b2' },
  pro:        { from: '#2563eb', to: '#7c3aed' },
  enterprise: { from: '#d97706', to: '#b45309' },
}

// ─────────────────────────────────────────────────────────────────────────────

function Navbar() {
  const [open, setOpen] = useState(false)
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)' }}>
            <MessageSquare size={17} className="text-white" />
          </div>
          <div className="leading-tight">
            <p className="font-black text-sm text-neutral-900">مركز التواصل</p>
            <p className="text-[10px] font-bold text-brand-500">الذكي</p>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-neutral-500">
          <a href="#features" className="hover:text-neutral-900 transition-colors">المميزات</a>
          <a href="#pricing"  className="hover:text-neutral-900 transition-colors">الباقات</a>
          <a href="#cta"      className="hover:text-neutral-900 transition-colors">تواصل معنا</a>
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link to="/login"
            className="hidden md:block text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors">
            تسجيل الدخول
          </Link>
          <Link to="/login"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 4px 12px rgba(37,99,235,0.35)' }}>
            ابدأ مجاناً <ArrowLeft size={14} />
          </Link>
          {/* Mobile menu button */}
          <button onClick={() => setOpen(!open)} className="md:hidden p-2 rounded-lg text-neutral-500 hover:bg-neutral-100">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-neutral-100 px-6 py-4 space-y-3">
          <a href="#features" onClick={() => setOpen(false)} className="block text-sm font-semibold text-neutral-600 py-2">المميزات</a>
          <a href="#pricing"  onClick={() => setOpen(false)} className="block text-sm font-semibold text-neutral-600 py-2">الباقات</a>
          <Link to="/login" className="block text-sm font-semibold text-neutral-600 py-2">تسجيل الدخول</Link>
        </div>
      )}
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative pt-16 overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0A1628 0%, #112447 60%, #0e2a5c 100%)' }}>

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #2563eb, transparent)' }} />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0891b2, transparent)' }} />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-bold px-4 py-1.5 rounded-full mb-6 border border-white/10">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          واتساب Cloud API — بدون رسوم إضافية
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl font-black text-white mb-5 leading-tight">
          تواصل مع عملائك
          <br />
          <span style={{ backgroundImage: 'linear-gradient(135deg,#22D3EE,#2563eb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            بذكاء حقيقي
          </span>
        </h1>

        <p className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          منصة واتساب متكاملة لإدارة المحادثات، الردود التلقائية بالذكاء الاصطناعي،
          وتنظيم فريق العمل — كل شيء في مكان واحد.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/login"
            className="flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-black text-white transition-all hover:brightness-110 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 8px 32px rgba(37,99,235,0.5)' }}>
            ابدأ تجربتك المجانية <ArrowLeft size={18} />
          </Link>
          <a href="#features"
            className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white/70 hover:text-white transition-all border border-white/15 hover:border-white/30">
            اكتشف المميزات
          </a>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap items-center justify-center gap-8 mt-16 pt-8 border-t border-white/10">
          {[
            { n: '٩٩٪',    label: 'وقت التشغيل' },
            { n: '< ٢ث',  label: 'متوسط وقت الرد' },
            { n: '٢٤/٧',   label: 'دعم فني' },
            { n: '∞',      label: 'محادثة شهرياً' },
          ].map(({ n, label }) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-black text-white">{n}</p>
              <p className="text-white/40 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Wave divider */}
      <div className="h-12 relative -mb-1">
        <svg viewBox="0 0 1440 48" className="absolute bottom-0 w-full" preserveAspectRatio="none">
          <path d="M0,48 C360,0 1080,0 1440,48 L1440,48 L0,48 Z" fill="#F0F5FF" />
        </svg>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Phone,
    color: '#16a34a',
    bg: '#dcfce7',
    title: 'ربط واتساب في دقيقتين',
    desc: 'اربط رقمك عبر WhatsApp Cloud API مجاناً — بدون حاجة لأي وسيط أو رسوم إضافية.',
  },
  {
    icon: Brain,
    color: '#7c3aed',
    bg: '#ede9fe',
    title: 'ردود ذكية بالذكاء الاصطناعي',
    desc: 'المساعد الذكي يجيب على عملائك تلقائياً ٢٤/٧ استناداً إلى قاعدة معرفتك.',
  },
  {
    icon: Users,
    color: '#2563eb',
    bg: '#dbeafe',
    title: 'إدارة الفريق',
    desc: 'وزّع المحادثات على الوكلاء، حدّد الأدوار، وتابع الأداء من لوحة تحكم واحدة.',
  },
  {
    icon: BookOpen,
    color: '#0891b2',
    bg: '#cffafe',
    title: 'قاعدة المعرفة',
    desc: 'ابنِ مكتبة من الأسئلة والأجوبة ليردّ عليها النظام بدقة وباللهجة التي تريدها.',
  },
  {
    icon: Zap,
    color: '#d97706',
    bg: '#fef3c7',
    title: 'ردود سريعة',
    desc: 'قوالب جاهزة يرسلها الوكلاء بضغطة واحدة لتوفير الوقت وتوحيد الأسلوب.',
  },
  {
    icon: Shield,
    color: '#dc2626',
    bg: '#fee2e2',
    title: 'متعدد المشتركين',
    desc: 'أدِر أكثر من شركة أو فريق من حساب واحد مع عزل كامل للبيانات والصلاحيات.',
  },
]

function Features() {
  return (
    <section id="features" className="bg-ink-50 py-24 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-14">
          <span className="text-xs font-black text-brand-600 bg-brand-50 border border-brand-200 px-3 py-1 rounded-full uppercase tracking-wider">
            المميزات
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-neutral-900 mt-4 mb-3">
            كل ما تحتاجه في منصة واحدة
          </h2>
          <p className="text-neutral-500 text-lg max-w-xl mx-auto">
            من ربط الرقم حتى إدارة الفريق — نغطي كل خطوة في رحلة التواصل مع عملائك.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title}
              className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-card hover:shadow-card-md hover:-translate-y-0.5 transition-all group">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ background: bg }}>
                <Icon size={22} style={{ color }} />
              </div>
              <h3 className="font-bold text-neutral-800 text-base mb-2">{title}</h3>
              <p className="text-neutral-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function PlanCard({ plan, yearly }: { plan: SubscriptionPlan; yearly: boolean }) {
  const price = yearly ? parseFloat(plan.price_yearly) : parseFloat(plan.price_monthly)
  const Icon = planIcons[plan.slug] ?? Star
  const colors = planColors[plan.slug] ?? planColors.pro
  const isFree = price === 0

  return (
    <div className={`relative bg-white rounded-3xl border flex flex-col overflow-hidden transition-all hover:-translate-y-1 ${
      plan.is_featured
        ? 'border-brand-300 shadow-[0_8px_32px_rgba(37,99,235,0.2)] ring-2 ring-brand-100'
        : 'border-neutral-200 shadow-card hover:shadow-card-md'
    }`}>
      {plan.is_featured && (
        <div className="flex items-center justify-center gap-1.5 py-2 text-xs font-black text-white"
          style={{ background: `linear-gradient(135deg,${colors.from},${colors.to})` }}>
          <Star size={11} className="fill-white" /> الأكثر شعبية
        </div>
      )}
      {!plan.is_featured && (
        <div className="h-1" style={{ background: `linear-gradient(90deg,${colors.from},${colors.to})` }} />
      )}

      <div className="p-7 flex flex-col flex-1">
        {/* Icon + Name */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg,${colors.from},${colors.to})` }}>
            <Icon size={22} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-black text-neutral-900">{plan.name}</h3>
            {plan.description && <p className="text-xs text-neutral-400 mt-0.5">{plan.description}</p>}
          </div>
        </div>

        {/* Price */}
        <div className="mb-6">
          {isFree ? (
            <span className="text-4xl font-black text-neutral-900">مجاني</span>
          ) : (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-neutral-900">{price.toLocaleString('ar')}</span>
                <span className="text-neutral-400 text-sm">ر.س/{yearly ? 'سنة' : 'شهر'}</span>
              </div>
              {yearly && parseFloat(plan.price_monthly) > 0 && (
                <p className="text-xs text-teal-600 font-semibold mt-1">
                  وفّر {Math.round((1 - parseFloat(plan.price_yearly) / (parseFloat(plan.price_monthly) * 12)) * 100)}٪ مقارنةً بالشهري
                </p>
              )}
            </>
          )}
        </div>

        {/* Limits */}
        <div className="grid grid-cols-3 gap-2 mb-5 p-3 bg-neutral-50 rounded-xl text-center">
          {[
            { v: plan.max_whatsapp_numbers, l: 'واتساب' },
            { v: plan.max_agents,           l: 'وكلاء' },
            { v: plan.max_messages_per_month, l: 'رسائل' },
          ].map(({ v, l }) => (
            <div key={l}>
              <p className={`text-base font-black ${v === null ? 'text-brand-600' : 'text-neutral-800'}`}>
                {v === null ? '∞' : v.toLocaleString('ar')}
              </p>
              <p className="text-[10px] text-neutral-400 mt-0.5">{l}</p>
            </div>
          ))}
        </div>

        {/* Features */}
        <ul className="space-y-2 mb-6 flex-1">
          {plan.features.map(f => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `linear-gradient(135deg,${colors.from},${colors.to})` }}>
                <Check size={11} className="text-white" strokeWidth={3} />
              </div>
              <span className="text-neutral-600">{f}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Link to="/login"
          className="block w-full py-3.5 rounded-2xl text-sm font-black text-center text-white transition-all hover:brightness-110 active:scale-98"
          style={{ background: `linear-gradient(135deg,${colors.from},${colors.to})`, boxShadow: `0 4px 16px ${colors.from}44` }}>
          {isFree ? 'ابدأ مجاناً' : 'اشترك الآن'}
        </Link>
      </div>
    </div>
  )
}

function Pricing() {
  const [yearly, setYearly] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['subscription-plans-public'],
    queryFn: getSubscriptionPlans,
  })
  const plans = (data?.data.results ?? []).filter(p => p.is_active)

  return (
    <section id="pricing" className="bg-white py-24 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-xs font-black text-brand-600 bg-brand-50 border border-brand-200 px-3 py-1 rounded-full uppercase tracking-wider">
            الباقات والأسعار
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-neutral-900 mt-4 mb-3">
            خطط تناسب كل الأحجام
          </h2>
          <p className="text-neutral-500 text-lg max-w-lg mx-auto mb-8">
            من الفريق الناشئ حتى المؤسسة الكبيرة — ادفع فقط على ما تحتاجه.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-1 p-1 bg-neutral-100 rounded-xl">
            <button onClick={() => setYearly(false)}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${!yearly ? 'bg-white shadow text-neutral-800' : 'text-neutral-500'}`}>
              شهري
            </button>
            <button onClick={() => setYearly(true)}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${yearly ? 'bg-white shadow text-neutral-800' : 'text-neutral-500'}`}>
              سنوي
              <span className="text-[10px] bg-teal-500 text-white px-1.5 py-0.5 rounded-full font-black">وفّر ٢٠٪</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <p className="text-center text-neutral-400 py-12">الباقات قيد الإعداد — تواصل معنا للاستفسار.</p>
        ) : (
          <div className={`grid gap-6 ${
            plans.length === 4 ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4' :
            plans.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'
          }`}>
            {plans.map(p => <PlanCard key={p.id} plan={p} yearly={yearly} />)}
          </div>
        )}

        <p className="text-center text-sm text-neutral-400 mt-10">
          جميع الباقات تشمل تشفيراً كاملاً للبيانات · لا عقود طويلة · إلغاء في أي وقت
        </p>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { n: '١', title: 'أنشئ حسابك', desc: 'سجّل في دقيقة واحدة بدون بطاقة ائتمان.' },
    { n: '٢', title: 'اربط رقم واتساب', desc: 'أدخل بيانات Meta Developer Console وابدأ فوراً.' },
    { n: '٣', title: 'أضف فريقك وابدأ', desc: 'دعوة الوكلاء، إعداد الردود الذكية، والانطلاق.' },
  ]
  return (
    <section className="py-24 px-6"
      style={{ background: 'linear-gradient(160deg,#0A1628 0%,#112447 100%)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-black text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-3 py-1 rounded-full uppercase tracking-wider">
            كيف يعمل؟
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-white mt-4">ابدأ في ٣ خطوات</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map(({ n, title, desc }, i) => (
            <div key={n} className="relative text-center">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-0 w-full h-px"
                  style={{ background: 'linear-gradient(90deg,transparent,rgba(34,211,238,0.3),transparent)' }} />
              )}
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 text-2xl font-black text-white relative z-10"
                style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 8px 24px rgba(37,99,235,0.4)' }}>
                {n}
              </div>
              <h3 className="font-black text-white text-lg mb-2">{title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section id="cta" className="bg-ink-50 py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <div className="bg-white rounded-3xl border border-neutral-200 shadow-card p-12 relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none opacity-30"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, #bfdbfe, transparent 70%)' }} />

          <div className="relative">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg"
              style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)' }}>
              <MessageSquare size={28} className="text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-neutral-900 mb-4">
              جاهز للبدء؟
            </h2>
            <p className="text-neutral-500 text-lg mb-8 max-w-lg mx-auto">
              انضم الآن وابدأ تجربتك المجانية — لا حاجة لبطاقة ائتمان.
            </p>
            <Link to="/login"
              className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl text-base font-black text-white transition-all hover:brightness-110 active:scale-95"
              style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 8px 32px rgba(37,99,235,0.4)' }}>
              ابدأ مجاناً الآن <ArrowLeft size={18} />
            </Link>
            <p className="text-neutral-400 text-xs mt-4">بدون عقود · إلغاء في أي وقت</p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ background: '#060e1c' }}>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)' }}>
              <MessageSquare size={15} className="text-white" />
            </div>
            <div>
              <p className="font-black text-sm text-white">مركز التواصل الذكي</p>
              <p className="text-white/30 text-[11px]">Smart Communication Center</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-white/30">
            <a href="#features" className="hover:text-white/60 transition-colors">المميزات</a>
            <a href="#pricing"  className="hover:text-white/60 transition-colors">الباقات</a>
            <Link to="/login"   className="hover:text-white/60 transition-colors">تسجيل الدخول</Link>
          </div>

          <p className="text-white/20 text-xs">
            © {new Date().getFullYear()} مركز التواصل الذكي. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function LandingPage() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen" dir="rtl" style={{ fontFamily: 'inherit' }}>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
