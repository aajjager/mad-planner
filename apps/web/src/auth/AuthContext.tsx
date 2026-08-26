import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, completeMfaLogin as completeMfaLoginRequest, confirmMfaEnrollment as confirmMfaRequest, disableMfa as disableMfaRequest, getCurrentAccount, getSetupStatus, login as loginRequest, logout as logoutRequest, setupOwner as setupRequest, startMfaEnrollment as startMfaRequest, updatePersonalPreferences, type Account, type MfaChallenge, type MfaEnrollment } from '../api/auth'
import { rememberLocale } from '../i18n'

interface AuthValue {
  account: Account | null
  loading: boolean
  setupRequired: boolean
  login: (email: string, password: string) => Promise<MfaChallenge | null>
  completeMfaLogin: (challengeToken: string, code: string) => Promise<void>
  startMfaEnrollment: () => Promise<MfaEnrollment>
  confirmMfaEnrollment: (code: string) => Promise<string[]>
  disableMfa: (password: string) => Promise<void>
  setupOwner: (data: { email: string; display_name: string; password: string; family_name: string }) => Promise<void>
  acceptAccount: (account: Account) => void
  logout: () => Promise<void>
  setLocale: (locale: Account['locale']) => Promise<void>
  setShowNutrition: (show: boolean) => Promise<void>
  setBrowserNotifications: (enabled: boolean) => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [setupRequired, setSetupRequired] = useState(false)

  useEffect(() => {
    getSetupStatus()
      .then(async ({ setup_required }) => {
        setSetupRequired(setup_required)
        if (!setup_required) {
          try { setAccount(await getCurrentAccount()) }
          catch (error) { if (!(error instanceof ApiError) || error.status !== 401) throw error }
        }
      })
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { if (account?.locale) rememberLocale(account.locale) }, [account?.locale])

  const value: AuthValue = {
    account,
    loading,
    setupRequired,
    login: async (email, password) => { const result = await loginRequest({ email, password }); if ('mfa_required' in result) return result; setAccount(result); return null },
    completeMfaLogin: async (challengeToken, code) => { setAccount(await completeMfaLoginRequest(challengeToken, code)) },
    startMfaEnrollment: startMfaRequest,
    confirmMfaEnrollment: async (code) => { const result = await confirmMfaRequest(code); setAccount(await getCurrentAccount()); return result.recovery_codes },
    disableMfa: async (password) => { setAccount(await disableMfaRequest(password)) },
    setupOwner: async (data) => { setAccount(await setupRequest(data)); setSetupRequired(false) },
    acceptAccount: (nextAccount) => { setAccount(nextAccount); setSetupRequired(false) },
    logout: async () => { await logoutRequest(); setAccount(null) },
    setLocale: async (locale) => { setAccount(await updatePersonalPreferences({ locale })) },
    setShowNutrition: async (show) => { setAccount(await updatePersonalPreferences({ show_nutrition: show })) },
    setBrowserNotifications: async (enabled) => { setAccount(await updatePersonalPreferences({ browser_notifications_enabled: enabled })) },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components -- Provider and its typed hook form one module.
export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
