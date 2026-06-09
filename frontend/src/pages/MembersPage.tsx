import { useEffect, useState } from 'react'
import { UserPlus, Trash2, RefreshCw, Users, Building2, ChevronDown } from 'lucide-react'
import { getTenantMembers, addTenantMember, removeTenantMember, updateMemberRole } from '../api'
import { useAuthStore } from '../store/authStore'
import type { TenantMembership, MemberRole, Tenant } from '../types'

const ROLES: { value: MemberRole; label: string }[] = [
  { value: 'owner',  label: 'مالك'   },
  { value: 'admin',  label: 'مدير'   },
  { value: 'agent',  label: 'وكيل'   },
  { value: 'viewer', label: 'مشاهد'  },
]

const roleStyle: Record<MemberRole, string> = {
  owner:  'bg-amber-100  text-amber-700  border border-amber-200',
  admin:  'bg-blue-100   text-blue-700   border border-blue-200',
  agent:  'bg-teal-100   text-teal-700   border border-teal-200',
  viewer: 'bg-neutral-100 text-neutral-500 border border-neutral-200',
}

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
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      {(name || '؟').charAt(0).toUpperCase()}
    </div>
  )
}

export function MembersPage() {
  const { tenants: allTenants, user } = useAuthStore()

  // admin sees all tenants; others see only their own
  const tenantList: Tenant[] = user?.is_staff
    ? allTenants.map(e => e.tenant)
    : allTenants.map(e => e.tenant)

  const [selectedTenantId, setSelectedTenantId] = useState<string>('')
  const [members, setMembers]   = useState<TenantMembership[]>([])
  const [loading, setLoading]   = useState(false)
  const [username, setUsername] = useState('')
  const [role, setRole]         = useState<MemberRole>('agent')
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)

  // Set default tenant when list loads
  useEffect(() => {
    if (tenantList.length > 0 && !selectedTenantId) {
      setSelectedTenantId(tenantList[0].id)
    }
  }, [tenantList.length])

  useEffect(() => {
    if (selectedTenantId) load()
  }, [selectedTenantId])

  const selectedTenant = tenantList.find(t => t.id === selectedTenantId)

  async function load() {
    if (!selectedTenantId) return
    setLoading(true)
    try { const { data } = await getTenantMembers(selectedTenantId); setMembers(data) }
    finally { setLoading(false) }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTenantId || !username.trim()) return
    setSaving(true); setError('')
    try {
      await addTenantMember(selectedTenantId, username.trim(), role)
      setUsername(''); await load()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'اسم المستخدم غير موجود')
    } finally { setSaving(false) }
  }

  async function handleRoleChange(m: TenantMembership, newRole: MemberRole) {
    if (!selectedTenantId) return
    await updateMemberRole(selectedTenantId, m.id, newRole)
    setMembers(prev => prev.map(x => x.id === m.id ? { ...x, role: newRole } : x))
  }

  async function handleRemove(m: TenantMembership) {
    if (!selectedTenantId || !confirm(`حذف "${m.full_name}"؟`)) return
    await removeTenantMember(selectedTenantId, m.id)
    setMembers(prev => prev.filter(x => x.id !== m.id))
  }

  return (
    <div className="p-8 min-h-full bg-ink-50">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">إدارة الأعضاء</h1>
            <p className="text-sm text-neutral-500 mt-0.5">إدارة أعضاء كل مستأجر وصلاحياتهم</p>
          </div>
          <button onClick={load}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-400 hover:text-brand-600 bg-white hover:bg-brand-50 border border-neutral-200 transition-all shadow-card">
            <RefreshCw size={15} />
          </button>
        </div>

        {/* ── Tenant selector ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-card p-4">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Building2 size={13} /> اختر المستأجر
          </p>
          <div className="flex gap-2 flex-wrap">
            {tenantList.map(t => (
              <button key={t.id} onClick={() => setSelectedTenantId(t.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={selectedTenantId === t.id
                  ? { background: 'linear-gradient(135deg,#2563eb,#0891b2)', color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }
                  : { background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }
                }>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: selectedTenantId === t.id ? 'rgba(255,255,255,0.2)' : `linear-gradient(135deg,${getGradient(t.name)[0]},${getGradient(t.name)[1]})` }}>
                  {t.name.charAt(0)}
                </div>
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {selectedTenant && (
          <>
            {/* ── Add member ──────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-card-md overflow-hidden">
              <div className="h-1" style={{ background: 'linear-gradient(90deg,#2563eb,#0891b2)' }} />
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)' }}>
                    <UserPlus size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-800 text-sm">إضافة عضو</p>
                    <p className="text-xs text-neutral-400">{selectedTenant.name}</p>
                  </div>
                </div>

                <form onSubmit={handleAdd} className="flex gap-2.5">
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="اسم المستخدم"
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm text-neutral-800 placeholder-neutral-400 outline-none bg-neutral-50 border border-neutral-200 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 transition-all"
                  />
                  <div className="relative">
                    <select value={role} onChange={e => setRole(e.target.value as MemberRole)}
                      className="appearance-none pl-7 pr-4 py-2.5 rounded-xl text-sm font-medium text-neutral-700 bg-neutral-50 border border-neutral-200 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all cursor-pointer">
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute left-2 top-3 text-neutral-400 pointer-events-none" />
                  </div>
                  <button type="submit" disabled={saving || !username.trim()}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 active:scale-95 transition-all"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
                    {saving ? '...' : 'إضافة'}
                  </button>
                </form>

                {error && (
                  <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                    ⚠️ {error}
                  </p>
                )}
              </div>
            </div>

            {/* ── Members list ────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-card-md overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-50 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-brand-600" />
                  <span className="font-semibold text-neutral-700 text-sm">
                    أعضاء — {selectedTenant.name}
                  </span>
                </div>
                {!loading && (
                  <span className="text-xs bg-brand-100 text-brand-700 font-semibold px-2.5 py-1 rounded-full">
                    {members.length}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center gap-3 text-neutral-400">
                  <div className="w-7 h-7 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
                  <span className="text-sm">جارٍ التحميل...</span>
                </div>
              ) : members.length === 0 ? (
                <div className="py-12 text-center text-neutral-400">
                  <Users size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">لا يوجد أعضاء</p>
                </div>
              ) : (
                <ul>
                  {members.map((m, i) => (
                    <li key={m.id}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-brand-50/50 transition-colors group"
                      style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>

                      <Avatar name={m.full_name || m.username} />

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-neutral-800 text-sm truncate">{m.full_name}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">@{m.username}</p>
                      </div>

                      <div className="relative">
                        <select value={m.role}
                          onChange={e => handleRoleChange(m, e.target.value as MemberRole)}
                          className={`appearance-none text-xs font-bold pl-6 pr-3 py-1.5 rounded-full outline-none cursor-pointer transition-all ${roleStyle[m.role]}`}>
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <ChevronDown size={10} className="absolute left-1.5 top-2 pointer-events-none opacity-40" />
                      </div>

                      <button onClick={() => handleRemove(m)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
