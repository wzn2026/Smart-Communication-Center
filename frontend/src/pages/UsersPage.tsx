import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  UserPlus, Pencil, Trash2, X, KeyRound, ShieldCheck,
  UserCheck, UserX, RefreshCw,
} from 'lucide-react'
import { getUsers, createUser, updateUser, deleteUser, setUserPassword } from '../api'
import { Spinner } from '../components/ui/Spinner'
import type { UserInfo } from '../types'

const avatarGradients = [
  ['#2563eb','#0891b2'],
  ['#7c3aed','#a855f7'],
  ['#059669','#0d9488'],
  ['#d97706','#f59e0b'],
  ['#dc2626','#e11d48'],
]

function getGradient(name: string) {
  let h = 0
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return avatarGradients[Math.abs(h) % avatarGradients.length]
}

function Avatar({ name }: { name: string }) {
  const [a, b] = getGradient(name)
  return (
    <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
      style={{ background: `linear-gradient(135deg,${a},${b})` }}>
      {(name || '؟').charAt(0).toUpperCase()}
    </div>
  )
}

const emptyForm = { username: '', email: '', first_name: '', last_name: '', password: '', is_staff: false, is_active: true }

export function UsersPage() {
  const qc = useQueryClient()
  const { data, isLoading, refetch } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const users = data?.data.results || []

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<UserInfo | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [showPwdModal, setShowPwdModal] = useState(false)
  const [pwdTarget, setPwdTarget] = useState<UserInfo | null>(null)
  const [newPwd, setNewPwd] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdError, setPwdError] = useState('')

  function openAdd() {
    setEditTarget(null)
    setForm({ ...emptyForm })
    setError('')
    setShowModal(true)
  }

  function openEdit(u: UserInfo) {
    setEditTarget(u)
    setForm({ username: u.username, email: u.email, first_name: u.first_name, last_name: u.last_name, password: '', is_staff: u.is_staff, is_active: u.is_active })
    setError('')
    setShowModal(true)
  }

  function openPwd(u: UserInfo) {
    setPwdTarget(u)
    setNewPwd('')
    setPwdError('')
    setShowPwdModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      if (editTarget) {
        const payload: Partial<UserInfo> = { email: form.email, first_name: form.first_name, last_name: form.last_name, is_staff: form.is_staff, is_active: form.is_active }
        await updateUser(editTarget.id, payload)
      } else {
        await createUser({ username: form.username, email: form.email, first_name: form.first_name, last_name: form.last_name, password: form.password, is_staff: form.is_staff, is_active: true })
      }
      qc.invalidateQueries({ queryKey: ['users'] })
      setShowModal(false)
    } catch (err: any) {
      const d = err?.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' — ') : 'حدث خطأ')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(u: UserInfo) {
    if (!confirm(`حذف المستخدم "${u.username}"؟`)) return
    try {
      await deleteUser(u.id)
      qc.invalidateQueries({ queryKey: ['users'] })
    } catch { alert('تعذّر الحذف.') }
  }

  async function handleSetPwd(e: React.FormEvent) {
    e.preventDefault()
    if (!pwdTarget) return
    setPwdSaving(true); setPwdError('')
    try {
      await setUserPassword(pwdTarget.id, newPwd)
      setShowPwdModal(false)
    } catch (err: any) {
      setPwdError(err?.response?.data?.error ?? 'حدث خطأ')
    } finally {
      setPwdSaving(false)
    }
  }

  async function toggleActive(u: UserInfo) {
    await updateUser(u.id, { is_active: !u.is_active })
    qc.invalidateQueries({ queryKey: ['users'] })
  }

  return (
    <div className="p-8 min-h-full bg-ink-50">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">إدارة المستخدمين</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              {isLoading ? '...' : `${users.length} مستخدم مسجّل`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-400 hover:text-brand-600 bg-white hover:bg-brand-50 border border-neutral-200 transition-all shadow-card">
              <RefreshCw size={15} />
            </button>
            <button onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
              style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
              <UserPlus size={15} /> مستخدم جديد
            </button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-card py-20 text-center text-neutral-400">
            <UserPlus size={40} className="mx-auto mb-3 opacity-20" />
            <p>لا يوجد مستخدمون.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_2fr_auto_auto] gap-4 px-5 py-3 bg-neutral-50 border-b border-neutral-100 text-xs font-bold text-neutral-400 uppercase tracking-wider">
              <span>المستخدم</span>
              <span>البريد / الاسم</span>
              <span>الصلاحية</span>
              <span>إجراءات</span>
            </div>

            {users.map((u, i) => (
              <div key={u.id}
                className="grid grid-cols-[1fr_2fr_auto_auto] gap-4 items-center px-5 py-3.5 hover:bg-brand-50/30 transition-colors group"
                style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>

                {/* Avatar + username */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex-shrink-0">
                    <Avatar name={u.username} />
                    {!u.is_active && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-800 text-sm truncate">@{u.username}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {u.is_active ? (
                        <span className="text-green-600">نشط</span>
                      ) : (
                        <span className="text-red-500">موقوف</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Email + name */}
                <div className="min-w-0">
                  <p className="text-sm text-neutral-700 truncate">
                    {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5 truncate" dir="ltr">{u.email || '—'}</p>
                </div>

                {/* Role badge */}
                <div className="flex items-center gap-1.5">
                  {u.is_staff ? (
                    <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                      <ShieldCheck size={11} /> مدير النظام
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200">
                      مستخدم
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openPwd(u)} title="تغيير كلمة المرور"
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-teal-600 hover:bg-teal-50 border border-transparent hover:border-teal-200 transition-all">
                    <KeyRound size={14} />
                  </button>
                  <button onClick={() => toggleActive(u)} title={u.is_active ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all">
                    {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                  </button>
                  <button onClick={() => openEdit(u)} title="تعديل"
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-brand-600 hover:bg-brand-50 border border-transparent hover:border-brand-200 transition-all">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(u)} title="حذف"
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden">
            <div className="h-1" style={{ background: 'linear-gradient(90deg,#2563eb,#0891b2)' }} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-neutral-900 text-lg">
                  {editTarget ? `تعديل — ${editTarget.username}` : 'مستخدم جديد'}
                </h2>
                <button onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!editTarget && (
                  <Field label="اسم المستخدم" required>
                    <input value={form.username} required
                      onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                      placeholder="username" dir="ltr" className="input-field" />
                  </Field>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label="الاسم الأول">
                    <input value={form.first_name}
                      onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                      placeholder="محمد" className="input-field" />
                  </Field>
                  <Field label="اسم العائلة">
                    <input value={form.last_name}
                      onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                      placeholder="الأحمد" className="input-field" />
                  </Field>
                </div>

                <Field label="البريد الإلكتروني">
                  <input value={form.email} type="email"
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="user@example.com" dir="ltr" className="input-field" />
                </Field>

                {!editTarget && (
                  <Field label="كلمة المرور" required>
                    <input value={form.password} required type="password"
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="••••••••" dir="ltr" className="input-field" />
                  </Field>
                )}

                <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                  <input type="checkbox" id="is_staff" checked={form.is_staff}
                    onChange={e => setForm(f => ({ ...f, is_staff: e.target.checked }))}
                    className="w-4 h-4 accent-brand-600 cursor-pointer" />
                  <label htmlFor="is_staff" className="text-sm text-neutral-700 cursor-pointer">
                    <span className="font-semibold">مدير النظام</span>
                    <span className="text-neutral-400 text-xs mr-2">— صلاحيات كاملة على جميع المستأجرين</span>
                  </label>
                </div>

                {editTarget && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                    <input type="checkbox" id="is_active" checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      className="w-4 h-4 accent-brand-600 cursor-pointer" />
                    <label htmlFor="is_active" className="text-sm text-neutral-700 cursor-pointer">
                      <span className="font-semibold">الحساب نشط</span>
                    </label>
                  </div>
                )}

                {error && (
                  <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">⚠️ {error}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-110 active:scale-95"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
                    {saving ? 'جارٍ الحفظ...' : editTarget ? 'حفظ التعديلات' : 'إنشاء المستخدم'}
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

      {/* Password Reset Modal */}
      {showPwdModal && pwdTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm bg-white rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden">
            <div className="h-1" style={{ background: 'linear-gradient(90deg,#0d9488,#0891b2)' }} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#0d9488,#0891b2)' }}>
                    <KeyRound size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900 text-sm">تغيير كلمة المرور</p>
                    <p className="text-xs text-neutral-400">@{pwdTarget.username}</p>
                  </div>
                </div>
                <button onClick={() => setShowPwdModal(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all">
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleSetPwd} className="space-y-4">
                <Field label="كلمة المرور الجديدة" required>
                  <input value={newPwd} required type="password" minLength={4}
                    onChange={e => setNewPwd(e.target.value)}
                    placeholder="••••••••" dir="ltr" className="input-field" autoFocus />
                </Field>

                {pwdError && (
                  <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">⚠️ {pwdError}</p>
                )}

                <div className="flex gap-3">
                  <button type="submit" disabled={pwdSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg,#0d9488,#0891b2)' }}>
                    {pwdSaving ? 'جارٍ التحديث...' : 'تحديث كلمة المرور'}
                  </button>
                  <button type="button" onClick={() => setShowPwdModal(false)}
                    className="px-4 py-2.5 rounded-xl text-sm text-neutral-600 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 transition-all">
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
        {label}{required && <span className="text-red-500 mr-1">*</span>}
      </label>
      {children}
    </div>
  )
}
