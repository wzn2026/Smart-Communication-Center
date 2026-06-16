import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Plus, Pencil, Trash2, X, CheckCircle, XCircle,
  Crown, ChevronDown, ArrowRight, UserPlus, KeyRound,
  ShieldCheck, UserCheck, UserX, Users, Phone, Wifi, WifiOff,
  Clock, Copy, Check, Info,
} from 'lucide-react'
import {
  getTenants, createTenant, updateTenant, deleteTenant,
  getTenantMembers, addTenantMember, updateMemberRole, removeTenantMember,
  createUser, updateUser, deleteUser, setUserPassword, getUsers,
  getWhatsAppNumbers, createWhatsAppNumber, updateWhatsAppNumber, deleteWhatsAppNumber,
} from '../api'
import { Spinner } from '../components/ui/Spinner'
import { useAuthStore } from '../store/authStore'
import type { Tenant, TenantMembership, MemberRole, WhatsAppNumber, UserInfo } from '../types'

// ── Shared helpers ────────────────────────────────────────────────────────────

const grads = [
  ['#2563eb','#0891b2'], ['#7c3aed','#a855f7'],
  ['#059669','#0d9488'], ['#d97706','#f59e0b'], ['#dc2626','#e11d48'],
]
function grad(s: string): [string, string] {
  let h = 0; for (const c of s) h = c.charCodeAt(0) + ((h << 5) - h)
  return grads[Math.abs(h) % grads.length] as [string, string]
}

const planLabel: Record<string, string> = {
  free: 'مجاني', starter: 'ستارتر', pro: 'احترافي', enterprise: 'مؤسسي',
}
const planStyle: Record<string, string> = {
  free:       'bg-neutral-100 text-neutral-500 border-neutral-200',
  starter:    'bg-teal-100 text-teal-700 border-teal-200',
  pro:        'bg-blue-100 text-blue-700 border-blue-200',
  enterprise: 'bg-amber-100 text-amber-700 border-amber-200',
}
const typeLabel: Record<string, string> = {
  platform: 'منصة', company: 'شركة', family_fund: 'صندوق أسرة', other: 'أخرى',
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

function FLabel({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
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

// ── Tenant card ───────────────────────────────────────────────────────────────

function TenantCardWithCounts({ tenant, onClick }: { tenant: Tenant; onClick: () => void }) {
  const { data: mRes } = useQuery({ queryKey: ['members', tenant.id], queryFn: () => getTenantMembers(tenant.id) })
  const { data: nRes } = useQuery({ queryKey: ['whatsapp-numbers', tenant.id], queryFn: () => getWhatsAppNumbers({ tenant_id: tenant.id }) })
  const memberCount = (mRes?.data as TenantMembership[] | undefined)?.length ?? 0
  const numberCount = nRes?.data.results.length ?? 0
  const [a, b] = grad(tenant.name)

  return (
    <button onClick={onClick}
      className="bg-white rounded-2xl border border-neutral-200 shadow-card hover:shadow-card-md hover:-translate-y-0.5 transition-all text-right overflow-hidden group w-full">
      <div className="h-1.5" style={{ background: `linear-gradient(90deg,${a},${b})` }} />
      <div className="p-5">
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
        <h3 className="font-bold text-neutral-800 text-base mb-0.5">{tenant.name}</h3>
        <p className="text-xs text-neutral-400 mb-4" dir="ltr">{tenant.slug}</p>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-neutral-500">
              <Users size={13} className="text-brand-400" />
              <span className="font-bold text-neutral-700">{memberCount}</span>
              <span className="text-neutral-400 text-xs">عضو</span>
            </span>
            <span className="flex items-center gap-1 text-neutral-500">
              <Phone size={13} className="text-green-500" />
              <span className="font-bold text-neutral-700">{numberCount}</span>
              <span className="text-neutral-400 text-xs">رقم</span>
            </span>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${planStyle[tenant.plan] ?? planStyle.free}`}>
            {tenant.plan === 'enterprise' && <Crown size={10} className="inline ml-1 text-amber-500" />}
            {planLabel[tenant.plan] ?? tenant.plan}
          </span>
        </div>
      </div>
      <div className="px-5 py-3 border-t border-neutral-100 text-xs font-semibold flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: a }}>
        <Building2 size={12} /> إدارة المشترك
        <ArrowRight size={12} className="mr-auto" />
      </div>
    </button>
  )
}

// ── Tenant Detail: 3 tabs ────────────────────────────────────────────────────

type DetailTab = 'info' | 'members' | 'numbers'

const ROLES: { value: MemberRole; label: string }[] = [
  { value: 'owner', label: 'مالك' }, { value: 'admin', label: 'مدير' },
  { value: 'agent', label: 'وكيل' }, { value: 'viewer', label: 'مشاهد' },
]
const roleStyle: Record<MemberRole, string> = {
  owner: 'bg-amber-100 text-amber-700 border-amber-200',
  admin: 'bg-blue-100 text-blue-700 border-blue-200',
  agent: 'bg-teal-100 text-teal-700 border-teal-200',
  viewer: 'bg-neutral-100 text-neutral-500 border-neutral-200',
}

type MemberModal =
  | { type: 'add' }
  | { type: 'edit'; member: TenantMembership }
  | { type: 'pwd'; member: TenantMembership }
  | null

const isDev = window.location.hostname === 'localhost'
const WEBHOOK_BASE = isDev ? 'http://localhost:8000' : `${window.location.protocol}//${window.location.hostname}`

function TenantDetail({ tenant: initial, onBack, onDeleted }: {
  tenant: Tenant; onBack: () => void; onDeleted: () => void
}) {
  const qc = useQueryClient()
  const [tenant, setTenant] = useState(initial)
  const [tab, setTab] = useState<DetailTab>('members')
  const currentUser = useAuthStore(s => s.user)
  const [a, b] = grad(tenant.name)

  // ── Info tab state ─────────────────────────────────────────────────────────
  const [infoForm, setInfoForm] = useState({
    name: tenant.name, slug: tenant.slug, tenant_type: tenant.tenant_type,
    plan: tenant.plan, status: tenant.status,
  })
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoError, setInfoError] = useState('')

  function slugify(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  async function handleInfoSave(e: React.FormEvent) {
    e.preventDefault(); setInfoSaving(true); setInfoError('')
    try {
      const res = await updateTenant(tenant.id, infoForm)
      setTenant(res.data)
      qc.invalidateQueries({ queryKey: ['tenants'] })
    } catch (err: any) {
      const d = err?.response?.data
      setInfoError(typeof d === 'object' ? Object.values(d).flat().join(' — ') : 'حدث خطأ')
    } finally { setInfoSaving(false) }
  }

  async function handleDelete() {
    if (!confirm(`حذف المشترك "${tenant.name}"؟ لا يمكن التراجع.`)) return
    try {
      await deleteTenant(tenant.id)
      qc.invalidateQueries({ queryKey: ['tenants'] })
      onDeleted()
    } catch {
      alert('تعذّر الحذف — تأكد أنه لا توجد بيانات مرتبطة.')
    }
  }

  // ── Members tab state ──────────────────────────────────────────────────────
  const MQK = ['members', tenant.id]
  const { data: membersRes, isLoading: membersLoading } = useQuery({ queryKey: MQK, queryFn: () => getTenantMembers(tenant.id) })
  const { data: allUsersRes } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const members = (membersRes?.data ?? []) as TenantMembership[]
  const allUsers = (allUsersRes?.data.results ?? []) as UserInfo[]
  const memberByUserId = new Map(members.map(m => [m.user, m]))

  const [mModal, setMModal] = useState<MemberModal>(null)
  const [addMode, setAddMode] = useState<'existing' | 'new'>('existing')
  const [pickUser, setPickUser] = useState('')
  const [pickRole, setPickRole] = useState<MemberRole>('agent')
  const [newUser, setNewUser] = useState({ username: '', email: '', first_name: '', last_name: '', password: '', is_staff: false })
  const [newRole, setNewRole] = useState<MemberRole>('agent')
  const [editUForm, setEditUForm] = useState({ first_name: '', last_name: '', email: '', is_staff: false, is_active: true })
  const [pwd, setPwd] = useState('')
  const [mSaving, setMSaving] = useState(false)
  const [mError, setMError] = useState('')

  function openAddMember() {
    setAddMode('existing'); setPickUser(''); setPickRole('agent')
    setNewUser({ username: '', email: '', first_name: '', last_name: '', password: '', is_staff: false })
    setNewRole('agent'); setMError(''); setMModal({ type: 'add' })
  }
  function openEditMember(m: TenantMembership) {
    const u = allUsers.find(u => u.id === m.user)
    setEditUForm({ first_name: u?.first_name ?? '', last_name: u?.last_name ?? '', email: u?.email ?? '', is_staff: u?.is_staff ?? false, is_active: u?.is_active ?? true })
    setMError(''); setMModal({ type: 'edit', member: m })
  }
  function openPwdMember(m: TenantMembership) { setPwd(''); setMError(''); setMModal({ type: 'pwd', member: m }) }

  async function handleMemberSubmit(e: React.FormEvent) {
    e.preventDefault(); setMSaving(true); setMError('')
    try {
      if (mModal?.type === 'add') {
        if (addMode === 'existing') {
          if (!pickUser) { setMError('اختر مستخدماً'); return }
          const existing = members.find(m => m.username === pickUser)
          if (existing) await updateMemberRole(tenant.id, existing.id, pickRole)
          else await addTenantMember(tenant.id, pickUser, pickRole)
        } else {
          if (!newUser.password) { setMError('كلمة المرور مطلوبة'); return }
          await createUser({ ...newUser, is_active: true })
          qc.invalidateQueries({ queryKey: ['users'] })
          await addTenantMember(tenant.id, newUser.username, newRole)
        }
        qc.invalidateQueries({ queryKey: MQK }); setMModal(null)
      }
      if (mModal?.type === 'edit') {
        await updateUser(mModal.member.user, editUForm)
        qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: MQK }); setMModal(null)
      }
      if (mModal?.type === 'pwd') {
        if (pwd.length < 4) { setMError('كلمة المرور قصيرة جداً'); return }
        await setUserPassword(mModal.member.user, pwd); setMModal(null)
      }
    } catch (err: any) {
      const d = err?.response?.data
      setMError(typeof d === 'object' ? Object.values(d).flat().join(' — ') : 'حدث خطأ')
    } finally { setMSaving(false) }
  }

  async function handleRemoveMember(m: TenantMembership) {
    if (!confirm(`إزالة "${m.full_name}" من "${tenant.name}"؟`)) return
    await removeTenantMember(tenant.id, m.id)
    qc.invalidateQueries({ queryKey: MQK })
  }
  async function handleDeleteUser(m: TenantMembership) {
    if (!confirm(`حذف المستخدم "${m.full_name}" نهائياً؟`)) return
    await deleteUser(m.user)
    qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: MQK })
  }

  // ── Numbers tab state ──────────────────────────────────────────────────────
  const NQK = ['whatsapp-numbers', tenant.id]
  const { data: numRes, isLoading: numsLoading } = useQuery({ queryKey: NQK, queryFn: () => getWhatsAppNumbers({ tenant_id: tenant.id }) })
  const numbers = numRes?.data.results ?? []

  const emptyNumForm = { display_name: '', phone_number: '', provider: 'whatsapp_cloud', provider_phone_id: '', access_token: '', status: 'active' }
  const [numModal, setNumModal] = useState<{ mode: 'add' | 'edit'; target?: WhatsAppNumber } | null>(null)
  const [numForm, setNumForm] = useState({ ...emptyNumForm })
  const [numSaving, setNumSaving] = useState(false)
  const [numError, setNumError] = useState('')
  const [copied, setCopied] = useState('')

  function openAddNum() { setNumForm({ ...emptyNumForm }); setNumError(''); setNumModal({ mode: 'add' }) }
  function openEditNum(n: WhatsAppNumber) {
    setNumForm({ display_name: n.display_name, phone_number: n.phone_number, provider: n.provider, provider_phone_id: n.provider_phone_id || '', access_token: '', status: n.status })
    setNumError(''); setNumModal({ mode: 'edit', target: n })
  }

  async function handleNumSubmit(e: React.FormEvent) {
    e.preventDefault(); setNumSaving(true); setNumError('')
    try {
      if (numModal?.mode === 'edit' && numModal.target) {
        await updateWhatsAppNumber(numModal.target.id, numForm)
      } else {
        await createWhatsAppNumber({ ...numForm, tenant_id: tenant.id })
      }
      qc.invalidateQueries({ queryKey: NQK }); setNumModal(null)
    } catch (err: any) {
      const d = err?.response?.data
      setNumError(typeof d === 'object' ? Object.values(d).flat().join(' — ') : 'حدث خطأ')
    } finally { setNumSaving(false) }
  }

  async function handleDeleteNum(n: WhatsAppNumber) {
    if (!confirm(`حذف "${n.display_name}"؟`)) return
    await deleteWhatsAppNumber(n.id)
    qc.invalidateQueries({ queryKey: NQK })
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000)
  }

  const webhookUrl = `${WEBHOOK_BASE}/api/webhooks/whatsapp/whatsapp_cloud/`

  // ── Render ─────────────────────────────────────────────────────────────────
  const tabs: { key: DetailTab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'info',    label: 'المشترك',      icon: Info },
    { key: 'members', label: 'الأعضاء',       icon: Users,  count: members.length },
    { key: 'numbers', label: 'أرقام واتساب',  icon: Phone,  count: numbers.length },
  ]

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-500 hover:text-brand-600 bg-white hover:bg-brand-50 border border-neutral-200 transition-all shadow-card flex-shrink-0">
          <ArrowRight size={16} />
        </button>
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-card p-4 flex items-center gap-4 flex-1 overflow-hidden">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-black flex-shrink-0"
            style={{ background: `linear-gradient(135deg,${a},${b})` }}>
            {tenant.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-neutral-900 text-lg leading-tight truncate">{tenant.name}</h2>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-neutral-400" dir="ltr">{tenant.slug}</span>
              <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">
                {typeLabel[tenant.tenant_type] ?? tenant.tenant_type}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${planStyle[tenant.plan] ?? planStyle.free}`}>
                {planLabel[tenant.plan] ?? tenant.plan}
              </span>
            </div>
          </div>
          {tenant.status === 'active' ? (
            <span className="flex items-center gap-1.5 text-green-600 text-xs font-semibold bg-green-50 border border-green-200 px-2.5 py-1 rounded-full flex-shrink-0">
              <CheckCircle size={12} /> نشط
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-red-500 text-xs font-semibold bg-red-50 border border-red-200 px-2.5 py-1 rounded-full flex-shrink-0">
              <XCircle size={12} /> معلق
            </span>
          )}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-neutral-100 px-2 pt-2 gap-1">
          {tabs.map(({ key, label, icon: Icon, count }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-all ${
                tab === key
                  ? 'text-brand-600 bg-brand-50 border-b-2 border-brand-500'
                  : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
              }`}>
              <Icon size={15} />
              {label}
              {count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === key ? 'bg-brand-100 text-brand-600' : 'bg-neutral-100 text-neutral-400'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Info ─────────────────────────────────────────────────────── */}
        {tab === 'info' && (
          <div className="p-6 max-w-lg">
            <form onSubmit={handleInfoSave} className="space-y-4">
              <FLabel label="اسم المشترك" required>
                <input value={infoForm.name} required
                  onChange={e => { const name = e.target.value; setInfoForm(f => ({ ...f, name, slug: slugify(name) })) }}
                  className="input-field" />
              </FLabel>
              <FLabel label="المعرّف (Slug)" hint="حروف إنجليزية وشرطات">
                <input value={infoForm.slug} required dir="ltr"
                  onChange={e => setInfoForm(f => ({ ...f, slug: e.target.value }))}
                  className="input-field" />
              </FLabel>
              <div className="grid grid-cols-2 gap-3">
                <FLabel label="نوع المشترك">
                  <div className="relative">
                    <select value={infoForm.tenant_type}
                      onChange={e => setInfoForm(f => ({ ...f, tenant_type: e.target.value as Tenant['tenant_type'] }))}
                      className="input-field appearance-none pr-8">
                      <option value="company">شركة</option>
                      <option value="platform">منصة</option>
                      <option value="family_fund">صندوق أسرة</option>
                      <option value="other">أخرى</option>
                    </select>
                    <ChevronDown size={12} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                  </div>
                </FLabel>
                <FLabel label="الباقة">
                  <div className="relative">
                    <select value={infoForm.plan}
                      onChange={e => setInfoForm(f => ({ ...f, plan: e.target.value }))}
                      className="input-field appearance-none pr-8">
                      <option value="free">مجاني</option>
                      <option value="starter">ستارتر</option>
                      <option value="pro">احترافي</option>
                      <option value="enterprise">مؤسسي</option>
                    </select>
                    <ChevronDown size={12} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                  </div>
                </FLabel>
              </div>
              <FLabel label="الحالة">
                <div className="relative">
                  <select value={infoForm.status}
                    onChange={e => setInfoForm(f => ({ ...f, status: e.target.value as Tenant['status'] }))}
                    className="input-field appearance-none pr-8">
                    <option value="active">نشط</option>
                    <option value="suspended">معلق</option>
                  </select>
                  <ChevronDown size={12} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                </div>
              </FLabel>
              {infoError && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">⚠️ {infoError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={infoSaving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 hover:brightness-110 transition-all"
                  style={{ background: `linear-gradient(135deg,${a},${b})`, boxShadow: `0 4px 12px ${a}33` }}>
                  {infoSaving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button type="button" onClick={handleDelete}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 transition-all flex items-center gap-2">
                  <Trash2 size={14} /> حذف
                </button>
              </div>
            </form>
            <div className="mt-6 pt-4 border-t border-neutral-100 text-xs text-neutral-400 space-y-1">
              <p>أُنشئ: {new Date(tenant.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p>آخر تحديث: {new Date(tenant.updated_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        )}

        {/* ── Tab: Members ──────────────────────────────────────────────────── */}
        {tab === 'members' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-neutral-500">{members.length} عضو مسجّل في هذا المشترك</p>
              <button onClick={openAddMember}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
                style={{ background: `linear-gradient(135deg,${a},${b})`, boxShadow: `0 4px 12px ${a}33` }}>
                <UserPlus size={15} /> إضافة عضو
              </button>
            </div>

            {membersLoading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : members.length === 0 ? (
              <div className="py-16 text-center text-neutral-400">
                <Users size={36} className="mx-auto mb-3 opacity-20" />
                <p>لا يوجد أعضاء. أضف عضواً للبدء.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-neutral-100 overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2.5 bg-neutral-50 border-b border-neutral-100 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  <span className="w-10" /><span>المستخدم</span><span>الدور</span><span>إجراءات</span>
                </div>
                {members.map((m, i) => {
                  const u = allUsers.find(u => u.id === m.user)
                  const isSelf = u?.id === currentUser?.id
                  return (
                    <div key={m.id}
                      className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-4 py-3.5 hover:bg-brand-50/20 transition-colors group"
                      style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
                      <div className="relative w-10">
                        <Avatar name={m.full_name || m.username} />
                        {u && !u.is_active && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-neutral-800 text-sm truncate">{m.full_name || m.username}</span>
                          {u?.is_staff && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                              <ShieldCheck size={9} /> أدمن
                            </span>
                          )}
                          {u && !u.is_active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-500 border border-red-200">موقوف</span>}
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">@{m.username}{u?.email ? ` · ${u.email}` : ''}</p>
                      </div>
                      <div className="relative">
                        <select value={m.role}
                          onChange={e => updateMemberRole(tenant.id, m.id, e.target.value as MemberRole).then(() => qc.invalidateQueries({ queryKey: MQK }))}
                          className={`appearance-none text-xs font-bold pl-6 pr-3 py-1.5 rounded-full outline-none cursor-pointer border transition-all ${roleStyle[m.role]}`}>
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <ChevronDown size={10} className="absolute left-1.5 top-2 pointer-events-none opacity-40" />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditMember(m)} title="تعديل"
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-brand-600 hover:bg-brand-50 border border-transparent hover:border-brand-200 transition-all">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => openPwdMember(m)} title="كلمة المرور"
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-teal-600 hover:bg-teal-50 border border-transparent hover:border-teal-200 transition-all">
                          <KeyRound size={14} />
                        </button>
                        <button
                          disabled={isSelf}
                          onClick={() => u && updateUser(u.id, { is_active: !u.is_active }).then(() => qc.invalidateQueries({ queryKey: ['users'] }))}
                          title={isSelf ? 'لا يمكنك إيقاف حسابك' : u?.is_active ? 'إيقاف' : 'تفعيل'}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                          {u?.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button onClick={() => handleRemoveMember(m)} title="إزالة من المشترك"
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-300 hover:text-orange-500 hover:bg-orange-50 border border-transparent hover:border-orange-100 transition-all">
                          <UserX size={14} />
                        </button>
                        <button onClick={() => handleDeleteUser(m)} title="حذف نهائي"
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: WhatsApp Numbers ──────────────────────────────────────────── */}
        {tab === 'numbers' && (
          <div className="p-5 space-y-4">
            {/* Webhook info */}
            <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
              <p className="text-brand-700 text-xs font-bold mb-2">رابط الـ Webhook — أدخله في Meta Developer Console</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-neutral-600 text-xs font-mono bg-white border border-brand-100 px-3 py-2 rounded-lg break-all">
                  {webhookUrl}
                </code>
                <button onClick={() => copyText(webhookUrl, 'wh')}
                  className="p-2 rounded-lg text-neutral-400 hover:text-brand-600 hover:bg-white border border-transparent hover:border-brand-200 transition-all flex-shrink-0">
                  {copied === 'wh' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-500">{numbers.length} رقم مضاف لهذا المشترك</p>
              <button onClick={openAddNum}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
                style={{ background: `linear-gradient(135deg,${a},${b})`, boxShadow: `0 4px 12px ${a}33` }}>
                <Plus size={15} /> إضافة رقم
              </button>
            </div>

            {numsLoading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : numbers.length === 0 ? (
              <div className="py-14 text-center text-neutral-400">
                <Phone size={36} className="mx-auto mb-3 opacity-20" />
                <p>لا توجد أرقام واتساب لهذا المشترك.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {numbers.map(n => (
                  <div key={n.id} className="bg-neutral-50 rounded-xl border border-neutral-200 p-4 group relative hover:border-neutral-300 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Phone size={17} className="text-green-600" />
                      </div>
                      <div className="flex items-center gap-2">
                        {n.status === 'active' ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs font-semibold"><Wifi size={11} /> نشط</span>
                        ) : n.status === 'pending' ? (
                          <span className="flex items-center gap-1 text-amber-500 text-xs font-semibold"><Clock size={11} /> معلق</span>
                        ) : (
                          <span className="flex items-center gap-1 text-neutral-400 text-xs font-semibold"><WifiOff size={11} /> غير نشط</span>
                        )}
                      </div>
                    </div>
                    <h4 className="font-semibold text-neutral-800 text-sm mb-0.5">{n.display_name}</h4>
                    <p className="text-neutral-500 text-xs font-mono mb-3" dir="ltr">{n.phone_number}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="bg-neutral-200 text-neutral-500 px-2 py-0.5 rounded-full text-[11px]">
                        {n.provider === 'whatsapp_cloud' ? 'Cloud API' : n.provider === '360dialog' ? '360dialog' : 'Mock'}
                      </span>
                      {n.has_credentials ? (
                        <span className="text-green-600 text-[11px] flex items-center gap-1"><KeyRound size={10} /> مرتبط</span>
                      ) : (
                        <span className="text-amber-500 text-[11px] flex items-center gap-1"><KeyRound size={10} /> بدون مفتاح</span>
                      )}
                    </div>
                    <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button onClick={() => openEditNum(n)}
                        className="px-2 py-1 rounded-lg bg-white text-neutral-600 hover:text-brand-600 border border-neutral-200 text-xs font-medium transition-all">
                        تعديل
                      </button>
                      <button onClick={() => handleDeleteNum(n)}
                        className="p-1.5 rounded-lg bg-white text-neutral-400 hover:text-red-500 border border-neutral-200 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Members Modal ──────────────────────────────────────────────────── */}
      {mModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="h-1 sticky top-0" style={{ background: `linear-gradient(90deg,${a},${b})` }} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-neutral-900 text-lg">
                  {mModal.type === 'add' && 'إضافة عضو'}
                  {mModal.type === 'edit' && `تعديل — @${mModal.member.username}`}
                  {mModal.type === 'pwd' && `كلمة مرور — @${mModal.member.username}`}
                </h2>
                <button onClick={() => setMModal(null)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all">
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleMemberSubmit} className="space-y-4">

                {mModal.type === 'add' && (
                  <>
                    <div className="flex gap-1 p-1 bg-neutral-100 rounded-xl">
                      {(['existing', 'new'] as const).map(mode => (
                        <button key={mode} type="button" onClick={() => setAddMode(mode)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${addMode === mode ? 'bg-white shadow text-neutral-800' : 'text-neutral-500'}`}>
                          {mode === 'existing' ? 'مستخدم موجود' : 'إنشاء مستخدم جديد'}
                        </button>
                      ))}
                    </div>

                    {addMode === 'existing' ? (
                      allUsers.length === 0 ? (
                        <div className="py-4 text-center text-sm text-neutral-400 bg-neutral-50 rounded-xl border border-neutral-200">
                          لا يوجد مستخدمون في النظام.
                          <br />
                          <button type="button" onClick={() => setAddMode('new')} className="text-brand-600 font-semibold mt-1 text-xs hover:underline">
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
                                  const existing = members.find(m => m.username === e.target.value)
                                  if (existing) setPickRole(existing.role)
                                }}
                                className="input-field appearance-none pr-8">
                                <option value="">-- اختر مستخدماً --</option>
                                {allUsers.map(u => {
                                  const ex = memberByUserId.get(u.id)
                                  const lbl = ex ? ` (${ROLES.find(r => r.value === ex.role)?.label ?? ex.role})` : ''
                                  return <option key={u.id} value={u.username}>@{u.username}{u.first_name ? ` — ${u.first_name} ${u.last_name}` : ''}{lbl}</option>
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
                              <select value={pickRole} onChange={e => setPickRole(e.target.value as MemberRole)} className="input-field appearance-none pr-8">
                                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                              </select>
                              <ChevronDown size={12} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                            </div>
                          </FLabel>
                        </>
                      )
                    ) : (
                      <>
                        <FLabel label="اسم المستخدم" required>
                          <input value={newUser.username} required dir="ltr"
                            onChange={e => setNewUser(f => ({ ...f, username: e.target.value }))}
                            placeholder="username" className="input-field" />
                        </FLabel>
                        <div className="grid grid-cols-2 gap-3">
                          <FLabel label="الاسم الأول">
                            <input value={newUser.first_name} onChange={e => setNewUser(f => ({ ...f, first_name: e.target.value }))} placeholder="محمد" className="input-field" />
                          </FLabel>
                          <FLabel label="اسم العائلة">
                            <input value={newUser.last_name} onChange={e => setNewUser(f => ({ ...f, last_name: e.target.value }))} placeholder="الأحمد" className="input-field" />
                          </FLabel>
                        </div>
                        <FLabel label="البريد الإلكتروني">
                          <input value={newUser.email} type="email" dir="ltr"
                            onChange={e => setNewUser(f => ({ ...f, email: e.target.value }))} placeholder="user@example.com" className="input-field" />
                        </FLabel>
                        <FLabel label="كلمة المرور" required>
                          <input value={newUser.password} required type="password" minLength={4}
                            onChange={e => setNewUser(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" dir="ltr" className="input-field" />
                        </FLabel>
                        <div className="grid grid-cols-2 gap-3">
                          <FLabel label="الدور">
                            <div className="relative">
                              <select value={newRole} onChange={e => setNewRole(e.target.value as MemberRole)} className="input-field appearance-none pr-8">
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

                {mModal.type === 'edit' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <FLabel label="الاسم الأول">
                        <input value={editUForm.first_name} onChange={e => setEditUForm(f => ({ ...f, first_name: e.target.value }))} placeholder="محمد" className="input-field" />
                      </FLabel>
                      <FLabel label="اسم العائلة">
                        <input value={editUForm.last_name} onChange={e => setEditUForm(f => ({ ...f, last_name: e.target.value }))} placeholder="الأحمد" className="input-field" />
                      </FLabel>
                    </div>
                    <FLabel label="البريد الإلكتروني">
                      <input value={editUForm.email} type="email" dir="ltr"
                        onChange={e => setEditUForm(f => ({ ...f, email: e.target.value }))} placeholder="user@example.com" className="input-field" />
                    </FLabel>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-200 cursor-pointer">
                        <input type="checkbox" checked={editUForm.is_staff}
                          onChange={e => setEditUForm(f => ({ ...f, is_staff: e.target.checked }))}
                          className="w-4 h-4 accent-brand-600" />
                        <div>
                          <span className="font-semibold text-neutral-700 text-sm">مدير النظام</span>
                          <p className="text-xs text-neutral-400">صلاحيات كاملة</p>
                        </div>
                      </label>
                      <label className={`flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-200 ${mModal.member.user === currentUser?.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input type="checkbox" checked={editUForm.is_active}
                          disabled={mModal.member.user === currentUser?.id}
                          onChange={e => setEditUForm(f => ({ ...f, is_active: e.target.checked }))}
                          className="w-4 h-4 accent-brand-600" />
                        <div>
                          <span className="font-semibold text-neutral-700 text-sm">الحساب نشط</span>
                          {mModal.member.user === currentUser?.id && <p className="text-xs text-neutral-400">لا يمكنك إيقاف حسابك</p>}
                        </div>
                      </label>
                    </div>
                  </>
                )}

                {mModal.type === 'pwd' && (
                  <FLabel label="كلمة المرور الجديدة" required>
                    <input value={pwd} required type="password" minLength={4} autoFocus
                      onChange={e => setPwd(e.target.value)} placeholder="••••••••" dir="ltr" className="input-field" />
                  </FLabel>
                )}

                {mError && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">⚠️ {mError}</p>}

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={mSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 hover:brightness-110 transition-all"
                    style={{ background: `linear-gradient(135deg,${a},${b})`, boxShadow: `0 4px 12px ${a}33` }}>
                    {mSaving ? 'جارٍ الحفظ...' :
                      mModal.type === 'add' && addMode === 'existing' && pickUser && memberByUserId.get(allUsers.find(u => u.username === pickUser)?.id ?? -1)
                        ? 'تحديث الدور'
                        : mModal.type === 'add' ? 'إضافة'
                        : mModal.type === 'edit' ? 'حفظ التعديلات'
                        : 'تحديث كلمة المرور'}
                  </button>
                  <button type="button" onClick={() => setMModal(null)}
                    className="px-5 py-2.5 rounded-xl text-sm text-neutral-600 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 transition-all">
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── WhatsApp Number Modal ─────────────────────────────────────────── */}
      {numModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(90deg,${a},${b})` }} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-neutral-900 text-lg">
                  {numModal.mode === 'add' ? 'إضافة رقم واتساب' : 'تعديل الرقم'}
                </h2>
                <button onClick={() => setNumModal(null)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all">
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleNumSubmit} className="space-y-4">
                <FLabel label="اسم العرض" required>
                  <input value={numForm.display_name} required
                    onChange={e => setNumForm(f => ({ ...f, display_name: e.target.value }))}
                    placeholder="مثال: دعم العملاء" className="input-field" />
                </FLabel>
                <FLabel label="رقم الهاتف" required>
                  <input value={numForm.phone_number} required dir="ltr"
                    onChange={e => setNumForm(f => ({ ...f, phone_number: e.target.value }))}
                    placeholder="+966500000001" className="input-field" />
                </FLabel>
                <FLabel label="المزوّد">
                  <div className="relative">
                    <select value={numForm.provider} onChange={e => setNumForm(f => ({ ...f, provider: e.target.value }))} className="input-field appearance-none pr-8">
                      <option value="whatsapp_cloud">WhatsApp Cloud API (مجاني)</option>
                      <option value="360dialog">360dialog</option>
                      <option value="mock">Mock — تطوير فقط</option>
                    </select>
                    <ChevronDown size={12} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                  </div>
                </FLabel>
                {numForm.provider !== 'mock' && (
                  <>
                    <FLabel label="Phone Number ID" hint="من Meta Developer Console">
                      <input value={numForm.provider_phone_id} dir="ltr"
                        onChange={e => setNumForm(f => ({ ...f, provider_phone_id: e.target.value }))}
                        placeholder="123456789012345" className="input-field" />
                    </FLabel>
                    <FLabel label={numForm.provider === 'whatsapp_cloud' ? 'Access Token' : 'API Key'}
                      hint={numModal.mode === 'edit' ? 'فارغ = الإبقاء على المفتاح الحالي' : 'يُحفظ مشفّراً'}>
                      <input value={numForm.access_token} type="password" dir="ltr"
                        onChange={e => setNumForm(f => ({ ...f, access_token: e.target.value }))}
                        placeholder={numModal.mode === 'edit' ? '••••••••' : 'EAAxxxxx...'}
                        className="input-field" />
                    </FLabel>
                  </>
                )}
                <FLabel label="الحالة">
                  <div className="relative">
                    <select value={numForm.status} onChange={e => setNumForm(f => ({ ...f, status: e.target.value }))} className="input-field appearance-none pr-8">
                      <option value="active">نشط</option>
                      <option value="pending">معلق</option>
                      <option value="inactive">غير نشط</option>
                    </select>
                    <ChevronDown size={12} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                  </div>
                </FLabel>
                {numError && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">⚠️ {numError}</p>}
                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={numSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 hover:brightness-110 transition-all"
                    style={{ background: `linear-gradient(135deg,${a},${b})`, boxShadow: `0 4px 12px ${a}33` }}>
                    {numSaving ? 'جارٍ الحفظ...' : numModal.mode === 'add' ? 'إضافة الرقم' : 'حفظ التعديلات'}
                  </button>
                  <button type="button" onClick={() => setNumModal(null)}
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

// ── Root: Tenant grid ─────────────────────────────────────────────────────────

const emptyForm = { name: '', slug: '', tenant_type: 'company', status: 'active', plan: 'free' }

export function TenantsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['tenants'], queryFn: getTenants })
  const tenants = data?.data.results ?? []

  const [selected, setSelected] = useState<Tenant | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function slugify(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  function openAdd() { setForm({ ...emptyForm }); setError(''); setShowModal(true) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await createTenant(form as Partial<Tenant>)
      qc.invalidateQueries({ queryKey: ['tenants'] })
      setShowModal(false)
    } catch (err: any) {
      const d = err?.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' — ') : 'حدث خطأ')
    } finally { setSaving(false) }
  }

  if (selected) {
    return (
      <div className="p-8 min-h-full bg-ink-50">
        <div className="max-w-4xl mx-auto">
          <TenantDetail
            tenant={selected}
            onBack={() => setSelected(null)}
            onDeleted={() => setSelected(null)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 min-h-full bg-ink-50">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">المشتركون</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              {isLoading ? '...' : `${tenants.length} مشترك — انقر على أي بطاقة لإدارة أعضائها وأرقامها`}
            </p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:brightness-110 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
            <Plus size={15} /> مشترك جديد
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : tenants.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-card py-20 text-center text-neutral-400">
            <Building2 size={40} className="mx-auto mb-3 opacity-20" />
            <p>لا يوجد مشتركون. ابدأ بإضافة أول مشترك.</p>
            <button onClick={openAdd} className="mt-4 px-5 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)' }}>
              إضافة مشترك
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map(t => (
              <TenantCardWithCounts key={t.id} tenant={t} onClick={() => setSelected(t)} />
            ))}
          </div>
        )}
      </div>

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden">
            <div className="h-1" style={{ background: 'linear-gradient(90deg,#2563eb,#0891b2)' }} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-neutral-900 text-lg">مشترك جديد</h2>
                <button onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all">
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <FLabel label="اسم المشترك" required>
                  <input value={form.name} required
                    onChange={e => { const name = e.target.value; setForm(f => ({ ...f, name, slug: slugify(name) })) }}
                    placeholder="مثال: شركة نداء للتقنية" className="input-field" />
                </FLabel>
                <FLabel label="المعرّف (Slug)" hint="حروف إنجليزية وشرطات">
                  <input value={form.slug} required dir="ltr"
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                    placeholder="nada-tech" className="input-field" />
                </FLabel>
                <div className="grid grid-cols-2 gap-3">
                  <FLabel label="نوع المشترك">
                    <div className="relative">
                      <select value={form.tenant_type} onChange={e => setForm(f => ({ ...f, tenant_type: e.target.value }))} className="input-field appearance-none pr-8">
                        <option value="company">شركة</option>
                        <option value="platform">منصة</option>
                        <option value="family_fund">صندوق أسرة</option>
                        <option value="other">أخرى</option>
                      </select>
                      <ChevronDown size={12} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                    </div>
                  </FLabel>
                  <FLabel label="الباقة">
                    <div className="relative">
                      <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} className="input-field appearance-none pr-8">
                        <option value="free">مجاني</option>
                        <option value="starter">ستارتر</option>
                        <option value="pro">احترافي</option>
                        <option value="enterprise">مؤسسي</option>
                      </select>
                      <ChevronDown size={12} className="absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                    </div>
                  </FLabel>
                </div>
                {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">⚠️ {error}</p>}
                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 hover:brightness-110 active:scale-95 transition-all"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
                    {saving ? 'جارٍ الإنشاء...' : 'إنشاء المشترك'}
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
