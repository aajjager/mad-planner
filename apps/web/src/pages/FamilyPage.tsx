import { useEffect, useState, type ClipboardEvent, type FormEvent } from 'react'
import { acknowledgeFeedback, createFamilyInvitation, createRecipeType, deleteRecipeType, getFamilySettings, listFamilyMembers, listMyFeedback, listRecipeTypes, submitFeedback, updateFamilySettings, uploadFeedbackAttachment, type FamilyMember, type FamilyRole, type FamilySettings, type Feedback, type FeedbackCategory, type RecipeType } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { MfaSettings } from '../components/MfaSettings'
import { enableBrowserNotifications, notificationsSupported } from '../notifications'
import { Link } from 'react-router-dom'
import './AccountPages.css'

export function FamilyPage() {
  const { account, setLocale, setShowNutrition, setDarkMode, setAccentTheme, setBrowserNotifications } = useAuth()
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
  const [feedback, setFeedback] = useState('')
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>('improvement')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackFile, setFeedbackFile] = useState<File | null>(null)
  const [myFeedback, setMyFeedback] = useState<Feedback[]>([])
  const [feedbackHistoryView, setFeedbackHistoryView] = useState<'open' | 'closed'>('open')

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

  useEffect(() => { Promise.all([listFamilyMembers(), getFamilySettings(), listRecipeTypes(), listMyFeedback()]).then(([nextMembers, nextSettings, nextTypes, nextFeedback]) => { setMembers(nextMembers); setSettings(nextSettings); setRecipeTypes(nextTypes); setMyFeedback(nextFeedback) }).catch((reason) => setError(reason.message)) }, [])

  async function invite(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setError(''); setInviteUrl('')
    try {
      const invitation = await createFamilyInvitation(email, inviteRole)
      setInviteUrl(`${window.location.origin}/invite/${invitation.token}`)
      setEmail('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) }
    finally { setSubmitting(false) }
  }

  async function sendFeedback(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setError(''); setFeedbackSent(false)
    try { let created = await submitFeedback(feedback, feedbackCategory); if (feedbackFile) created = await uploadFeedbackAttachment(created.id, feedbackFile); setMyFeedback((current) => [created, ...current]); setFeedback(''); setFeedbackFile(null); setFeedbackSent(true) }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) }
    finally { setSubmitting(false) }
  }

  function attachPastedImage(event: ClipboardEvent<HTMLTextAreaElement>) {
    const image = [...event.clipboardData.items].find((item) => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile()
    if (image) { setFeedbackFile(image); setFeedbackSent(false) }
  }

  async function dismissCompletion(item: Feedback) {
    try { const updated = await acknowledgeFeedback(item.id); setMyFeedback((current) => current.map((value) => value.id === updated.id ? updated : value)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) }
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

  const openFeedback = myFeedback.filter((item) => item.status === 'pending' || item.status === 'approved')
  const closedFeedback = myFeedback.filter((item) => item.status === 'done' || item.status === 'rejected')
  const visibleFeedbackHistory = feedbackHistoryView === 'open' ? openFeedback : closedFeedback

  return <section className="page family-page">
    <div className="page-heading"><div><p className="eyebrow">{t('sharedHousehold')}</p><h1>{account?.family_name}</h1><p>{t('sharedHouseholdIntro')}</p></div></div>
    <section className="family-panel personal-settings"><div className="personal-settings__intro"><h2>{t('personalSettings')}</h2><p>{t('personalLanguageHelp')}</p></div><div className="personal-settings__controls"><label className="field"><span>{t('appLanguage')}</span><select value={account?.locale || 'en'} onChange={async (event) => { setLocaleSaved(false); setError(''); try { await setLocale(event.target.value as 'en' | 'da' | 'nl'); setLocaleSaved(true) } catch (reason) { setError(reason instanceof Error ? reason.message : t('settingsSaveFailed')) } }}><option value="en">English</option><option value="da">Dansk</option><option value="nl">Nederlands</option></select></label><label className="setting-toggle"><input type="checkbox" checked={account?.dark_mode ?? false} onChange={async (event) => { setError(''); try { await setDarkMode(event.target.checked) } catch (reason) { setError(reason instanceof Error ? reason.message : t('settingsSaveFailed')) } }} /><span><strong>{t('darkMode')}</strong><small>{t('darkModeHelp')}</small></span></label><label className="field"><span>{t('menuColor')}</span><select value={account?.accent_theme || 'sage'} onChange={async (event) => { setError(''); try { await setAccentTheme(event.target.value as NonNullable<typeof account>['accent_theme']) } catch (reason) { setError(reason instanceof Error ? reason.message : t('settingsSaveFailed')) } }}><option value="sage">{t('sage')}</option><option value="ocean">{t('ocean')}</option><option value="berry">{t('berry')}</option><option value="gold">{t('goldTheme')}</option></select></label><label className="setting-toggle"><input type="checkbox" checked={account?.show_nutrition ?? true} onChange={async (event) => { setError(''); try { await setShowNutrition(event.target.checked) } catch (reason) { setError(reason instanceof Error ? reason.message : t('settingsSaveFailed')) } }} /><span><strong>{t('showNutrition')}</strong><small>{t('showNutritionHelp')}</small></span></label><label className="setting-toggle"><input type="checkbox" checked={account?.browser_notifications_enabled ?? false} onChange={(event) => void changeBrowserNotifications(event.target.checked)} /><span><strong>{t('phoneNotifications')}</strong><small>{t('phoneNotificationsHelp')}</small></span></label>{localeSaved && <span className="settings-saved" role="status">{t('languageSaved')}</span>}{notificationMessage && <span className="settings-message" role="status">{notificationMessage}</span>}</div></section>
    <Link className="family-panel updates-settings-link" to="/updates"><span><strong>{t('whatsNew')}</strong><small>{t('updatesIntro')}</small></span><b aria-hidden="true">v0.2.4 →</b></Link>
    <MfaSettings />
    <section className="family-panel feedback-panel"><h2>{t('feedbackTitle')}</h2><p>{t('feedbackHelp')}</p>{myFeedback.filter((item) => item.status === 'done' && !item.completion_seen_at).map((item) => <div className="notice notice--success feedback-complete" role="status" key={item.id}><div><strong>{item.category === 'bug' ? t('bugFixed') : item.category === 'feature' ? t('featureAdded') : t('improvementCompleted')}</strong><p>{item.content}</p></div><button className="button" onClick={() => void dismissCompletion(item)}>{t('dismiss')}</button></div>)}<form onSubmit={sendFeedback}><label className="field"><span>{t('feedbackCategory')}</span><select required value={feedbackCategory} onChange={(event) => setFeedbackCategory(event.target.value as FeedbackCategory)}><option value="improvement">{t('improvement')}</option><option value="bug">{t('bug')}</option><option value="feature">{t('featureRequest')}</option></select></label><label className="field"><span>{t('feedbackLabel')}</span><textarea required minLength={5} maxLength={4000} rows={5} value={feedback} onPaste={attachPastedImage} onChange={(event) => { setFeedback(event.target.value); setFeedbackSent(false) }} placeholder={t('feedbackPlaceholder')} /><small>{t('pasteScreenshotHelp')}</small></label><label className="field"><span>{t('optionalAttachment')}</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" onChange={(event) => setFeedbackFile(event.target.files?.[0] || null)} />{feedbackFile && <small>{t('attached')}: {feedbackFile.name || t('pastedScreenshot')}</small>}</label><button className="button button--primary" disabled={submitting || feedback.trim().length < 5}>{submitting ? t('sending') : t('sendFeedback')}</button>{feedbackSent && <span className="settings-saved" role="status">{t('feedbackSent')}</span>}</form>{myFeedback.length > 0 && <section className="feedback-history"><h3>{t('yourFeedbackHistory')}</h3><nav className="feedback-tabs" aria-label={t('yourFeedbackHistory')}><button type="button" className={feedbackHistoryView === 'open' ? 'button button--primary' : 'button'} onClick={() => setFeedbackHistoryView('open')}>{t('openRequests')} ({openFeedback.length})</button><button type="button" className={feedbackHistoryView === 'closed' ? 'button button--primary' : 'button'} onClick={() => setFeedbackHistoryView('closed')}>{t('closedRequests')} ({closedFeedback.length})</button></nav>{visibleFeedbackHistory.length === 0 ? <p className="muted">{feedbackHistoryView === 'open' ? t('noOpenRequests') : t('noClosedRequests')}</p> : visibleFeedbackHistory.map((item) => <article key={item.id}><span className={`feedback-status feedback-status--${item.status}`}>{t(item.status)}</span><div><strong>{item.category === 'feature' ? t('featureRequest') : t(item.category)}</strong><p>{item.content}</p>{item.attachment_url && <a href={item.attachment_url} target="_blank" rel="noreferrer">{item.attachment_name || t('attachment')}</a>}</div></article>)}</section>}</section>
    {settings && <section className="family-panel family-settings">
      <header><h2>{t('familyOptions')}</h2><p>{t('familyOptionsHelp')}</p></header>
      <form onSubmit={saveSettings}>
        <div className="setting-row"><div className="setting-row__label"><strong>{t('householdPeople')}</strong><small>{t('householdPeopleHelp')}</small></div><div className="setting-row__control"><input aria-label={t('householdPeople')} type="number" min="1" max="50" value={settings.household_size} disabled={account?.role !== 'owner'} onChange={(event) => { setSettings({ ...settings, household_size: Number(event.target.value) }); setSettingsSaved(false) }} /></div></div>
        <div className="setting-row"><div className="setting-row__label"><strong>{t('plannerMeals')}</strong><small>{t('oneMealRequired')}</small></div><div className="setting-row__control choice-chips">{(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => <button key={mealType} type="button" className={`choice-chip${settings.enabled_meal_types.includes(mealType) ? ' choice-chip--selected' : ''}`} aria-pressed={settings.enabled_meal_types.includes(mealType)} disabled={account?.role !== 'owner'} onClick={() => toggleMealType(mealType)}>{t(mealType)}</button>)}</div></div>
        <label className="setting-row"><span className="setting-row__label"><strong>{t('planLeftovers')}</strong><small>{t('planLeftoversHelp')}</small></span><span className="setting-row__control"><input className="switch-input" type="checkbox" checked={settings.leftovers_enabled} disabled={account?.role !== 'owner'} onChange={(event) => { setSettings({ ...settings, leftovers_enabled: event.target.checked }); setSettingsSaved(false) }} /></span></label>
        <label className="setting-row"><span className="setting-row__label"><strong>{t('cookingMode')}</strong><small>{t('cookingModeHelp')}</small></span><span className="setting-row__control"><input className="switch-input" type="checkbox" checked={settings.cooking_mode_enabled} disabled={account?.role !== 'owner'} onChange={(event) => { setSettings({ ...settings, cooking_mode_enabled: event.target.checked }); setSettingsSaved(false) }} /></span></label>
        <label className="setting-row"><span className="setting-row__label"><strong>{t('planReminders')}</strong><small>{t('planRemindersHelp')}</small></span><span className="setting-row__control"><input className="switch-input" type="checkbox" checked={settings.plan_reminders_enabled ?? true} disabled={account?.role !== 'owner'} onChange={(event) => { setSettings({ ...settings, plan_reminders_enabled: event.target.checked }); setSettingsSaved(false) }} /></span></label>
        <div className="setting-row"><div className="setting-row__label"><strong>{t('reminderHorizon')}</strong><small>{t('reminderHorizonHelp')}</small></div><div className="setting-row__control"><select aria-label={t('reminderHorizon')} value={settings.plan_reminder_weeks ?? 1} disabled={account?.role !== 'owner' || !settings.plan_reminders_enabled} onChange={(event) => { setSettings({ ...settings, plan_reminder_weeks: Number(event.target.value) }); setSettingsSaved(false) }}>{[1, 2, 3, 4].map((weeks) => <option value={weeks} key={weeks}>{weeks} {weeks === 1 ? t('week') : t('weeks')}</option>)}</select></div></div>
        <div className="setting-row"><div className="setting-row__label"><strong>{t('automaticPlanning')}</strong><small>{t('automaticPlanningHelp')}</small></div><div className="setting-row__control"><select aria-label={t('automaticPlanning')} value={settings.planning_suggestion_mode ?? 'review'} disabled={account?.role !== 'owner'} onChange={(event) => { setSettings({ ...settings, planning_suggestion_mode: event.target.value as FamilySettings['planning_suggestion_mode'] }); setSettingsSaved(false) }}><option value="review">{t('reviewThreePlans')}</option><option value="auto">{t('fillBestPlan')}</option></select></div></div>
        <label className="setting-row"><span className="setting-row__label"><strong>{t('ratingPlanning')}</strong><small>{t('ratingPlanningHelp')} {settings.rated_recipe_count} {t('ratedRecipes')}.</small></span><span className="setting-row__control"><input className="switch-input" type="checkbox" checked={settings.rating_filter_enabled} disabled={account?.role !== 'owner' || !settings.rating_filter_eligible} onChange={(event) => { setSettings({ ...settings, rating_filter_enabled: event.target.checked }); setSettingsSaved(false) }} /></span></label><div className="setting-row"><div className="setting-row__label"><strong>{t('minimumRating')}</strong><small>{settings.rating_filter_eligible ? t('ratingReady') : t('ratingNeedsMore')}</small></div><div className="setting-row__control"><select value={settings.rating_minimum} disabled={account?.role !== 'owner' || !settings.rating_filter_enabled} onChange={(event) => { setSettings({ ...settings, rating_minimum: Number(event.target.value) }); setSettingsSaved(false) }}>{[1,2,3,4,5].map((rating) => <option value={rating} key={rating}>{rating}+ ★</option>)}</select></div></div><div className="setting-row"><div className="setting-row__label"><strong>{t('favoriteShare')}</strong><small>{settings.rating_target_percent}%</small></div><div className="setting-row__control"><input aria-label={t('favoriteShare')} type="range" min="0" max="100" step="10" value={settings.rating_target_percent} disabled={account?.role !== 'owner' || !settings.rating_filter_enabled} onChange={(event) => { setSettings({ ...settings, rating_target_percent: Number(event.target.value) }); setSettingsSaved(false) }} /></div></div><footer>{settingsSaved && <span className="settings-saved" role="status">{t('familyOptionsSaved')}</span>}{account?.role === 'owner' && <button className="button button--primary" disabled={submitting}>{submitting ? t('saving') : t('saveFamilyOptions')}</button>}</footer>
      </form>
    </section>}
    <section className="family-panel recipe-type-panel"><h2>{t('recipeTypes')}</h2><p>{t('recipeTypesHelp')}</p><div className="recipe-type-list">{recipeTypes.map((item) => <span className="recipe-type-item" key={item.id}><strong>{item.name}</strong><small>{item.meal_type ? t(item.meal_type) : t('noPlannerMeal')}</small>{account?.role === 'owner' && <button type="button" aria-label={`${t('remove')} ${item.name}`} onClick={() => removeRecipeType(item)}>×</button>}</span>)}</div>{account?.role === 'owner' && <form className="recipe-type-form" onSubmit={addRecipeType}><label className="field"><span>{t('newRecipeType')}</span><input required maxLength={60} value={typeName} onChange={(event) => setTypeName(event.target.value)} placeholder="Soup" /></label><label className="field"><span>{t('plannerMealOptional')}</span><select value={typeMeal || ''} onChange={(event) => setTypeMeal((event.target.value || null) as RecipeType['meal_type'])}><option value="">{t('none')}</option><option value="breakfast">{t('breakfast')}</option><option value="lunch">{t('lunch')}</option><option value="dinner">{t('dinner')}</option></select></label><button className="button button--primary" disabled={submitting || !typeName.trim()}>{t('addType')}</button></form>}{error && <div className="notice notice--error" role="alert">{error}</div>}</section>
    <div className="family-grid">
      <section className="family-panel"><h2>{t('familyMembers')}</h2><div className="member-list">{members.map((member) => <article key={member.id}><span className="member-avatar">{member.display_name.charAt(0).toUpperCase()}</span><div><strong>{member.display_name}</strong><small>{member.email}</small></div><span className="tag">{member.role === 'owner' ? t('owner') : member.role === 'editor' ? t('editor') : member.role === 'planner' ? t('plannerRole') : t('viewer')}</span></article>)}</div></section>
      {account?.role === 'owner' && <section className="family-panel"><h2>{t('inviteSomeone')}</h2><p>{t('inviteHelp')}</p><form onSubmit={invite}><label className="field"><span>{t('emailAddress')}</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field"><span>{t('permission')}</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Exclude<FamilyRole, 'owner'>)}><option value="editor">{t('editor')} — {t('recipes')}, {t('planner')}, {t('groceries')}</option><option value="planner">{t('plannerRole')} — {t('planner')} and {t('groceries')}</option><option value="viewer">{t('viewer')} — read only</option></select></label><button className="button button--primary" disabled={submitting}>{submitting ? t('creating') : t('createInvitation')}</button></form>{inviteUrl && <div className="invite-result"><strong>{t('invitationReady')}</strong><input aria-label={t('invitationLink')} readOnly value={inviteUrl} /><button className="button" onClick={() => navigator.clipboard.writeText(inviteUrl)}>{t('copyLink')}</button></div>}{error && <div className="notice notice--error" role="alert">{error}</div>}</section>}
    </div>
  </section>
}
