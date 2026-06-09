import { create } from 'zustand'
import { login as apiLogin, getMe } from '../api'
import type { UserInfo, MemberRole, Tenant } from '../types'

interface TenantEntry {
  tenant: Tenant
  role: MemberRole
}

interface AuthState {
  isAuthenticated: boolean
  user: UserInfo | null
  tenants: TenantEntry[]
  currentTenant: Tenant | null
  currentRole: MemberRole | null
  init: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  setTenant: (tenant: Tenant) => void
  isAdmin: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: !!localStorage.getItem('access_token'),
  user: null,
  tenants: [],
  currentTenant: null,
  currentRole: null,

  init: async () => {
    if (!localStorage.getItem('access_token')) return
    try {
      const meRes = await getMe()
      const me = meRes.data
      const firstTenant = me.tenants[0] ?? null
      set({
        isAuthenticated: true,
        user: me.user,
        tenants: me.tenants,
        currentTenant: firstTenant?.tenant ?? null,
        currentRole: firstTenant?.role ?? null,
      })
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      set({ isAuthenticated: false, user: null, tenants: [], currentTenant: null, currentRole: null })
    }
  },

  login: async (username, password) => {
    const { data } = await apiLogin(username, password)
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)

    const meRes = await getMe()
    const me = meRes.data
    const firstTenant = me.tenants[0] ?? null

    set({
      isAuthenticated: true,
      user: me.user,
      tenants: me.tenants,
      currentTenant: firstTenant?.tenant ?? null,
      currentRole: firstTenant?.role ?? null,
    })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ isAuthenticated: false, user: null, tenants: [], currentTenant: null, currentRole: null })
  },

  setTenant: (tenant) => {
    const entry = get().tenants.find((t) => t.tenant.id === tenant.id)
    set({ currentTenant: tenant, currentRole: entry?.role ?? null })
  },

  isAdmin: () => {
    const { user, currentRole } = get()
    return !!(user?.is_staff || currentRole === 'owner' || currentRole === 'admin')
  },
}))
