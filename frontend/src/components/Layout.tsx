import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  MessageSquare, BookOpen, Zap, Settings, LayoutDashboard,
  Building2, Phone, LogOut,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuthStore } from '../store/authStore'

const navItems = [
  { to: '/dashboard',        icon: LayoutDashboard, label: 'لوحة التحكم' },
  { to: '/inbox',            icon: MessageSquare,   label: 'صندوق الوارد' },
  { to: '/knowledge',        icon: BookOpen,        label: 'قاعدة المعرفة' },
  { to: '/quick-replies',    icon: Zap,             label: 'الردود السريعة' },
  { to: '/whatsapp-numbers', icon: Phone,           label: 'أرقام واتساب' },
  { to: '/tenants',          icon: Building2,       label: 'المستأجرون' },
  { to: '/settings',         icon: Settings,        label: 'الإعدادات' },
]

export function Layout() {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

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
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx('nav-item', isActive && 'nav-item-active')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} style={isActive ? { color: '#22D3EE' } : { opacity: 0.45 }} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-4" style={{ borderTop: '1px solid rgba(37,99,235,0.12)', paddingTop: '12px' }}>
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
