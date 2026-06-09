import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Phone, Wifi, WifiOff, Clock, Plus, Copy, Check, KeyRound, Trash2, X } from 'lucide-react'
import { getWhatsAppNumbers, createWhatsAppNumber, deleteWhatsAppNumber, updateWhatsAppNumber } from '../api'
import { Spinner } from '../components/ui/Spinner'
import type { WhatsAppNumber } from '../types'

const isDev = window.location.hostname === 'localhost'
const WEBHOOK_BASE = isDev
  ? `http://localhost:8000`
  : `${window.location.protocol}//${window.location.hostname}`

const providerLabels: Record<string, string> = {
  whatsapp_cloud: 'WhatsApp Cloud API',
  '360dialog': '360dialog',
  mock: 'Mock (تطوير)',
}

const emptyForm = {
  display_name: '',
  phone_number: '',
  provider: 'whatsapp_cloud',
  provider_phone_id: '',
  access_token: '',
  status: 'active',
}

export function WhatsAppNumbersPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['whatsapp-numbers'], queryFn: getWhatsAppNumbers })
  const numbers = data?.data.results || []

  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<WhatsAppNumber | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const webhookUrl = `${WEBHOOK_BASE}/api/webhooks/whatsapp/whatsapp_cloud/`

  function openAdd() {
    setEditTarget(null)
    setForm({ ...emptyForm })
    setError('')
    setShowForm(true)
  }

  function openEdit(n: WhatsAppNumber) {
    setEditTarget(n)
    setForm({
      display_name: n.display_name,
      phone_number: n.phone_number,
      provider: n.provider,
      provider_phone_id: n.provider_phone_id || '',
      access_token: '',
      status: n.status,
    })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editTarget) {
        await updateWhatsAppNumber(editTarget.id, form)
      } else {
        await createWhatsAppNumber(form)
      }
      queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] })
      setShowForm(false)
    } catch (err: any) {
      const data = err?.response?.data
      setError(typeof data === 'object' ? Object.values(data).flat().join(' — ') : 'حدث خطأ')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(n: WhatsAppNumber) {
    if (!confirm(`حذف "${n.display_name}"؟`)) return
    await deleteWhatsAppNumber(n.id)
    queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] })
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">أرقام واتساب</h1>
          <p className="text-white/50 text-sm mt-1">اربط أرقام WhatsApp Cloud API — بدون رسوم شهرية</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #2050B8, #0891B2)' }}>
          <Plus size={15} /> إضافة رقم
        </button>
      </div>

      {/* Webhook URL info box */}
      <div className="rounded-xl border p-4"
        style={{ background: 'rgba(34,211,238,0.05)', borderColor: 'rgba(34,211,238,0.2)' }}>
        <p className="text-[#22D3EE] text-xs font-bold mb-2">رابط الـ Webhook — أدخله في Meta Developer Console</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-white/70 text-xs font-mono bg-black/20 px-3 py-2 rounded-lg break-all">
            {webhookUrl}
          </code>
          <button onClick={() => copyText(webhookUrl, 'webhook')}
            className="p-2 rounded-lg text-white/40 hover:text-[#22D3EE] hover:bg-white/5 transition-colors flex-shrink-0">
            {copied === 'webhook' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>
        <p className="text-white/30 text-[11px] mt-2">
          Verify Token: استخدم قيمة <code className="bg-black/20 px-1 rounded">WEBHOOK_SECRET</code> من ملف البيئة
        </p>
        {isDev && (
          <p className="text-yellow-400/60 text-[11px] mt-1">
            ⚠️ بيئة تطوير — Meta تتطلب رابط HTTPS عام. استخدم ngrok أو انشر على سيرفر للاختبار الحقيقي.
          </p>
        )}
      </div>

      {/* Numbers list */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : numbers.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <Phone size={40} className="mx-auto mb-3 opacity-20" />
          <p>لا توجد أرقام مضافة.</p>
          <p className="text-xs mt-1">أضف رقمك الأول للبدء</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {numbers.map((n) => (
            <div key={n.id} className="glass-card p-5 group relative">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-green-600/20 rounded-xl flex items-center justify-center">
                  <Phone size={18} className="text-green-400" />
                </div>
                <div className="flex items-center gap-2">
                  {n.status === 'active' ? (
                    <span className="flex items-center gap-1 text-green-400 text-xs"><Wifi size={12} />نشط</span>
                  ) : n.status === 'pending' ? (
                    <span className="flex items-center gap-1 text-yellow-400 text-xs"><Clock size={12} />معلق</span>
                  ) : (
                    <span className="flex items-center gap-1 text-white/40 text-xs"><WifiOff size={12} />غير نشط</span>
                  )}
                </div>
              </div>

              <h3 className="font-semibold text-white mb-0.5">{n.display_name}</h3>
              <p className="text-white/50 text-sm font-mono mb-3" dir="ltr">{n.phone_number}</p>

              <div className="flex items-center justify-between text-xs">
                <span className="bg-white/10 text-white/60 px-2 py-0.5 rounded-full">
                  {providerLabels[n.provider] ?? n.provider}
                </span>
                <div className="flex items-center gap-1">
                  {n.has_credentials ? (
                    <span className="flex items-center gap-1 text-green-400/70">
                      <KeyRound size={11} /> مرتبط
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-400/70">
                      <KeyRound size={11} /> بدون مفتاح
                    </span>
                  )}
                </div>
              </div>

              {/* Actions on hover */}
              <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button onClick={() => openEdit(n)}
                  className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white hover:bg-white/20 text-xs transition-colors">
                  تعديل
                </button>
                <button onClick={() => handleDelete(n)}
                  className="p-1.5 rounded-lg bg-red-500/10 text-red-400/60 hover:text-red-400 hover:bg-red-500/20 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-2xl border p-6"
            style={{ background: '#0e1c35', borderColor: 'rgba(37,99,235,0.3)' }}>

            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg">
                {editTarget ? 'تعديل الرقم' : 'إضافة رقم واتساب'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              <Field label="اسم العرض" required>
                <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="مثال: دعم العملاء — نداء" required className="form-input" />
              </Field>

              <Field label="رقم الهاتف" required>
                <input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                  placeholder="+966500000001" required dir="ltr" className="form-input" />
              </Field>

              <Field label="المزوّد">
                <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                  className="form-input">
                  <option value="whatsapp_cloud">WhatsApp Cloud API (مجاني)</option>
                  <option value="360dialog">360dialog</option>
                  <option value="mock">Mock — تطوير فقط</option>
                </select>
              </Field>

              {form.provider !== 'mock' && (
                <>
                  <Field label="Phone Number ID" hint="من Meta Developer Console">
                    <input value={form.provider_phone_id}
                      onChange={e => setForm(f => ({ ...f, provider_phone_id: e.target.value }))}
                      placeholder="123456789012345" dir="ltr" className="form-input" />
                  </Field>

                  <Field label={form.provider === 'whatsapp_cloud' ? 'Access Token' : 'API Key'}
                    hint={editTarget ? 'اتركه فارغاً للإبقاء على المفتاح الحالي' : 'يُحفظ مشفّراً ولا يُعرض مجدداً'}>
                    <input value={form.access_token}
                      onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))}
                      type="password" placeholder={editTarget ? '••••••••' : 'EAAxxxxx...'}
                      dir="ltr" className="form-input" />
                  </Field>
                </>
              )}

              <Field label="الحالة">
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="form-input">
                  <option value="active">نشط</option>
                  <option value="pending">معلق</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </Field>

              {error && <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #2050B8, #0891B2)' }}>
                  {saving ? 'جارٍ الحفظ...' : editTarget ? 'حفظ التعديلات' : 'إضافة الرقم'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl text-sm text-white/60 hover:text-white border transition-colors"
                  style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  إلغاء
                </button>
              </div>
            </form>

            {/* Setup guide for Cloud API */}
            {form.provider === 'whatsapp_cloud' && (
              <div className="mt-5 pt-4 border-t text-xs text-white/30 space-y-1"
                style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <p className="font-semibold text-white/50 mb-2">خطوات الإعداد:</p>
                <p>① سجّل على <span className="text-white/60">developers.facebook.com</span></p>
                <p>② أنشئ تطبيق → WhatsApp → أضف رقمك</p>
                <p>③ انسخ Phone Number ID و Access Token</p>
                <p>④ في إعدادات Webhook: أدخل الرابط أعلاه + Verify Token</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-white/60 text-xs font-medium mb-1.5">
        {label}{required && <span className="text-red-400 mr-1">*</span>}
        {hint && <span className="text-white/30 mr-2 font-normal">{hint}</span>}
      </label>
      {children}
    </div>
  )
}
