import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  MessageSquare, BookOpen, Zap, Settings, LayoutDashboard,
  Building2, LogOut, Crown,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuthStore } from '../store/authStore'

const adminNavItems = [
  { to: '/tenants',       icon: Building2, label: 'المشتركون والأعضاء' },
  { to: '/subscriptions', icon: Crown,     label: 'الاشتراكات' },
  { to: '/settings',      icon: Settings,  label: 'الإعدادات' },
]

const roleLabels: Record<string, string> = {
  owner:  'مالك',
  admin:  'مدير',
  agent:  'وكيل',
  viewer: 'مشاهد',
}

export function Layout() {
  const { logout, user, currentTenant, currentRole, isAdmin } = useAuthStore()
  const navigate = useNavigate()
  const admin = isAdmin()

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className="w-60 flex-shrink-0 flex flex-col border-l"
        style={{
          background: 'linear-gradient(180deg, #0A1628 0%, #112447 100%)',
          borderColor: 'rgba(37,99,235,0.18)',
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(37,99,235,0.15)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-btn"
              style={{ background: 'linear-gradient(135deg, #2050B8 0%, #0891B2 100%)' }}>
              <MessageSquare size={17} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm text-white leading-tight">مركز التواصل</p>
              <p className="text-[11px] font-medium" style={{ color: '#22D3EE' }}>الذكي</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-white/25 text-[10px] font-bold tracking-widest uppercase px-3 mb-3">
            القائمة الرئيسية
          </p>

          {[
            { to: '/dashboard',     icon: LayoutDashboard, label: 'لوحة التحكم' },
            { to: '/inbox',         icon: MessageSquare,   label: 'صندوق الوارد' },
            { to: '/knowledge',     icon: BookOpen,        label: 'قاعدة المعرفة' },
            { to: '/quick-replies', icon: Zap, label: 'الردود السريعة' },
          ].map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => clsx('nav-item', isActive && 'nav-item-active')}>
              {({ isActive }) => (
                <>
                  <Icon size={16} style={isActive ? { color: '#22D3EE' } : { opacity: 0.45 }} />
                  {label}
                </>
              )}
            </NavLink>
          ))}

          {admin && (
            <>
              <p className="text-white/25 text-[10px] font-bold tracking-widest uppercase px-3 mt-4 mb-3">
                الإدارة
              </p>
              {adminNavItems.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} className={({ isActive }) => clsx('nav-item', isActive && 'nav-item-active')}>
                  {({ isActive }) => (
                    <>
                      <Icon size={16} style={isActive ? { color: '#22D3EE' } : { opacity: 0.45 }} />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User info + Logout */}
        <div className="px-3 pb-4" style={{ borderTop: '1px solid rgba(37,99,235,0.12)', paddingTop: '12px' }}>
          {user && (
            <div className="px-3 py-2 mb-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-white text-xs font-semibold truncate">{user.username}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {currentTenant && (
                  <p className="text-white/40 text-[11px] truncate flex-1">{currentTenant.name}</p>
                )}
                {currentRole && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: 'rgba(34,211,238,0.15)', color: '#22D3EE' }}>
                    {roleLabels[currentRole] ?? currentRole}
                  </span>
                )}
              </div>
            </div>
          )}
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="nav-item w-full hover:!text-red-400"
            style={{ background: 'transparent' }}
          >
            <LogOut size={16} className="opacity-50" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-ink-50">
        <Outlet />
      </main>
    </div>
  )
}
