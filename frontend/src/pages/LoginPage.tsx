import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Eye, EyeOff, Wifi, Shield, Zap, Bot } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

const features = [
  { icon: MessageSquare, label: 'صندوق وارد موحّد' },
  { icon: Bot,           label: 'ردود تلقائية ذكية' },
  { icon: Wifi,          label: 'تحديثات فورية (WebSocket)' },
  { icon: Shield,        label: 'عزل كامل بين المستأجرين' },
  { icon: Zap,           label: 'قاعدة معرفة + FAQ' },
]

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass]  = useState(false)
  const [error, setError]        = useState('')
  const [loading, setLoading]    = useState(false)
  const login    = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/dashboard')
    } catch {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — wasal brand gradient ───────────────────── */}
      <div className="hidden lg:flex lg:w-[48%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0D1B35 0%, #1A3080 45%, #0891B2 100%)' }}
      >
        {/* decorative circles */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)', transform: 'translate(-40%, -40%)' }} />
        <div className="absolute bottom-0 right-0 w-[350px] h-[350px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(8,145,178,0.20) 0%, transparent 70%)', transform: 'translate(30%, 30%)' }} />

        {/* Logo */}
        <div className="flex items-center gap-3 relative">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-white/15 backdrop-blur-sm">
            <MessageSquare size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base">مركز التواصل الذكي</p>
            <p className="text-white/60 text-xs">Smart Communication Center</p>
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-6 relative">
          <div className="space-y-3">
            <span className="text-xs font-bold tracking-widest uppercase text-white/50">منصة SaaS</span>
            <h1 className="text-4xl font-bold text-white leading-snug">
              أدِر قنوات واتساب<br />
              <span className="text-amber-300">بكفاءة عالية</span>
            </h1>
            <p className="text-white/55 text-base leading-relaxed">
              حلول متكاملة لإدارة المحادثات، قاعدة المعرفة، والردود التلقائية — لأكثر من مستأجر.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-2.5">
            {features.map(({ icon: Icon, label }) => (
              <div key={label}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-white/15">
                  <Icon size={14} className="text-white" />
                </div>
                <span className="text-white/80 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/25 text-xs relative">Smart Communication Center © 2025</p>
      </div>

      {/* ── Right panel — light login form ──────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-ink-50">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3"
              style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #0891B2 100%)' }}>
              <MessageSquare size={22} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-neutral-900">مركز التواصل الذكي</h1>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-neutral-900">مرحباً بعودتك</h2>
            <p className="text-neutral-500 text-sm mt-1">سجّل دخولك للوصول إلى لوحة التحكم</p>
          </div>

          {/* White card form */}
          <div className="card p-7">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                  اسم المستخدم
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field"
                  placeholder="admin"
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-10"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl text-red-700 text-sm flex items-center gap-2
                  bg-red-50 border border-red-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
