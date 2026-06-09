import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight, UserPlus, Pencil, Trash2, X, KeyRound,
  ShieldCheck, UserCheck, UserX, ChevronDown, Users,
  Building2, Crown, CheckCircle, XCircle,
} from 'lucide-react'
import {
  getTenants, getUsers,
  getTenantMembers, addTenantMember, updateMemberRole, removeTenantMember,
  createUser, updateUser, deleteUser, setUserPassword,
} from '../api'
import { Spinner } from '../components/ui/Spinner'
import type { UserInfo, TenantMembership, MemberRole, Tenant } from '../types'

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLES: { value: MemberRole; label: string }[] = [
  { value: 'owner',  label: 'مالك'   },
  { value: 'admin',  label: 'مدير'   },
  { value: 'agent',  label: 'وكيل'   },
  { value: 'viewer', label: 'مشاهد'  },
]

const roleStyle: Record<MemberRole, string> = {
  owner:  'bg-amber-100 text-amber-700 border-amber-200',
  admin:  'bg-blue-100  text-blue-700  border-blue-200',
  agent:  'bg-teal-100  text-teal-700  border-teal-200',
  viewer: 'bg-neutral-100 text-neutral-500 border-neutral-200',
}

const planLabel: Record<string, string> = {
  free: 'مجاني', starter: 'ستارتر', pro: 'احترافي', enterprise: 'مؤسسي',
}

const grads = [
  ['#2563eb','#0891b2'], ['#7c3aed','#a855f7'],
  ['#059669','#0d9488'], ['#d97706','#f59e0b'], ['#dc2626','#e11d48'],
]
function grad(s: string): [string, string] {
  let h = 0; for (const c of s) h = c.charCodeAt(0) + ((h << 5) - h)
  return grads[Math.abs(h) % grads.length] as [string, string]
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const [a, b] = grad(name)
  const cls = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm'
  return (
    <div className={`${cls} rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold`}
      style={{ background: `linear-gradient(135deg,${a},${b})` }}>
      {(name || '؟').charAt(0).toUpperCase()}
    </div>
  )
}

function FLabel({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
        {label}{required && <span className="text-red-500 mr-1">*</span>}
      </label>
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// VIEW 1: Tenant Cards Grid
// ═══════════════════════════════════════════════════════════════════════════

function TenantCard({ tenant, memberCount, onClick }: {
  tenant: Tenant; memberCount: number; onClick: () => void
}) {
  const [a, b] = grad(tenant.name)
  return (
    <button onClick={onClick}
      className="bg-white rounded-2xl border border-neutral-200 shadow-card hover:shadow-card-md hover:-translate-y-0.5 transition-all text-right overflow-hidden group w-full">
      {/* Gradient top bar */}
      <div className="h-1.5" style={{ background: `linear-gradient(90deg,${a},${b})` }} />

      <div className="p-5">
        {/* Icon + status */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-sm"
            style={{ background: `linear-gradient(135deg,${a},${b})` }}>
            {tenant.name.charAt(0)}
          </div>
          {tenant.status === 'active' ? (
            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
              <CheckCircle size={11} /> نشط
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
              <XCircle size={11} /> معلق
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="font-bold text-neutral-800 text-base mb-0.5">{tenant.name}</h3>
        <p className="text-xs text-neutral-400 mb-4" dir="ltr">{tenant.slug}</p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm text-neutral-600">
            <Users size={14} className="text-brand-500" />
            <span className="font-bold">{memberCount}</span>
            <span className="text-neutral-400">عضو</span>
          </div>
          <div className="flex items-center gap-1.5">
            {tenant.plan === 'enterprise' && <Crown size={13} className="text-amber-500" />}
            <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-500 font-medium">
              {planLabel[tenant.plan] ?? tenant.plan}
            </span>
          </div>
        </div>
      </div>

      {/* Hover CTA */}
      <div className="px-5 py-3 border-t border-neutral-100 text-xs font-semibold flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: a }}>
        <Building2 size={12} /> إدارة الأعضاء
        <ArrowRight size={12} className="mr-auto" />
      </div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// VIEW 2: Tenant Detail — members + full user management
// ═══════════════════════════════════════════════════════════════════════════

type ModalMode =
  | { type: 'add' }
  | { type: 'edit'; member: TenantMembership }
  | { type: 'pwd';  member: TenantMembership }
  | null

const emptyNewUser = {
  username: '', email: '', first_name: '', last_name: '', password: '', is_staff: false,
}

function TenantDetail({ tenant, onBack }: { tenant: Tenant; onBack: () => void }) {
  const qc = useQueryClient()
  const QK = ['members', tenant.id]

  const { data: membersRes, isLoading } = useQuery({
    queryKey: QK,
    queryFn: () => getTenantMembers(tenant.id),
  })
  const { data: allUsersRes } = useQuery({ queryKey: ['users'], queryFn: getUsers })

  const members  = (membersRes?.data ?? []) as TenantMembership[]
  const allUsers = allUsersRes?.data.results ?? []

  const memberByUserId = new Map(members.map(m => [m.user, m]))

  const [modal, setModal] = useState<ModalMode>(null)

  // Add modal sub-state
  const [addMode, setAddMode]    = useState<'existing' | 'new'>('existing')
  const [pickUser, setPickUser]  = useState('')
  const [pickRole, setPickRole]  = useState<MemberRole>('agent')
  const [newUser, setNewUser]    = useState({ ...emptyNewUser })
  const [newRole, setNewRole]    = useState<MemberRole>('agent')

  // Edit modal sub-state
  const [editForm, setEditForm]  = useState({ first_name: '', last_name: '', email: '', is_staff: false, is_active: true })

  // Pwd modal sub-state
  const [pwd, setPwd]            = useState('')

  const [saving, setSaving]      = useState(false)
  const [error, setError]        = useState('')

  const [a, b] = grad(tenant.name)

  function openAdd() {
    setAddMode('existing'); setPickUser(unassigned[0]?.username ?? ''); setPickRole('agent')
    setNewUser({ ...emptyNewUser }); setNewRole('agent')
    setError(''); setModal({ type: 'add' })
  }

  function openEdit(m: TenantMembership) {
    setEditForm({ first_name: m.full_name.split(' ')[0] ?? '', last_name: m.full_name.split(' ').slice(1).join(' ') ?? '', email: '', is_staff: false, is_active: true })
    // Fetch fresh user data
    const u = allUsers.find(u => u.id === m.user)
    if (u) setEditForm({ first_name: u.first_name, last_name: u.last_name, email: u.email, is_staff: u.is_staff, is_active: u.is_active })
    setError(''); setModal({ type: 'edit', member: m })
  }

  function openPwd(m: TenantMembership) { setPwd(''); setError(''); setModal({ type: 'pwd', member: m }) }

  async function handleRoleChange(m: TenantMembership, role: MemberRole) {
    await updateMemberRole(tenant.id, m.id, role)
    qc.invalidateQueries({ queryKey: QK })
  }

  async function handleRemove(m: TenantMembership) {
    if (!confirm(`إزالة "${m.full_name}" من "${tenant.name}"؟`)) return
    await removeTenantMember(tenant.id, m.id)
    qc.invalidateQueries({ queryKey: QK })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (modal?.type === 'add') {
        if (addMode === 'existing') {
          if (!pickUser) { setError('اختر مستخدماً'); return }
          const existingMember = members.find(m => m.username === pickUser)
          if (existingMember) {
            // Already a member — just update role
            await updateMemberRole(tenant.id, existingMember.id, pickRole)
          } else {
            await addTenantMember(tenant.id, pickUser, pickRole)
          }
        } else {
          if (!newUser.password) { setError('كلمة المرور مطلوبة'); return }
          await createUser({ ...newUser, is_active: true })
          qc.invalidateQueries({ queryKey: ['users'] })
          await addTenantMember(tenant.id, newUser.username, newRole)
        }
        qc.invalidateQueries({ queryKey: QK })
        setModal(null)
      }

      if (modal?.type === 'edit') {
        await updateUser(modal.member.user, {
          first_name: editForm.first_name, last_name: editForm.last_name,
          email: editForm.email, is_staff: editForm.is_staff, is_active: editForm.is_active,
        })
        qc.invalidateQueries({ queryKey: ['users'] })
        qc.invalidateQueries({ queryKey: QK })
        setModal(null)
      }

      if (modal?.type === 'pwd') {
        if (pwd.length < 4) { setError('كلمة المرور قصيرة جداً'); return }
        await setUserPassword(modal.member.user, pwd)
        setModal(null)
      }
    } catch (err: any) {
      const d = err?.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' — ') : 'حدث خطأ')
    } finally { setSaving(false) }
  }

  async function handleDeleteUser(m: TenantMembership) {
    if (!confirm(`حذف المستخدم "${m.full_name}" نهائياً من النظام؟`)) return
    await deleteUser(m.user)
    qc.invalidateQueries({ queryKey: ['users'] })
    qc.invalidateQueries({ queryKey: QK })
  }

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-500 hover:text-brand-600 bg-white hover:bg-brand-50 border border-neutral-200 transition-all shadow-card flex-shrink-0">
          <ArrowRight size={16} />
        </button>

        <div className="bg-white rounded-2xl border border-neutral-200 shadow-card p-4 flex items-center gap-4 flex-1">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-black flex-shrink-0"
            style={{ background: `linear-gradient(135deg,${a},${b})` }}>
            {tenant.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-neutral-900 text-lg leading-tight">{tenant.name}</h2>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-neutral-400" dir="ltr">{tenant.slug}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 font-medium">
                {planLabel[tenant.plan] ?? tenant.plan}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm flex-shrink-0">
            <Users size={14} style={{ color: a }} />
            <span className="font-bold text-neutral-700">{members.length}</span>
            <span className="text-neutral-400 text-xs">عضو</span>
          </div>
        </div>

        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95 flex-shrink-0"
          style={{ background: `linear-gradient(135deg,${a},${b})`, boxShadow: `0 4px 12px ${a}44` }}>
          <UserPlus size={15} /> إضافة عضو
        </button>
      </div>

      {/* ── Members list ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : members.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-card py-20 text-center text-neutral-400">
          <Users size={40} className="mx-auto mb-3 opacity-20" />
          <p>لا يوجد أعضاء في هذا المستأجر.</p>
          <button onClick={openAdd}
            className="mt-4 px-5 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: `linear-gradient(135deg,${a},${b})` }}>
            أضف العضو الأول
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-5 py-3 bg-neutral-50 border-b border-neutral-100 text-xs font-bold text-neutral-400 uppercase tracking-wider">
            <span className="w-10" />
            <span>المستخدم</span>
            <span>الدور</span>
            <span>إجراءات</span>
          </div>

          {members.map((m, i) => {
            const u = allUsers.find(u => u.id === m.user)
            return (
              <div key={m.id}
                className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-5 py-4 hover:bg-brand-50/20 transition-colors group"
                style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>

                {/* Avatar */}
                <div className="relative w-10">
                  <Avatar name={m.full_name || m.username} />
                  {u && !u.is_active && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" title="موقوف" />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-neutral-800 text-sm truncate">{m.full_name}</span>
                    {u?.is_staff && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                        <ShieldCheck size={9} /> أدمن
                      </span>
                    )}
                    {u && !u.is_active && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-500 border border-red-200">موقوف</span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">@{m.username}{u?.email ? ` · ${u.email}` : ''}</p>
                </div>

                {/* Role */}
                <div className="relative">
                  <select value={m.role}
                    onChange={e => handleRoleChange(m, e.target.value as MemberRole)}
                    className={`appearance-none text-xs font-bold pl-6 pr-3 py-1.5 rounded-full outline-none cursor-pointer border transition-all ${roleStyle[m.role]}`}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <ChevronDown size={10} className="absolute left-1.5 top-2 pointer-events-none opacity-40" />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(m)} title="تعديل البيانات"
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-brand-600 hover:bg-brand-50 border border-transparent hover:border-brand-200 transition-all">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => openPwd(m)} title="إعادة تعيين كلمة المرور"
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-teal-600 hover:bg-teal-50 border border-transparent hover:border-teal-200 transition-all">
                    <KeyRound size={14} />
                  </button>
                  <button onClick={() => u && (u.is_active ? updateUser(u.id, { is_active: false }) : updateUser(u.id, { is_active: true })).then(() => { qc.invalidateQueries({ queryKey: ['users'] }) })}
                    title={u?.is_active ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all">
                    {u?.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                  </button>
                  <button onClick={() => handleRemove(m)} title="إزالة من المستأجر"
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-300 hover:text-orange-500 hover:bg-orange-50 border border-transparent hover:border-orange-100 transition-all">
                    <UserX size={14} />
                  </button>
                  <button onClick={() => handleDeleteUser(m)} title="حذف المستخدم نهائياً"
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="h-1 sticky top-0" style={{ background: `linear-gradient(90deg,${a},${b})` }} />
            <div className="p-6">

              {/* Modal header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-neutral-900 text-lg">
                  {modal.type === 'add'  && 'إضافة عضو'}
                  {modal.type === 'edit' && `تعديل — @${modal.member.username}`}
                  {modal.type === 'pwd'  && `كلمة مرور — @${modal.member.username}`}
                </h2>
                <button onClick={() => setModal(null)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* ── ADD ─────────────────────────────── */}
                {modal.type === 'add' && (
                  <>
                    {/* Mode toggle */}
                    <div className="flex gap-1 p-1 bg-neutral-100 rounded-xl">
                      {(['existing', 'new'] as const).map(m => (
                        <button key={m} type="button" onClick={() => setAddMode(m)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${addMode === m ? 'bg-white shadow text-neutral-800' : 'text-neutral-500'}`}>
                          {m === 'existing' ? 'مستخدم موجود' : 'إنشاء مستخدم جديد'}
                        </button>
                      ))}
                    </div>

                    {addMode === 'existing' ? (
                      <>
                        {allUsers.length === 0 ? (
                          <div className="py-4 text-center text-sm text-neutral-400 bg-neutral-50 rounded-xl border border-neutral-200">
                            لا يوجد مستخدمون في النظام.
                            <br />
                            <button type="button" onClick={() => setAddMode('new')}
                              className="text-brand-600 font-semibold mt-1 hover:underline text-xs">
                              أنشئ مستخدماً جديداً
                            </button>
                          </div>
                        ) : (
                          <>
                            <FLabel label="المستخدم" required>
                              <div className="relative">
                                <select value={pickUser}
                                  onChange={e => {
                                    setPickUser(e.target.value)
                                    // pre-fill role from existing membership
                                    const existing = members.find(m => m.username === e.target.value)
                                    if (existing) setPickRole(existing.role)
                                  }}
                                  className="input-field appearance-none pr-8">
                                  <option value="">-- اختر مستخدماً --</option>
                                  {allUsers.map(u => {
                                    const existing = memberByUserId.get(u.id)
                                    const roleLabel = existing ? ` (${ROLES.find(r => r.value === existing.role)?.label ?? existing.role})` : ''
                                    return (
                                      <option key={u.id} value={u.username}>
                                        @{u.username}{u.first_name ? ` — ${u.first_name} ${u.last_name}` : ''}{roleLabel}
                                      </option>
                                    )
                                  })}
                                </select>
                                <ChevronDown size={12} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                              </div>
                              {pickUser && memberByUserId.get(allUsers.find(u => u.username === pickUser)?.id ?? -1) && (
                                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-2">
                                  هذا المستخدم عضو بالفعل — سيتم تحديث دوره.
                                </p>
                              )}
                            </FLabel>
                            <FLabel label="الدور">
                              <div className="relative">
                                <select value={pickRole} onChange={e => setPickRole(e.target.value as MemberRole)}
                                  className="input-field appearance-none pr-8">
                                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                                <ChevronDown size={12} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                              </div>
                            </FLabel>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <FLabel label="اسم المستخدم" required>
                          <input value={newUser.username} required dir="ltr"
                            onChange={e => setNewUser(f => ({ ...f, username: e.target.value }))}
                            placeholder="username" className="input-field" />
                        </FLabel>
                        <div className="grid grid-cols-2 gap-3">
                          <FLabel label="الاسم الأول">
                            <input value={newUser.first_name}
                              onChange={e => setNewUser(f => ({ ...f, first_name: e.target.value }))}
                              placeholder="محمد" className="input-field" />
                          </FLabel>
                          <FLabel label="اسم العائلة">
                            <input value={newUser.last_name}
                              onChange={e => setNewUser(f => ({ ...f, last_name: e.target.value }))}
                              placeholder="الأحمد" className="input-field" />
                          </FLabel>
                        </div>
                        <FLabel label="البريد الإلكتروني">
                          <input value={newUser.email} type="email" dir="ltr"
                            onChange={e => setNewUser(f => ({ ...f, email: e.target.value }))}
                            placeholder="user@example.com" className="input-field" />
                        </FLabel>
                        <FLabel label="كلمة المرور" required>
                          <input value={newUser.password} required type="password" minLength={4}
                            onChange={e => setNewUser(f => ({ ...f, password: e.target.value }))}
                            placeholder="••••••••" dir="ltr" className="input-field" />
                        </FLabel>
                        <div className="grid grid-cols-2 gap-3">
                          <FLabel label="الدور في المستأجر">
                            <div className="relative">
                              <select value={newRole} onChange={e => setNewRole(e.target.value as MemberRole)}
                                className="input-field appearance-none pr-8">
                                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                              </select>
                              <ChevronDown size={12} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                            </div>
                          </FLabel>
                          <div className="flex items-end pb-0.5">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input type="checkbox" checked={newUser.is_staff}
                                onChange={e => setNewUser(f => ({ ...f, is_staff: e.target.checked }))}
                                className="w-4 h-4 accent-brand-600" />
                              <span className="text-neutral-700 font-medium text-xs">مدير النظام</span>
                            </label>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* ── EDIT ────────────────────────────── */}
                {modal.type === 'edit' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <FLabel label="الاسم الأول">
                        <input value={editForm.first_name}
                          onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                          placeholder="محمد" className="input-field" />
                      </FLabel>
                      <FLabel label="اسم العائلة">
                        <input value={editForm.last_name}
                          onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                          placeholder="الأحمد" className="input-field" />
                      </FLabel>
                    </div>
                    <FLabel label="البريد الإلكتروني">
                      <input value={editForm.email} type="email" dir="ltr"
                        onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="user@example.com" className="input-field" />
                    </FLabel>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-200 cursor-pointer">
                        <input type="checkbox" checked={editForm.is_staff}
                          onChange={e => setEditForm(f => ({ ...f, is_staff: e.target.checked }))}
                          className="w-4 h-4 accent-brand-600" />
                        <div>
                          <span className="font-semibold text-neutral-700 text-sm">مدير النظام</span>
                          <p className="text-xs text-neutral-400">صلاحيات كاملة على النظام</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-200 cursor-pointer">
                        <input type="checkbox" checked={editForm.is_active}
                          onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                          className="w-4 h-4 accent-brand-600" />
                        <span className="font-semibold text-neutral-700 text-sm">الحساب نشط</span>
                      </label>
                    </div>
                  </>
                )}

                {/* ── PASSWORD ─────────────────────────── */}
                {modal.type === 'pwd' && (
                  <FLabel label="كلمة المرور الجديدة" required>
                    <input value={pwd} required type="password" minLength={4} autoFocus
                      onChange={e => setPwd(e.target.value)}
                      placeholder="••••••••" dir="ltr" className="input-field" />
                  </FLabel>
                )}

                {error && (
                  <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">⚠️ {error}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-110"
                    style={{ background: `linear-gradient(135deg,${a},${b})`, boxShadow: `0 4px 12px ${a}33` }}>
                    {saving ? 'جارٍ الحفظ...' :
                      modal.type === 'add' && addMode === 'existing' && pickUser && memberByUserId.get(allUsers.find(u => u.username === pickUser)?.id ?? -1) ? 'تحديث الدور' :
                      modal.type === 'add'  ? 'إضافة' :
                      modal.type === 'edit' ? 'حفظ التعديلات' : 'تحديث كلمة المرور'}
                  </button>
                  <button type="button" onClick={() => setModal(null)}
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

// ═══════════════════════════════════════════════════════════════════════════
// ROOT — switches between grid and detail
// ═══════════════════════════════════════════════════════════════════════════

export function TeamPage() {
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)

  const { data: tenantsRes, isLoading } = useQuery({ queryKey: ['tenants'], queryFn: getTenants })
  const tenants = tenantsRes?.data.results ?? []

  // Pre-fetch member counts for all tenants
  const memberCountMap = useMemo(() => new Map<string, number>(), [])

  if (selectedTenant) {
    return (
      <div className="p-8 min-h-full bg-ink-50">
        <div className="max-w-4xl mx-auto">
          <TenantDetail
            tenant={selectedTenant}
            onBack={() => setSelectedTenant(null)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 min-h-full bg-ink-50">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">المستخدمون والأعضاء</h1>
          <p className="text-sm text-neutral-500 mt-0.5">اختر مستأجراً لإدارة أعضائه</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : tenants.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-card py-20 text-center text-neutral-400">
            <Building2 size={40} className="mx-auto mb-3 opacity-20" />
            <p>لا يوجد مستأجرون. أضف مستأجراً أولاً.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map(t => (
              <TenantCardWithCount
                key={t.id}
                tenant={t}
                onClick={() => setSelectedTenant(t)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Wrapper that fetches member count per card
function TenantCardWithCount({ tenant, onClick }: { tenant: Tenant; onClick: () => void }) {
  const { data } = useQuery({
    queryKey: ['members', tenant.id],
    queryFn: () => getTenantMembers(tenant.id),
  })
  const count = (data?.data as TenantMembership[] | undefined)?.length ?? 0
  return <TenantCard tenant={tenant} memberCount={count} onClick={onClick} />
}
