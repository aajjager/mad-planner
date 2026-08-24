export type FamilyRole = 'owner' | 'editor' | 'planner' | 'viewer'

export interface Account {
  id: number
  email: string
  display_name: string
  family_id: number
  family_name: string
  role: FamilyRole
  locale: 'en' | 'da' | 'nl'
}

export interface FamilyMember {
  id: number
  email: string
  display_name: string
  role: FamilyRole
  active_sessions: number
}

export interface ManagedInvitation { id: number; intended_email: string; expires_at: string; role: FamilyRole }
export interface RecipeType { id: number; name: string; meal_type: 'breakfast' | 'lunch' | 'dinner' | null }
export interface FamilySettings {
  household_size: number
  leftovers_enabled: boolean
  cooking_mode_enabled: boolean
  enabled_meal_types: Array<'breakfast' | 'lunch' | 'dinner'>
}

export interface Invitation {
  token: string
  family_name: string
  intended_email: string
  expires_at: string
  role: FamilyRole
}

export interface InvitationPreview {
  family_name: string
  intended_email: string
  expires_at: string
  role: FamilyRole
}

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new ApiError(typeof payload?.detail === 'string' ? payload.detail : 'The request could not be completed.', response.status)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

const jsonOptions = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const getSetupStatus = () => request<{ setup_required: boolean }>('/api/v1/auth/status')
export const getCurrentAccount = () => request<Account>('/api/v1/auth/me')
export const setupOwner = (data: { email: string; display_name: string; password: string; family_name: string }) => request<Account>('/api/v1/auth/setup', jsonOptions('POST', data))
export const login = (data: { email: string; password: string }) => request<Account>('/api/v1/auth/login', jsonOptions('POST', data))
export const logout = () => request<void>('/api/v1/auth/logout', { method: 'POST' })
export const listFamilyMembers = () => request<FamilyMember[]>('/api/v1/auth/family/members')
export const createFamilyInvitation = (email: string, role: Exclude<FamilyRole, 'owner'>) => request<Invitation>('/api/v1/auth/family/invitations', jsonOptions('POST', { email, role }))
export const getInvitation = (token: string) => request<InvitationPreview>(`/api/v1/auth/invitations/${encodeURIComponent(token)}`)
export const acceptInvitation = (token: string, data: { display_name: string; password: string }) => request<Account>(`/api/v1/auth/invitations/${encodeURIComponent(token)}/accept`, jsonOptions('POST', data))
export const listManagedInvitations = () => request<ManagedInvitation[]>('/api/v1/auth/admin/invitations')
export const revokeInvitation = (id: number) => request<void>(`/api/v1/auth/admin/invitations/${id}`, { method: 'DELETE' })
export const revokeMemberSessions = (id: number) => request<void>(`/api/v1/auth/admin/members/${id}/revoke-sessions`, { method: 'POST' })
export const removeFamilyMember = (id: number) => request<void>(`/api/v1/auth/admin/members/${id}`, { method: 'DELETE' })
export const getFamilySettings = () => request<FamilySettings>('/api/v1/auth/family/settings')
export const updateFamilySettings = (settings: FamilySettings) => request<FamilySettings>('/api/v1/auth/family/settings', jsonOptions('PUT', settings))
export const updateFamilyMemberRole = (id: number, role: Exclude<FamilyRole, 'owner'>) => request<FamilyMember>(`/api/v1/auth/admin/members/${id}/role`, jsonOptions('PATCH', { role }))
export const listRecipeTypes = () => request<RecipeType[]>('/api/v1/auth/family/recipe-types')
export const createRecipeType = (name: string, meal_type: RecipeType['meal_type']) => request<RecipeType>('/api/v1/auth/family/recipe-types', jsonOptions('POST', { name, meal_type }))
export const deleteRecipeType = (id: number) => request<void>(`/api/v1/auth/family/recipe-types/${id}`, { method: 'DELETE' })
export const updatePersonalLocale = (locale: Account['locale']) => request<Account>('/api/v1/auth/me/preferences', jsonOptions('PATCH', { locale }))
