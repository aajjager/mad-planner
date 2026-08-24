import { useEffect, useState, type FormEvent } from 'react'
import { createFamilyInvitation, getFamilySettings, listFamilyMembers, updateFamilySettings, type FamilyMember, type FamilyRole, type FamilySettings } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import './AccountPages.css'

export function FamilyPage() {
  const { account } = useAuth()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Exclude<FamilyRole, 'owner'>>('editor')
  const [inviteUrl, setInviteUrl] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [settings, setSettings] = useState<FamilySettings | null>(null)
  const [settingsSaved, setSettingsSaved] = useState(false)

  useEffect(() => { Promise.all([listFamilyMembers(), getFamilySettings()]).then(([nextMembers, nextSettings]) => { setMembers(nextMembers); setSettings(nextSettings) }).catch((reason) => setError(reason.message)) }, [])

  async function invite(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setError(''); setInviteUrl('')
    try {
      const invitation = await createFamilyInvitation(email, inviteRole)
      setInviteUrl(`${window.location.origin}/invite/${invitation.token}`)
      setEmail('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The request could not be completed.') }
    finally { setSubmitting(false) }
  }

  function toggleMealType(mealType: FamilySettings['enabled_meal_types'][number]) {
    if (!settings) return
    const current = settings.enabled_meal_types
    if (current.includes(mealType) && current.length === 1) return
    setSettings({ ...settings, enabled_meal_types: current.includes(mealType) ? current.filter((item) => item !== mealType) : [...current, mealType] })
    setSettingsSaved(false)
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault()
    if (!settings) return
    setSubmitting(true); setError(''); setSettingsSaved(false)
    try { setSettings(await updateFamilySettings(settings)); setSettingsSaved(true) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The settings could not be saved.') }
    finally { setSubmitting(false) }
  }

  return <section className="page family-page">
    <div className="page-heading"><div><p className="eyebrow">Shared household</p><h1>{account?.family_name}</h1><p>Everyone listed here shares this recipe library, planner, and grocery list.</p></div></div>
    {settings && <section className="family-panel family-settings"><h2>Family options</h2><p>These defaults apply to everyone in the family and control the weekly planner.</p><form onSubmit={saveSettings}><label className="field field--small"><span>People in the household</span><input type="number" min="1" max="50" value={settings.household_size} disabled={account?.role !== 'owner'} onChange={(event) => { setSettings({ ...settings, household_size: Number(event.target.value) }); setSettingsSaved(false) }} /></label><div className="field"><span>Meals included in the planner</span><div className="choice-chips">{(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => <button key={mealType} type="button" className={`choice-chip${settings.enabled_meal_types.includes(mealType) ? ' choice-chip--selected' : ''}`} aria-pressed={settings.enabled_meal_types.includes(mealType)} disabled={account?.role !== 'owner'} onClick={() => toggleMealType(mealType)}>{mealType}</button>)}</div><small>At least one meal must stay enabled.</small></div><label className="setting-toggle"><input type="checkbox" checked={settings.leftovers_enabled} disabled={account?.role !== 'owner'} onChange={(event) => { setSettings({ ...settings, leftovers_enabled: event.target.checked }); setSettingsSaved(false) }} /><span><strong>Plan leftovers</strong><small>Allow extra portions to become a later lunch.</small></span></label><label className="setting-toggle"><input type="checkbox" checked={settings.cooking_mode_enabled} disabled={account?.role !== 'owner'} onChange={(event) => { setSettings({ ...settings, cooking_mode_enabled: event.target.checked }); setSettingsSaved(false) }} /><span><strong>Cooking mode</strong><small>Allow recipe steps to be checked off while cooking.</small></span></label>{account?.role === 'owner' && <button className="button button--primary" disabled={submitting}>{submitting ? 'Saving…' : 'Save family options'}</button>}{settingsSaved && <span className="settings-saved" role="status">Family options saved.</span>}</form></section>}
    <div className="family-grid">
      <section className="family-panel"><h2>Family members</h2><div className="member-list">{members.map((member) => <article key={member.id}><span className="member-avatar">{member.display_name.charAt(0).toUpperCase()}</span><div><strong>{member.display_name}</strong><small>{member.email}</small></div><span className="tag">{member.role}</span></article>)}</div></section>
      {account?.role === 'owner' && <section className="family-panel"><h2>Invite someone</h2><p>We’ll create a private link you can send to this person. It expires after seven days.</p><form onSubmit={invite}><label className="field"><span>Email address</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field"><span>Permission</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Exclude<FamilyRole, 'owner'>)}><option value="editor">Editor — recipes, planner, groceries</option><option value="planner">Planner — planner and groceries</option><option value="viewer">Viewer — read only</option></select></label><button className="button button--primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create invitation'}</button></form>{inviteUrl && <div className="invite-result"><strong>Invitation ready</strong><input aria-label="Invitation link" readOnly value={inviteUrl} /><button className="button" onClick={() => navigator.clipboard.writeText(inviteUrl)}>Copy link</button></div>}{error && <div className="notice notice--error" role="alert">{error}</div>}</section>}
    </div>
  </section>
}
