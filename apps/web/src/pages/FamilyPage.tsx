import { useEffect, useState, type FormEvent } from 'react'
import { createFamilyInvitation, createRecipeType, deleteRecipeType, getFamilySettings, listFamilyMembers, listRecipeTypes, updateFamilySettings, type FamilyMember, type FamilyRole, type FamilySettings, type RecipeType } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { MfaSettings } from '../components/MfaSettings'
import { enableBrowserNotifications, notificationsSupported } from '../notifications'
import './AccountPages.css'

export function FamilyPage() {
  const { account, setLocale, setShowNutrition, setBrowserNotifications } = useAuth()
  const t = translator(account?.locale)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Exclude<FamilyRole, 'owner'>>('editor')
  const [inviteUrl, setInviteUrl] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [settings, setSettings] = useState<FamilySettings | null>(null)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [recipeTypes, setRecipeTypes] = useState<RecipeType[]>([])
  const [typeName, setTypeName] = useState('')
  const [typeMeal, setTypeMeal] = useState<RecipeType['meal_type']>(null)
  const [localeSaved, setLocaleSaved] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')

  async function changeBrowserNotifications(enabled: boolean) {
    setError(''); setNotificationMessage('')
    try {
      if (enabled && !(await enableBrowserNotifications())) {
        setNotificationMessage(notificationsSupported() ? t('notificationsDenied') : t('notificationsNeedHttps'))
        return
      }
      await setBrowserNotifications(enabled)
      setNotificationMessage(enabled ? t('notificationsEnabled') : t('notificationsDisabled'))
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('settingsSaveFailed')) }
  }

  useEffect(() => { Promise.all([listFamilyMembers(), getFamilySettings(), listRecipeTypes()]).then(([nextMembers, nextSettings, nextTypes]) => { setMembers(nextMembers); setSettings(nextSettings); setRecipeTypes(nextTypes) }).catch((reason) => setError(reason.message)) }, [])

  async function invite(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setError(''); setInviteUrl('')
    try {
      const invitation = await createFamilyInvitation(email, inviteRole)
      setInviteUrl(`${window.location.origin}/invite/${invitation.token}`)
      setEmail('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) }
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
    catch (reason) { setError(reason instanceof Error ? reason.message : t('settingsSaveFailed')) }
    finally { setSubmitting(false) }
  }

  async function addRecipeType(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setError('')
    try { const created = await createRecipeType(typeName.trim(), typeMeal); setRecipeTypes((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name))); setTypeName(''); setTypeMeal(null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('typeAddFailed')) }
    finally { setSubmitting(false) }
  }

  async function removeRecipeType(item: RecipeType) {
    if (!window.confirm(`Remove the recipe type “${item.name}”?`)) return
    setError('')
    try { await deleteRecipeType(item.id); setRecipeTypes((current) => current.filter((value) => value.id !== item.id)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('typeRemoveFailed')) }
  }

  return <section className="page family-page">
    <div className="page-heading"><div><p className="eyebrow">{t('sharedHousehold')}</p><h1>{account?.family_name}</h1><p>{t('sharedHouseholdIntro')}</p></div></div>
    <section className="family-panel personal-settings"><div className="personal-settings__intro"><h2>{t('personalSettings')}</h2><p>{t('personalLanguageHelp')}</p></div><div className="personal-settings__controls"><label className="field"><span>{t('appLanguage')}</span><select value={account?.locale || 'en'} onChange={async (event) => { setLocaleSaved(false); setError(''); try { await setLocale(event.target.value as 'en' | 'da' | 'nl'); setLocaleSaved(true) } catch (reason) { setError(reason instanceof Error ? reason.message : t('settingsSaveFailed')) } }}><option value="en">English</option><option value="da">Dansk</option><option value="nl">Nederlands</option></select></label><label className="setting-toggle"><input type="checkbox" checked={account?.show_nutrition ?? true} onChange={async (event) => { setError(''); try { await setShowNutrition(event.target.checked) } catch (reason) { setError(reason instanceof Error ? reason.message : t('settingsSaveFailed')) } }} /><span><strong>{t('showNutrition')}</strong><small>{t('showNutritionHelp')}</small></span></label><label className="setting-toggle"><input type="checkbox" checked={account?.browser_notifications_enabled ?? false} onChange={(event) => void changeBrowserNotifications(event.target.checked)} /><span><strong>{t('phoneNotifications')}</strong><small>{t('phoneNotificationsHelp')}</small></span></label>{localeSaved && <span className="settings-saved" role="status">{t('languageSaved')}</span>}{notificationMessage && <span className="settings-message" role="status">{notificationMessage}</span>}</div></section>
    <MfaSettings />
    {settings && <section className="family-panel family-settings">
      <header><h2>{t('familyOptions')}</h2><p>{t('familyOptionsHelp')}</p></header>
      <form onSubmit={saveSettings}>
        <div className="setting-row"><div className="setting-row__label"><strong>{t('householdPeople')}</strong><small>{t('householdPeopleHelp')}</small></div><div className="setting-row__control"><input aria-label={t('householdPeople')} type="number" min="1" max="50" value={settings.household_size} disabled={account?.role !== 'owner'} onChange={(event) => { setSettings({ ...settings, household_size: Number(event.target.value) }); setSettingsSaved(false) }} /></div></div>
        <div className="setting-row"><div className="setting-row__label"><strong>{t('plannerMeals')}</strong><small>{t('oneMealRequired')}</small></div><div className="setting-row__control choice-chips">{(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => <button key={mealType} type="button" className={`choice-chip${settings.enabled_meal_types.includes(mealType) ? ' choice-chip--selected' : ''}`} aria-pressed={settings.enabled_meal_types.includes(mealType)} disabled={account?.role !== 'owner'} onClick={() => toggleMealType(mealType)}>{t(mealType)}</button>)}</div></div>
        <label className="setting-row"><span className="setting-row__label"><strong>{t('planLeftovers')}</strong><small>{t('planLeftoversHelp')}</small></span><span className="setting-row__control"><input className="switch-input" type="checkbox" checked={settings.leftovers_enabled} disabled={account?.role !== 'owner'} onChange={(event) => { setSettings({ ...settings, leftovers_enabled: event.target.checked }); setSettingsSaved(false) }} /></span></label>
        <label className="setting-row"><span className="setting-row__label"><strong>{t('cookingMode')}</strong><small>{t('cookingModeHelp')}</small></span><span className="setting-row__control"><input className="switch-input" type="checkbox" checked={settings.cooking_mode_enabled} disabled={account?.role !== 'owner'} onChange={(event) => { setSettings({ ...settings, cooking_mode_enabled: event.target.checked }); setSettingsSaved(false) }} /></span></label>
        <label className="setting-row"><span className="setting-row__label"><strong>{t('planReminders')}</strong><small>{t('planRemindersHelp')}</small></span><span className="setting-row__control"><input className="switch-input" type="checkbox" checked={settings.plan_reminders_enabled ?? true} disabled={account?.role !== 'owner'} onChange={(event) => { setSettings({ ...settings, plan_reminders_enabled: event.target.checked }); setSettingsSaved(false) }} /></span></label>
        <div className="setting-row"><div className="setting-row__label"><strong>{t('reminderHorizon')}</strong><small>{t('reminderHorizonHelp')}</small></div><div className="setting-row__control"><select aria-label={t('reminderHorizon')} value={settings.plan_reminder_weeks ?? 1} disabled={account?.role !== 'owner' || !settings.plan_reminders_enabled} onChange={(event) => { setSettings({ ...settings, plan_reminder_weeks: Number(event.target.value) }); setSettingsSaved(false) }}>{[1, 2, 3, 4].map((weeks) => <option value={weeks} key={weeks}>{weeks} {weeks === 1 ? t('week') : t('weeks')}</option>)}</select></div></div>
        <footer>{settingsSaved && <span className="settings-saved" role="status">{t('familyOptionsSaved')}</span>}{account?.role === 'owner' && <button className="button button--primary" disabled={submitting}>{submitting ? t('saving') : t('saveFamilyOptions')}</button>}</footer>
      </form>
    </section>}
    <section className="family-panel recipe-type-panel"><h2>{t('recipeTypes')}</h2><p>{t('recipeTypesHelp')}</p><div className="recipe-type-list">{recipeTypes.map((item) => <span className="recipe-type-item" key={item.id}><strong>{item.name}</strong><small>{item.meal_type ? t(item.meal_type) : t('noPlannerMeal')}</small>{account?.role === 'owner' && <button type="button" aria-label={`${t('remove')} ${item.name}`} onClick={() => removeRecipeType(item)}>×</button>}</span>)}</div>{account?.role === 'owner' && <form className="recipe-type-form" onSubmit={addRecipeType}><label className="field"><span>{t('newRecipeType')}</span><input required maxLength={60} value={typeName} onChange={(event) => setTypeName(event.target.value)} placeholder="Soup" /></label><label className="field"><span>{t('plannerMealOptional')}</span><select value={typeMeal || ''} onChange={(event) => setTypeMeal((event.target.value || null) as RecipeType['meal_type'])}><option value="">{t('none')}</option><option value="breakfast">{t('breakfast')}</option><option value="lunch">{t('lunch')}</option><option value="dinner">{t('dinner')}</option></select></label><button className="button button--primary" disabled={submitting || !typeName.trim()}>{t('addType')}</button></form>}{error && <div className="notice notice--error" role="alert">{error}</div>}</section>
    <div className="family-grid">
      <section className="family-panel"><h2>{t('familyMembers')}</h2><div className="member-list">{members.map((member) => <article key={member.id}><span className="member-avatar">{member.display_name.charAt(0).toUpperCase()}</span><div><strong>{member.display_name}</strong><small>{member.email}</small></div><span className="tag">{member.role === 'owner' ? t('owner') : member.role === 'editor' ? t('editor') : member.role === 'planner' ? t('plannerRole') : t('viewer')}</span></article>)}</div></section>
      {account?.role === 'owner' && <section className="family-panel"><h2>{t('inviteSomeone')}</h2><p>{t('inviteHelp')}</p><form onSubmit={invite}><label className="field"><span>{t('emailAddress')}</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field"><span>{t('permission')}</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Exclude<FamilyRole, 'owner'>)}><option value="editor">{t('editor')} — {t('recipes')}, {t('planner')}, {t('groceries')}</option><option value="planner">{t('plannerRole')} — {t('planner')} and {t('groceries')}</option><option value="viewer">{t('viewer')} — read only</option></select></label><button className="button button--primary" disabled={submitting}>{submitting ? t('creating') : t('createInvitation')}</button></form>{inviteUrl && <div className="invite-result"><strong>{t('invitationReady')}</strong><input aria-label={t('invitationLink')} readOnly value={inviteUrl} /><button className="button" onClick={() => navigator.clipboard.writeText(inviteUrl)}>{t('copyLink')}</button></div>}{error && <div className="notice notice--error" role="alert">{error}</div>}</section>}
    </div>
  </section>
}
