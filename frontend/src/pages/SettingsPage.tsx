import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Send, Terminal, Key, Plus, Trash2, Eye, EyeOff, ShieldOff, Copy, Check } from 'lucide-react'
import { getMe, sendMockInbound } from '../api'
import api from '../api/client'
import { Spinner } from '../components/ui/Spinner'

// ─── API Key Management ───────────────────────────────────────────────────────

function ApiKeyCard({
  keyData, tenantId, onRevoke,
}: {
  keyData: {
    id: string; name: string; prefix: string; is_active: boolean;
    is_revoked: boolean; is_expired: boolean; is_valid: boolean;
    last_used_at: string | null; expires_at: string | null; created_at: string;
  };
  tenantId: string;
  onRevoke: (keyId: string) => void;
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(keyData.prefix + '...')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`glass-card p-4 ${!keyData.is_valid ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-sm">{keyData.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded">
              {keyData.prefix}...
            </code>
            <button onClick={handleCopy} className="text-white/40 hover:text-white transition-colors">
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {keyData.is_revoked ? (
            <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full border border-red-500/30">مُلغى</span>
          ) : keyData.is_expired ? (
            <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-500/30">منتهي</span>
          ) : (
            <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-500/30">نشط</span>
          )}
          {keyData.is_valid && (
            <button
              onClick={() => onRevoke(keyData.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-300 transition-colors"
              title="إلغاء المفتاح"
            >
              <ShieldOff size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 text-xs text-white/30 space-y-0.5">
        {keyData.last_used_at && (
          <p>آخر استخدام: {new Date(keyData.last_used_at).toLocaleDateString('ar')}</p>
        )}
        {keyData.expires_at && (
          <p>تنتهي: {new Date(keyData.expires_at).toLocaleDateString('ar')}</p>
        )}
        <p>أُنشئ: {new Date(keyData.created_at).toLocaleDateString('ar')}</p>
      </div>
    </div>
  )
}

function ApiKeySection({ tenantId }: { tenantId: string }) {
  const [showGenForm, setShowGenForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const qc = useQueryClient()

  const { data: keysData, isLoading } = useQuery({
    queryKey: ['api-keys', tenantId],
    queryFn: () => api.get(`/tenants/${tenantId}/api_keys/`),
    enabled: !!tenantId,
  })

  const generateMutation = useMutation({
    mutationFn: (name: string) =>
      api.post(`/tenants/${tenantId}/generate_api_key/`, { name }),
    onSuccess: (res) => {
      setNewKeyRaw(res.data.key)
      setNewKeyName('')
      setShowGenForm(false)
      qc.invalidateQueries({ queryKey: ['api-keys', tenantId] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) =>
      api.post(`/tenants/${tenantId}/api-keys/${keyId}/revoke/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys', tenantId] }),
  })

  const keys = keysData?.data || []

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Key size={18} className="text-blue-400" />
          مفاتيح API
        </h2>
        <button
          onClick={() => setShowGenForm(!showGenForm)}
          className="btn-ghost text-sm flex items-center gap-2 py-1.5"
        >
          <Plus size={15} />
          مفتاح جديد
        </button>
      </div>

      {/* New key form */}
      {showGenForm && (
        <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-4 space-y-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="input-field text-sm"
            placeholder="اسم المفتاح (مثال: Nedaa Production)"
          />
          <button
            onClick={() => generateMutation.mutate(newKeyName)}
            disabled={!newKeyName || generateMutation.isPending}
            className="btn-primary text-sm py-2"
          >
            {generateMutation.isPending ? 'جارٍ الإنشاء...' : 'إنشاء'}
          </button>
        </div>
      )}

      {/* Show new key once */}
      {newKeyRaw && (
        <div className="bg-green-600/10 border border-green-500/30 rounded-xl p-4 space-y-2">
          <p className="text-green-300 text-sm font-semibold">✓ تم إنشاء المفتاح — احفظه الآن، لن يُعرض مرة أخرى!</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-black/30 text-green-300 px-3 py-2 rounded-lg font-mono">
              {showRaw ? newKeyRaw : '•'.repeat(30)}
            </code>
            <button onClick={() => setShowRaw(!showRaw)} className="text-white/50 hover:text-white">
              {showRaw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(newKeyRaw); }}
              className="text-white/50 hover:text-white"
            >
              <Copy size={15} />
            </button>
          </div>
          <button
            onClick={() => setNewKeyRaw(null)}
            className="text-white/40 text-xs hover:text-white"
          >
            إخفاء المفتاح
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4"><Spinner /></div>
      ) : keys.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-4">لا توجد مفاتيح بعد.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k: any) => (
            <ApiKeyCard
              key={k.id}
              keyData={k}
              tenantId={tenantId}
              onRevoke={(id) => {
                if (confirm('إلغاء هذا المفتاح؟ لن يمكن التراجع.')) {
                  revokeMutation.mutate(id)
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tenant Settings ──────────────────────────────────────────────────────────

function TenantSettingsSection({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['tenant-settings', tenantId],
    queryFn: () => api.get(`/tenants/${tenantId}/settings/`),
    enabled: !!tenantId,
  })

  const [form, setForm] = useState<Record<string, any>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data?.data) setForm(data.data)
  }, [data])

  const updateMutation = useMutation({
    mutationFn: (values: Record<string, any>) =>
      api.patch(`/tenants/${tenantId}/settings/`, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-settings', tenantId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>

  const set = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }))

  return (
    <div className="glass-card p-6 space-y-5">
      <h2 className="font-semibold flex items-center gap-2">
        <Settings size={18} className="text-purple-400" />
        إعدادات المستأجر
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
          <span className="text-sm">تفعيل الرد التلقائي</span>
          <button
            onClick={() => set('auto_reply_enabled', !form.auto_reply_enabled)}
            className={`w-10 h-5 rounded-full transition-colors relative ${form.auto_reply_enabled ? 'bg-blue-600' : 'bg-white/20'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.auto_reply_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
          <span className="text-sm">تصعيد للإنسان عند عدم اليقين</span>
          <button
            onClick={() => set('human_escalation_enabled', !form.human_escalation_enabled)}
            className={`w-10 h-5 rounded-full transition-colors relative ${form.human_escalation_enabled ? 'bg-blue-600' : 'bg-white/20'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.human_escalation_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-white/60 mb-1.5">
            الحد الأقصى للردود التلقائية / محادثة
          </label>
          <input
            type="number"
            value={form.max_auto_replies_per_conversation ?? 10}
            onChange={(e) => set('max_auto_replies_per_conversation', parseInt(e.target.value))}
            className="input-field"
            min={1}
            max={100}
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">
            حد الثقة الأدنى (low_confidence_threshold)
          </label>
          <input
            type="number"
            value={form.low_confidence_threshold ?? 1.5}
            onChange={(e) => set('low_confidence_threshold', parseFloat(e.target.value))}
            className="input-field"
            step={0.1}
            min={0.1}
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">نبرة الرد</label>
          <select
            value={form.reply_tone ?? 'formal'}
            onChange={(e) => set('reply_tone', e.target.value)}
            className="input-field"
          >
            <option value="formal">رسمي</option>
            <option value="friendly">ودّي</option>
            <option value="neutral">محايد</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">اللغة الافتراضية</label>
          <select
            value={form.default_language ?? 'ar'}
            onChange={(e) => set('default_language', e.target.value)}
            className="input-field"
          >
            <option value="ar">عربي</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <button
        onClick={() => updateMutation.mutate(form)}
        disabled={updateMutation.isPending}
        className="btn-primary flex items-center gap-2"
      >
        {updateMutation.isPending ? (
          <Spinner size="sm" />
        ) : saved ? (
          <Check size={15} className="text-green-300" />
        ) : null}
        {saved ? 'تم الحفظ!' : 'حفظ الإعدادات'}
      </button>
    </div>
  )
}

// ─── Mock Simulator ───────────────────────────────────────────────────────────

function MockSimulator() {
  const [mockFrom, setMockFrom] = useState('+966512345678')
  const [mockTo, setMockTo] = useState('+966500000001')
  const [mockBody, setMockBody] = useState('كيف أسجل في الخدمة؟')
  const [mockResult, setMockResult] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const handleMockSend = async () => {
    setSending(true)
    setMockResult(null)
    try {
      const res = await sendMockInbound(mockFrom, mockTo, mockBody)
      setMockResult(JSON.stringify(res.data, null, 2))
    } catch (e: any) {
      setMockResult('خطأ: ' + (e.response?.data?.error || e.message))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="glass-card p-6 space-y-4">
      <h2 className="font-semibold flex items-center gap-2">
        <Terminal size={18} className="text-green-400" />
        محاكي رسائل واتساب (بيئة التطوير)
      </h2>
      <p className="text-white/40 text-sm">
        أرسل رسالة تجريبية لاختبار الرد التلقائي وتدفق المحادثة.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-white/60 mb-1.5">من (رقم المُرسِل)</label>
          <input type="text" value={mockFrom} onChange={(e) => setMockFrom(e.target.value)}
            className="input-field font-mono text-sm" />
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1.5">إلى (رقم واتساب المستأجر)</label>
          <input type="text" value={mockTo} onChange={(e) => setMockTo(e.target.value)}
            className="input-field font-mono text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-1.5">نص الرسالة</label>
        <textarea value={mockBody} onChange={(e) => setMockBody(e.target.value)}
          rows={2} className="input-field resize-none" />
      </div>

      <button onClick={handleMockSend} disabled={sending}
        className="btn-primary flex items-center gap-2">
        <Send size={15} />
        {sending ? 'جارٍ الإرسال...' : 'إرسال رسالة تجريبية'}
      </button>

      {mockResult && (
        <pre className="bg-black/30 text-green-300 text-xs p-4 rounded-xl overflow-x-auto font-mono">
          {mockResult}
        </pre>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
  })

  const tenantId = meData?.data?.tenants?.[0]?.tenant?.id
    || meData?.data?.tenant?.id
    || null

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings size={22} />
          الإعدادات
        </h1>
      </div>

      {tenantId && (
        <>
          <TenantSettingsSection tenantId={tenantId} />
          <ApiKeySection tenantId={tenantId} />
        </>
      )}

      <MockSimulator />

      {/* API info */}
      <div className="glass-card p-6 space-y-3">
        <h2 className="font-semibold">معلومات API</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/50">نقطة نهاية الـ API</span>
            <code className="text-blue-300 text-xs bg-white/8 px-2 py-0.5 rounded">
              http://localhost:8000/api/
            </code>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">التوثيق التفاعلي</span>
            <a href="http://localhost:8000/api/docs/" target="_blank"
              className="text-blue-400 text-xs hover:underline">فتح Swagger UI</a>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">فحص صحة النظام</span>
            <a href="http://localhost:8000/health/" target="_blank"
              className="text-green-400 text-xs hover:underline">/health/</a>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">المزود الحالي</span>
            <span className="text-green-400 text-xs">Mock (بيئة التطوير)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
