import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Crown, Plus, Pencil, Trash2, X, Star, ToggleLeft, ToggleRight,
  Users, Building2, Calendar, RefreshCw, ChevronDown, CheckCircle,
  XCircle, Clock, AlertCircle, Ban,
} from 'lucide-react'
import {
  getSubscriptionPlans, createSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan,
  getSubscriptions, createSubscription, updateSubscription, deleteSubscription,
  getSubscriptionStats, getTenants,
} from '../api'
import { Spinner } from '../components/ui/Spinner'
import type { SubscriptionPlan, Subscription, Tenant } from '../types'

// ── Helpers ─────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active:    { label: 'نشط',              color: 'bg-green-100 text-green-700 border-green-200',   icon: CheckCircle },
  trial:     { label: 'تجريبي',           color: 'bg-blue-100 text-blue-700 border-blue-200',      icon: Clock },
  expired:   { label: 'منتهي',            color: 'bg-neutral-100 text-neutral-500 border-neutral-200', icon: XCircle },
  cancelled: { label: 'ملغي',             color: 'bg-red-100 text-red-600 border-red-200',         icon: Ban },
  past_due:  { label: 'متأخر السداد',     color: 'bg-amber-100 text-amber-700 border-amber-200',   icon: AlertCircle },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig.expired
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.color}`}>
      <Icon size={11} /> {cfg.label}
    </span>
  )
}

function fmt(n: number | null) { return n === null ? '∞' : n.toLocaleString('ar') }

// ═══════════════════════════════════════════════════════════════════════════
// Plans Tab
// ═══════════════════════════════════════════════════════════════════════════

const emptyPlan = {
  name: '', slug: '', description: '', price_monthly: '0', price_yearly: '0',
  currency: 'SAR', max_whatsapp_numbers: '', max_agents: '', max_messages_per_month: '',
  features: [] as string[], is_active: true, is_featured: false, sort_order: 0,
}

function PlansTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['subscription-plans'], queryFn: getSubscriptionPlans })
  const plans = data?.data.results || []

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<SubscriptionPlan | null>(null)
  const [form, setForm] = useState({ ...emptyPlan })
  const [featureInput, setFeatureInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openAdd() {
    setEditTarget(null)
    setForm({ ...emptyPlan })
    setFeatureInput('')
    setError('')
    setShowModal(true)
  }

  function openEdit(p: SubscriptionPlan) {
    setEditTarget(p)
    setForm({
      name: p.name, slug: p.slug, description: p.description,
      price_monthly: p.price_monthly, price_yearly: p.price_yearly,
      currency: p.currency,
      max_whatsapp_numbers: p.max_whatsapp_numbers === null ? '' : String(p.max_whatsapp_numbers),
      max_agents: p.max_agents === null ? '' : String(p.max_agents),
      max_messages_per_month: p.max_messages_per_month === null ? '' : String(p.max_messages_per_month),
      features: [...p.features],
      is_active: p.is_active, is_featured: p.is_featured, sort_order: p.sort_order,
    })
    setFeatureInput('')
    setError('')
    setShowModal(true)
  }

  function addFeature() {
    const f = featureInput.trim()
    if (f && !form.features.includes(f)) setForm(x => ({ ...x, features: [...x.features, f] }))
    setFeatureInput('')
  }

  function buildPayload() {
    return {
      ...form,
      price_monthly: parseFloat(form.price_monthly) || 0,
      price_yearly:  parseFloat(form.price_yearly)  || 0,
      max_whatsapp_numbers:   form.max_whatsapp_numbers   === '' ? null : parseInt(form.max_whatsapp_numbers),
      max_agents:             form.max_agents             === '' ? null : parseInt(form.max_agents),
      max_messages_per_month: form.max_messages_per_month === '' ? null : parseInt(form.max_messages_per_month),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (editTarget) await updateSubscriptionPlan(editTarget.id, buildPayload())
      else            await createSubscriptionPlan(buildPayload())
      qc.invalidateQueries({ queryKey: ['subscription-plans'] })
      setShowModal(false)
    } catch (err: any) {
      const d = err?.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' — ') : 'حدث خطأ')
    } finally { setSaving(false) }
  }

  async function toggleFeatured(p: SubscriptionPlan) {
    await updateSubscriptionPlan(p.id, { is_featured: !p.is_featured })
    qc.invalidateQueries({ queryKey: ['subscription-plans'] })
  }

  async function toggleActive(p: SubscriptionPlan) {
    await updateSubscriptionPlan(p.id, { is_active: !p.is_active })
    qc.invalidateQueries({ queryKey: ['subscription-plans'] })
  }

  async function handleDelete(p: SubscriptionPlan) {
    if (!confirm(`حذف الباقة "${p.name}"؟ سيؤثر على ${p.subscriber_count} مشترك.`)) return
    try { await deleteSubscriptionPlan(p.id); qc.invalidateQueries({ queryKey: ['subscription-plans'] }) }
    catch { alert('تعذّر الحذف — تأكد أنه لا توجد اشتراكات مرتبطة.') }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500">{plans.length} باقة</p>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
          style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
          <Plus size={14} /> باقة جديدة
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {plans.map(p => (
            <div key={p.id} className={`bg-white rounded-2xl border shadow-card overflow-hidden transition-all hover:shadow-card-md group ${p.is_featured ? 'border-brand-300 ring-2 ring-brand-100' : 'border-neutral-200'}`}>
              {p.is_featured && (
                <div className="h-1.5" style={{ background: 'linear-gradient(90deg,#2563eb,#0891b2)' }} />
              )}
              <div className="p-5">
                {/* Name + badges */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h3 className="font-bold text-neutral-800">{p.name}</h3>
                      {p.is_featured && <Star size={13} className="text-amber-500 fill-amber-400" />}
                    </div>
                    <p className="text-xs text-neutral-400">{p.description}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.is_active ? 'bg-green-100 text-green-600' : 'bg-neutral-100 text-neutral-400'}`}>
                    {p.is_active ? 'نشط' : 'معطّل'}
                  </span>
                </div>

                {/* Price */}
                <div className="mb-4 p-3 bg-neutral-50 rounded-xl">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-neutral-900">{parseFloat(p.price_monthly) === 0 ? 'مجاني' : parseFloat(p.price_monthly).toLocaleString('ar')}</span>
                    {parseFloat(p.price_monthly) > 0 && <span className="text-xs text-neutral-400">{p.currency}/شهر</span>}
                  </div>
                  {parseFloat(p.price_yearly) > 0 && (
                    <p className="text-xs text-teal-600 mt-0.5">{parseFloat(p.price_yearly).toLocaleString('ar')} {p.currency}/سنة</p>
                  )}
                </div>

                {/* Limits */}
                <div className="space-y-1.5 mb-4 text-xs text-neutral-500">
                  <div className="flex justify-between"><span>أرقام واتساب</span><span className="font-semibold text-neutral-700">{fmt(p.max_whatsapp_numbers)}</span></div>
                  <div className="flex justify-between"><span>الوكلاء</span><span className="font-semibold text-neutral-700">{fmt(p.max_agents)}</span></div>
                  <div className="flex justify-between"><span>الرسائل/شهر</span><span className="font-semibold text-neutral-700">{fmt(p.max_messages_per_month)}</span></div>
                </div>

                {/* Subscribers */}
                <div className="flex items-center gap-1.5 text-xs text-brand-600 font-semibold mb-4">
                  <Users size={12} /> {p.subscriber_count} مشترك نشط
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 border-t border-neutral-100 pt-3">
                  <button onClick={() => toggleFeatured(p)} title={p.is_featured ? 'إلغاء التمييز' : 'تمييز'}
                    className={`p-1.5 rounded-lg transition-all ${p.is_featured ? 'text-amber-500 bg-amber-50' : 'text-neutral-300 hover:text-amber-500 hover:bg-amber-50'}`}>
                    <Star size={14} />
                  </button>
                  <button onClick={() => toggleActive(p)} title={p.is_active ? 'تعطيل' : 'تفعيل'}
                    className="p-1.5 rounded-lg text-neutral-300 hover:text-teal-600 hover:bg-teal-50 transition-all">
                    {p.is_active ? <ToggleRight size={16} className="text-teal-500" /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => openEdit(p)}
                    className="p-1.5 rounded-lg text-neutral-300 hover:text-brand-600 hover:bg-brand-50 transition-all">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(p)}
                    className="p-1.5 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all mr-auto">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg bg-white rounded-2xl border border-neutral-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="h-1 sticky top-0" style={{ background: 'linear-gradient(90deg,#2563eb,#0891b2)' }} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-neutral-900 text-lg">{editTarget ? 'تعديل الباقة' : 'باقة جديدة'}</h2>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <MF label="اسم الباقة" required>
                    <input value={form.name} required onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="احترافي" className="input-field" />
                  </MF>
                  <MF label="المعرّف" required>
                    <input value={form.slug} required dir="ltr" onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                      placeholder="pro" className="input-field" />
                  </MF>
                </div>

                <MF label="وصف مختصر">
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="وصف يظهر في صفحة الأسعار" className="input-field" />
                </MF>

                <div className="grid grid-cols-3 gap-3">
                  <MF label="سعر شهري" required>
                    <input value={form.price_monthly} type="number" min="0" step="0.01"
                      onChange={e => setForm(f => ({ ...f, price_monthly: e.target.value }))}
                      className="input-field" dir="ltr" />
                  </MF>
                  <MF label="سعر سنوي">
                    <input value={form.price_yearly} type="number" min="0" step="0.01"
                      onChange={e => setForm(f => ({ ...f, price_yearly: e.target.value }))}
                      className="input-field" dir="ltr" />
                  </MF>
                  <MF label="العملة">
                    <input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                      className="input-field" dir="ltr" />
                  </MF>
                </div>

                <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">الحدود (فارغ = غير محدود)</p>
                <div className="grid grid-cols-3 gap-3">
                  <MF label="أرقام واتساب">
                    <input value={form.max_whatsapp_numbers} type="number" min="0"
                      onChange={e => setForm(f => ({ ...f, max_whatsapp_numbers: e.target.value }))}
                      placeholder="∞" className="input-field" dir="ltr" />
                  </MF>
                  <MF label="الوكلاء">
                    <input value={form.max_agents} type="number" min="0"
                      onChange={e => setForm(f => ({ ...f, max_agents: e.target.value }))}
                      placeholder="∞" className="input-field" dir="ltr" />
                  </MF>
                  <MF label="رسائل/شهر">
                    <input value={form.max_messages_per_month} type="number" min="0"
                      onChange={e => setForm(f => ({ ...f, max_messages_per_month: e.target.value }))}
                      placeholder="∞" className="input-field" dir="ltr" />
                  </MF>
                </div>

                <MF label="المميزات">
                  <div className="flex gap-2 mb-2">
                    <input value={featureInput} onChange={e => setFeatureInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature() } }}
                      placeholder="اكتب ميزة ثم اضغط إضافة..." className="input-field flex-1" />
                    <button type="button" onClick={addFeature}
                      className="px-3 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)' }}>
                      إضافة
                    </button>
                  </div>
                  {form.features.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.features.map(f => (
                        <span key={f} className="flex items-center gap-1 text-xs bg-brand-50 text-brand-700 border border-brand-200 px-2.5 py-1 rounded-full">
                          {f}
                          <button type="button" onClick={() => setForm(x => ({ ...x, features: x.features.filter(i => i !== f) }))}
                            className="text-brand-400 hover:text-red-500 transition-colors">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </MF>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      className="w-4 h-4 accent-brand-600" />
                    <span className="text-neutral-700 font-medium">باقة نشطة</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.is_featured} onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))}
                      className="w-4 h-4 accent-amber-500" />
                    <span className="text-neutral-700 font-medium">الأكثر شعبية</span>
                  </label>
                </div>

                {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">⚠️ {error}</p>}

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
                    {saving ? 'جارٍ الحفظ...' : editTarget ? 'حفظ التعديلات' : 'إنشاء الباقة'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 rounded-xl text-sm text-neutral-600 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 transition-all">
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Subscriptions Tab
// ═══════════════════════════════════════════════════════════════════════════

const emptySubForm = {
  tenant: '', plan: '', status: 'trial', billing_cycle: 'monthly',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: '', trial_ends_at: '', auto_renew: true, notes: '',
}

function SubscriptionsTab() {
  const qc = useQueryClient()
  const { data: subData, isLoading } = useQuery({ queryKey: ['subscriptions'], queryFn: getSubscriptions })
  const { data: planData } = useQuery({ queryKey: ['subscription-plans'], queryFn: getSubscriptionPlans })
  const { data: tenantData } = useQuery({ queryKey: ['tenants'], queryFn: getTenants })
  const { data: statsData } = useQuery({ queryKey: ['subscription-stats'], queryFn: getSubscriptionStats })

  const subs   = subData?.data.results || []
  const plans  = planData?.data.results || []
  const tenants = tenantData?.data.results || []
  const stats  = statsData?.data

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Subscription | null>(null)
  const [form, setForm] = useState({ ...emptySubForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openAdd() {
    setEditTarget(null); setForm({ ...emptySubForm }); setError(''); setShowModal(true)
  }

  function openEdit(s: Subscription) {
    setEditTarget(s)
    setForm({
      tenant: s.tenant, plan: s.plan, status: s.status, billing_cycle: s.billing_cycle,
      start_date: s.start_date,
      end_date: s.end_date ?? '', trial_ends_at: s.trial_ends_at ?? '',
      auto_renew: s.auto_renew, notes: s.notes,
    })
    setError(''); setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const payload = {
      ...form,
      end_date:       form.end_date       || null,
      trial_ends_at:  form.trial_ends_at  || null,
    }
    try {
      if (editTarget) await updateSubscription(editTarget.id, payload)
      else            await createSubscription(payload)
      qc.invalidateQueries({ queryKey: ['subscriptions'] })
      qc.invalidateQueries({ queryKey: ['subscription-stats'] })
      qc.invalidateQueries({ queryKey: ['subscription-plans'] })
      setShowModal(false)
    } catch (err: any) {
      const d = err?.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' — ') : 'حدث خطأ')
    } finally { setSaving(false) }
  }

  async function handleDelete(s: Subscription) {
    if (!confirm(`حذف اشتراك "${s.tenant_name}"؟`)) return
    await deleteSubscription(s.id)
    qc.invalidateQueries({ queryKey: ['subscriptions'] })
    qc.invalidateQueries({ queryKey: ['subscription-stats'] })
  }

  const statCards = [
    { key: 'total',     label: 'الكل',            color: 'text-neutral-700 bg-neutral-50 border-neutral-200' },
    { key: 'active',    label: 'نشط',             color: 'text-green-700 bg-green-50 border-green-200' },
    { key: 'trial',     label: 'تجريبي',          color: 'text-blue-700 bg-blue-50 border-blue-200' },
    { key: 'expired',   label: 'منتهي',           color: 'text-neutral-500 bg-neutral-50 border-neutral-200' },
    { key: 'cancelled', label: 'ملغي',            color: 'text-red-600 bg-red-50 border-red-200' },
    { key: 'past_due',  label: 'متأخر',           color: 'text-amber-700 bg-amber-50 border-amber-200' },
  ]

  return (
    <>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
          {statCards.map(({ key, label, color }) => (
            <div key={key} className={`rounded-xl border px-3 py-3 text-center ${color}`}>
              <p className="text-2xl font-black">{(stats as any)[key] ?? 0}</p>
              <p className="text-xs font-medium mt-0.5 opacity-70">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500">{subs.length} اشتراك</p>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
          style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
          <Plus size={14} /> اشتراك جديد
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : subs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-card py-16 text-center text-neutral-400">
          <Crown size={36} className="mx-auto mb-2 opacity-20" />
          <p>لا توجد اشتراكات</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
          {subs.map((s, i) => (
            <div key={s.id}
              className="flex items-center gap-4 px-5 py-4 hover:bg-brand-50/30 transition-colors group"
              style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>

              {/* Tenant */}
              <div className="flex items-center gap-2.5 w-44 flex-shrink-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)' }}>
                  {s.tenant_name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-800 truncate">{s.tenant_name}</p>
                  <p className="text-xs text-neutral-400">{s.billing_cycle === 'monthly' ? 'شهري' : 'سنوي'}</p>
                </div>
              </div>

              {/* Plan */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-neutral-700">{s.plan_name}</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {parseFloat(s.plan_price_monthly) === 0 ? 'مجاني' : `${parseFloat(s.plan_price_monthly).toLocaleString('ar')} ر.س/شهر`}
                </p>
              </div>

              {/* Status */}
              <StatusBadge status={s.status} />

              {/* Dates */}
              <div className="text-xs text-neutral-400 text-left hidden md:block w-36">
                <div className="flex items-center gap-1"><Calendar size={10} /> {s.start_date}</div>
                {s.end_date && <div className="mt-0.5 text-neutral-300">{s.end_date}</div>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(s)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-brand-600 hover:bg-brand-50 border border-transparent hover:border-brand-200 transition-all">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(s)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subscription Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg bg-white rounded-2xl border border-neutral-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="h-1 sticky top-0" style={{ background: 'linear-gradient(90deg,#2563eb,#0891b2)' }} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-neutral-900 text-lg">{editTarget ? 'تعديل الاشتراك' : 'اشتراك جديد'}</h2>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <MF label="المستأجر" required>
                  <div className="relative">
                    <select value={form.tenant} required onChange={e => setForm(f => ({ ...f, tenant: e.target.value }))}
                      className="input-field appearance-none pr-8" disabled={!!editTarget}>
                      <option value="">-- اختر مستأجراً --</option>
                      {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                  </div>
                </MF>

                <MF label="الباقة" required>
                  <div className="relative">
                    <select value={form.plan} required onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                      className="input-field appearance-none pr-8">
                      <option value="">-- اختر باقة --</option>
                      {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {parseFloat(p.price_monthly) === 0 ? 'مجاني' : `${p.price_monthly} ر.س/شهر`}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                  </div>
                </MF>

                <div className="grid grid-cols-2 gap-3">
                  <MF label="الحالة">
                    <div className="relative">
                      <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                        className="input-field appearance-none pr-8">
                        <option value="trial">تجريبي</option>
                        <option value="active">نشط</option>
                        <option value="expired">منتهي</option>
                        <option value="cancelled">ملغي</option>
                        <option value="past_due">متأخر السداد</option>
                      </select>
                      <ChevronDown size={13} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                    </div>
                  </MF>
                  <MF label="دورة الفوترة">
                    <div className="relative">
                      <select value={form.billing_cycle} onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))}
                        className="input-field appearance-none pr-8">
                        <option value="monthly">شهري</option>
                        <option value="yearly">سنوي</option>
                      </select>
                      <ChevronDown size={13} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                    </div>
                  </MF>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MF label="تاريخ البدء" required>
                    <input value={form.start_date} type="date" required onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="input-field" dir="ltr" />
                  </MF>
                  <MF label="تاريخ الانتهاء">
                    <input value={form.end_date} type="date" onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="input-field" dir="ltr" />
                  </MF>
                </div>

                {form.status === 'trial' && (
                  <MF label="انتهاء التجربة">
                    <input value={form.trial_ends_at} type="date" onChange={e => setForm(f => ({ ...f, trial_ends_at: e.target.value }))} className="input-field" dir="ltr" />
                  </MF>
                )}

                <MF label="ملاحظات">
                  <textarea value={form.notes} rows={2} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="أي ملاحظات إضافية..." className="input-field resize-none" />
                </MF>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.auto_renew} onChange={e => setForm(f => ({ ...f, auto_renew: e.target.checked }))} className="w-4 h-4 accent-brand-600" />
                  <span className="text-neutral-700 font-medium">تجديد تلقائي</span>
                </label>

                {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">⚠️ {error}</p>}

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
                    {saving ? 'جارٍ الحفظ...' : editTarget ? 'حفظ التعديلات' : 'إنشاء الاشتراك'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 rounded-xl text-sm text-neutral-600 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 transition-all">
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════

const tabs = [
  { id: 'plans',         label: 'الباقات',              icon: Crown },
  { id: 'subscriptions', label: 'اشتراكات المستأجرين',  icon: Building2 },
]

export function SubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<'plans' | 'subscriptions'>('plans')
  const qc = useQueryClient()

  return (
    <div className="p-8 min-h-full bg-ink-50">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">إدارة الاشتراكات</h1>
            <p className="text-sm text-neutral-500 mt-0.5">الباقات المتاحة واشتراكات المستأجرين</p>
          </div>
          <button onClick={() => { qc.invalidateQueries({ queryKey: ['subscription-plans'] }); qc.invalidateQueries({ queryKey: ['subscriptions'] }); qc.invalidateQueries({ queryKey: ['subscription-stats'] }) }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-400 hover:text-brand-600 bg-white hover:bg-brand-50 border border-neutral-200 transition-all shadow-card">
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-card p-1 flex gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === id
                  ? 'text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
              }`}
              style={activeTab === id ? { background: 'linear-gradient(135deg,#2563eb,#0891b2)' } : {}}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'plans'         && <PlansTab />}
        {activeTab === 'subscriptions' && <SubscriptionsTab />}
      </div>
    </div>
  )
}

function MF({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
        {label}{required && <span className="text-red-500 mr-1">*</span>}
      </label>
      {children}
    </div>
  )
}
