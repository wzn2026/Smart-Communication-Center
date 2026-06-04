import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Zap, Copy, Check } from 'lucide-react'
import { getQuickReplies, createQuickReply } from '../api'
import { Spinner } from '../components/ui/Spinner'

export function QuickRepliesPage() {
  const [copied, setCopied] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', category: '' })
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['quick-replies'],
    queryFn: getQuickReplies,
  })

  const createMutation = useMutation({
    mutationFn: () => createQuickReply({ ...form, is_active: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quick-replies'] })
      setShowForm(false)
      setForm({ title: '', body: '', category: '' })
    },
  })

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const replies = data?.data.results || []

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الردود السريعة</h1>
          <p className="text-white/50 text-sm mt-1">{replies.length} رد</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={17} />
          إضافة رد
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-6 space-y-4 border border-blue-500/20">
          <h3 className="font-semibold">رد جديد</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">العنوان</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="input-field"
                placeholder="مثال: ترحيب"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">التصنيف</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="input-field"
                placeholder="مثال: عام"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1.5">نص الرد</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={3}
              className="input-field resize-none"
              placeholder="أهلاً وسهلاً..."
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.title || !form.body || createMutation.isPending}
              className="btn-primary"
            >
              حفظ
            </button>
            <button onClick={() => setShowForm(false)} className="btn-ghost">إلغاء</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : replies.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <Zap size={40} className="mx-auto mb-3 opacity-20" />
          لا توجد ردود سريعة بعد.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {replies.map((r) => (
            <div key={r.id} className="glass-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-sm">{r.title}</p>
                  {r.category && (
                    <span className="text-xs text-white/40">{r.category}</span>
                  )}
                </div>
                <button
                  onClick={() => handleCopy(r.body, r.id)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                  title="نسخ"
                >
                  {copied === r.id ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
                </button>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">{r.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
