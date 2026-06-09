import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Plus, Pencil, Trash2, X, CheckCircle, XCircle,
  Crown, ChevronDown,
} from 'lucide-react'
import { getTenants, createTenant, updateTenant, deleteTenant } from '../api'
import { Spinner } from '../components/ui/Spinner'
import type { Tenant } from '../types'

const typeOptions = [
  { value: 'platform',    label: 'منصة' },
  { value: 'company',     label: 'شركة' },
  { value: 'family_fund', label: 'صندوق أسرة' },
  { value: 'other',       label: 'أخرى' },
]

const planOptions = [
  { value: 'free',       label: 'مجاني' },
  { value: 'starter',    label: 'ستارتر' },
  { value: 'pro',        label: 'احترافي' },
  { value: 'enterprise', label: 'مؤسسي' },
]

const planStyle: Record<string, string> = {
  free:       'bg-neutral-100 text-neutral-500 border border-neutral-200',
  starter:    'bg-teal-100 text-teal-700 border border-teal-200',
  pro:        'bg-blue-100 text-blue-700 border border-blue-200',
  enterprise: 'bg-amber-100 text-amber-700 border border-amber-200',
}

const typeLabel: Record<string, string> = {
  platform:    'منصة',
  company:     'شركة',
  family_fund: 'صندوق أسرة',
  other:       'أخرى',
}

const emptyForm = { name: '', slug: '', tenant_type: 'company', status: 'active', plan: 'free' }

export function TenantsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['tenants'], queryFn: getTenants })
  const tenants = data?.data.results || []

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Tenant | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openAdd() {
    setEditTarget(null)
    setForm({ ...emptyForm })
    setError('')
    setShowModal(true)
  }

  function openEdit(t: Tenant) {
    setEditTarget(t)
    setForm({ name: t.name, slug: t.slug, tenant_type: t.tenant_type, status: t.status, plan: t.plan })
    setError('')
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      if (editTarget) {
        await updateTenant(editTarget.id, form)
      } else {
        await createTenant(form)
      }
      qc.invalidateQueries({ queryKey: ['tenants'] })
      setShowModal(false)
    } catch (err: any) {
      const d = err?.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' — ') : 'حدث خطأ')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(t: Tenant) {
    if (!confirm(`حذف المستأجر "${t.name}"؟ لا يمكن التراجع.`)) return
    try {
      await deleteTenant(t.id)
      qc.invalidateQueries({ queryKey: ['tenants'] })
    } catch {
      alert('تعذّر الحذف. تأكد أنه لا توجد بيانات مرتبطة.')
    }
  }

  function slugify(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  return (
    <div className="p-8 min-h-full bg-ink-50">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">المستأجرون</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              {isLoading ? '...' : `${tenants.length} مستأجر مسجّل`}
            </p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
            <Plus size={15} /> مستأجر جديد
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : tenants.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-card py-20 text-center text-neutral-400">
            <Building2 size={40} className="mx-auto mb-3 opacity-20" />
            <p>لا يوجد مستأجرون. ابدأ بإضافة أول مستأجر.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
            {tenants.map((t, i) => (
              <div key={t.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-brand-50/40 transition-colors group"
                style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>

                {/* Icon */}
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)' }}>
                  {t.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-neutral-800">{t.name}</span>
                    {t.plan === 'enterprise' && <Crown size={13} className="text-amber-500" />}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${planStyle[t.plan] ?? planStyle.free}`}>
                      {planOptions.find(p => p.value === t.plan)?.label ?? t.plan}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-neutral-400 flex-wrap">
                    <span className="bg-neutral-100 px-2 py-0.5 rounded-full">{typeLabel[t.tenant_type] ?? t.tenant_type}</span>
                    <span dir="ltr" className="font-mono">{t.slug}</span>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-1.5 text-sm flex-shrink-0">
                  {t.status === 'active' ? (
                    <span className="flex items-center gap-1.5 text-green-600 text-xs font-semibold bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                      <CheckCircle size={12} /> نشط
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-red-500 text-xs font-semibold bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                      <XCircle size={12} /> معلق
                    </span>
                  )}
                </div>

                {/* Actions (visible on hover) */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(t)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-brand-600 hover:bg-brand-50 border border-transparent hover:border-brand-200 transition-all">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(t)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden">
            <div className="h-1" style={{ background: 'linear-gradient(90deg,#2563eb,#0891b2)' }} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-neutral-900 text-lg">
                  {editTarget ? 'تعديل المستأجر' : 'مستأجر جديد'}
                </h2>
                <button onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <LabelField label="اسم المستأجر" required>
                  <input value={form.name} required
                    onChange={e => {
                      const name = e.target.value
                      setForm(f => ({ ...f, name, slug: editTarget ? f.slug : slugify(name) }))
                    }}
                    placeholder="مثال: شركة نداء للتقنية"
                    className="input-field" />
                </LabelField>

                <LabelField label="المعرّف (Slug)" hint="حروف إنجليزية وأرقام وشرطات فقط">
                  <input value={form.slug} required dir="ltr"
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                    placeholder="nada-tech"
                    className="input-field" />
                </LabelField>

                <div className="grid grid-cols-2 gap-3">
                  <LabelField label="نوع المستأجر">
                    <div className="relative">
                      <select value={form.tenant_type}
                        onChange={e => setForm(f => ({ ...f, tenant_type: e.target.value }))}
                        className="input-field appearance-none pr-9">
                        {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                    </div>
                  </LabelField>

                  <LabelField label="الباقة">
                    <div className="relative">
                      <select value={form.plan}
                        onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                        className="input-field appearance-none pr-9">
                        {planOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                    </div>
                  </LabelField>
                </div>

                <LabelField label="الحالة">
                  <div className="relative">
                    <select value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="input-field appearance-none pr-9">
                      <option value="active">نشط</option>
                      <option value="suspended">معلق</option>
                    </select>
                    <ChevronDown size={13} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                  </div>
                </LabelField>

                {error && (
                  <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                    ⚠️ {error}
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-110 active:scale-95"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
                    {saving ? 'جارٍ الحفظ...' : editTarget ? 'حفظ التعديلات' : 'إنشاء المستأجر'}
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
    </div>
  )
}

function LabelField({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
        {label}{required && <span className="text-red-500 mr-1">*</span>}
        {hint && <span className="text-neutral-400 mr-2 font-normal">{hint}</span>}
      </label>
      {children}
    </div>
  )
}
