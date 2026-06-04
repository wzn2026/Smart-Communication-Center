import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Search, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react'
import { getKnowledgeItems, createKnowledgeItem, updateKnowledgeItem, deleteKnowledgeItem } from '../api'
import { Spinner } from '../components/ui/Spinner'
import type { KnowledgeItem } from '../types'

const emptyItem: Partial<KnowledgeItem> = {
  question: '',
  answer: '',
  category: '',
  keywords: '',
  is_active: true,
  requires_human: false,
  allow_ai_rephrase: false,
  priority: 0,
}

function Modal({
  item, onSave, onClose, loading
}: {
  item: Partial<KnowledgeItem>
  onSave: (data: Partial<KnowledgeItem>) => void
  onClose: () => void
  loading: boolean
}) {
  const [form, setForm] = useState<Partial<KnowledgeItem>>(item)
  const set = (field: keyof KnowledgeItem, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }))

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-2xl p-8 space-y-5 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold">{item.id ? 'تعديل عنصر المعرفة' : 'إضافة عنصر جديد'}</h2>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">السؤال *</label>
          <textarea
            value={form.question || ''}
            onChange={(e) => set('question', e.target.value)}
            rows={2}
            className="input-field resize-none"
            placeholder="اكتب السؤال..."
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">الإجابة المعتمدة *</label>
          <textarea
            value={form.answer || ''}
            onChange={(e) => set('answer', e.target.value)}
            rows={4}
            className="input-field resize-none"
            placeholder="اكتب الإجابة الكاملة..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-1.5">التصنيف</label>
            <input
              type="text"
              value={form.category || ''}
              onChange={(e) => set('category', e.target.value)}
              className="input-field"
              placeholder="مثال: تسجيل، دعم..."
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1.5">الأولوية</label>
            <input
              type="number"
              value={form.priority ?? 0}
              onChange={(e) => set('priority', parseInt(e.target.value))}
              className="input-field"
              min={0}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">الكلمات المفتاحية (مفصولة بفاصلة)</label>
          <input
            type="text"
            value={form.keywords || ''}
            onChange={(e) => set('keywords', e.target.value)}
            className="input-field"
            placeholder="تسجيل, حساب, اشتراك"
          />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active ?? true}
              onChange={(e) => set('is_active', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">مفعّل</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.requires_human ?? false}
              onChange={(e) => set('requires_human', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-red-300">يتطلب تدخل بشري</span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => onSave(form)}
            disabled={loading || !form.question || !form.answer}
            className="btn-primary flex-1"
          >
            {loading ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
          <button onClick={onClose} className="btn-ghost flex-1">إلغاء</button>
        </div>
      </div>
    </div>
  )
}

export function KnowledgePage() {
  const [search, setSearch] = useState('')
  const [editItem, setEditItem] = useState<Partial<KnowledgeItem> | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['knowledge-items', search],
    queryFn: () => getKnowledgeItems(search ? { search } : undefined),
  })

  const createMutation = useMutation({
    mutationFn: createKnowledgeItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge-items'] }); setEditItem(null) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KnowledgeItem> }) =>
      updateKnowledgeItem(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge-items'] }); setEditItem(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteKnowledgeItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-items'] }),
  })

  const handleSave = (form: Partial<KnowledgeItem>) => {
    if (form.id) {
      updateMutation.mutate({ id: form.id, data: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const items = data?.data.results || []

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">قاعدة المعرفة</h1>
          <p className="text-white/50 text-sm mt-1">{data?.data.count || 0} عنصر</p>
        </div>
        <button onClick={() => setEditItem(emptyItem)} className="btn-primary flex items-center gap-2">
          <Plus size={17} />
          إضافة سؤال
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="بحث في الأسئلة والإجابات..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pr-11"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-white/30">لا توجد عناصر بعد.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="glass-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {item.requires_human && (
                      <span className="flex items-center gap-1 text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">
                        <AlertCircle size={11} /> تدخل بشري
                      </span>
                    )}
                    {item.category && (
                      <span className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full">
                        {item.category}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.is_active ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/40'}`}>
                      {item.is_active ? 'مفعّل' : 'معطّل'}
                    </span>
                  </div>
                  <p className="font-medium text-sm mb-1.5">{item.question}</p>
                  <p className="text-white/50 text-sm line-clamp-2">{item.answer}</p>
                  {item.keywords && (
                    <p className="text-white/30 text-xs mt-2">
                      الكلمات المفتاحية: {item.keywords}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setEditItem(item)}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('هل تريد حذف هذا العنصر؟')) {
                        deleteMutation.mutate(item.id)
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editItem && (
        <Modal
          item={editItem}
          onSave={handleSave}
          onClose={() => setEditItem(null)}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  )
}
