import { create } from 'zustand'
import { login as apiLogin } from '../api'

interface AuthState {
  isAuthenticated: boolean
  user: { username: string; is_staff: boolean } | null
  currentTenant: { id: string; name: string; slug: string } | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  setTenant: (tenant: { id: string; name: string; slug: string }) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!localStorage.getItem('access_token'),
  user: null,
  currentTenant: null,

  login: async (username, password) => {
    const { data } = await apiLogin(username, password)
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    set({ isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ isAuthenticated: false, user: null, currentTenant: null })
  },

  setTenant: (tenant) => set({ currentTenant: tenant }),
}))
