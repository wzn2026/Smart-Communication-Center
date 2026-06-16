import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { LandingPage } from './pages/LandingPage'
import { DashboardPage } from './pages/DashboardPage'
import { InboxPage } from './pages/InboxPage'
import { KnowledgePage } from './pages/KnowledgePage'
import { QuickRepliesPage } from './pages/QuickRepliesPage'
import { TenantsPage } from './pages/TenantsPage'
import { SettingsPage } from './pages/SettingsPage'
import { SubscriptionsPage } from './pages/SubscriptionsPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const isAdmin = useAuthStore((s) => s.isAdmin)
  return isAdmin() ? <>{children}</> : <Navigate to="/dashboard" replace />
}

export default function App() {
  const init = useAuthStore((s) => s.init)
  useEffect(() => { init() }, [])

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Protected — pathless layout wrapper */}
      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/dashboard"     element={<DashboardPage />} />
        <Route path="/inbox"         element={<InboxPage />} />
        <Route path="/knowledge"     element={<KnowledgePage />} />
        <Route path="/quick-replies" element={<QuickRepliesPage />} />
        <Route path="/tenants"       element={<AdminRoute><TenantsPage /></AdminRoute>} />
        <Route path="/subscriptions" element={<AdminRoute><SubscriptionsPage /></AdminRoute>} />
        <Route path="/settings"      element={<AdminRoute><SettingsPage /></AdminRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
