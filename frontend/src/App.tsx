import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { InboxPage } from './pages/InboxPage'
import { KnowledgePage } from './pages/KnowledgePage'
import { QuickRepliesPage } from './pages/QuickRepliesPage'
import { WhatsAppNumbersPage } from './pages/WhatsAppNumbersPage'
import { TenantsPage } from './pages/TenantsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TeamPage } from './pages/TeamPage'
import { SubscriptionsPage } from './pages/SubscriptionsPage'
import { PricingPage } from './pages/PricingPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
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
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="quick-replies" element={<QuickRepliesPage />} />
        <Route path="whatsapp-numbers" element={<AdminRoute><WhatsAppNumbersPage /></AdminRoute>} />
        <Route path="tenants" element={<AdminRoute><TenantsPage /></AdminRoute>} />
        <Route path="team" element={<AdminRoute><TeamPage /></AdminRoute>} />
        <Route path="subscriptions" element={<AdminRoute><SubscriptionsPage /></AdminRoute>} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
