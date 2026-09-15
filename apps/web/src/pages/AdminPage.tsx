import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createNewFamilyInvitation, createPasswordReset, deleteAdminFamily, deleteFeedback, listAdminFamilies, listFamilyMembers, listFeedback, listManagedInvitations, listSecurityEvents, removeFamilyMember, reviewFeedback, revokeInvitation, revokeMemberSessions, updateFamilyMemberRole, type AdminFamily, type FamilyMember, type FamilyRole, type Feedback, type ManagedInvitation, type SecurityEvent } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { localeTag, translator } from '../i18n'
import { Navigate } from 'react-router-dom'
import './AccountPages.css'
import { BackupPanel } from '../components/BackupPanel'
import { copyText } from '../utils/clipboard'

export function AdminPage() {
  const { account } = useAuth()
  const t = translator(account?.locale); const locale = localeTag(account?.locale)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [invitations, setInvitations] = useState<ManagedInvitation[]>([])
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [resetLink, setResetLink] = useState('')
  const [families, setFamilies] = useState<AdminFamily[]>([])
  const [newFamilyName, setNewFamilyName] = useState(''); const [newFamilyEmail, setNewFamilyEmail] = useState(''); const [newFamilyUrl, setNewFamilyUrl] = useState('')
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [copiedFeedback, setCopiedFeedback] = useState<number | null>(null)
  const [feedbackView, setFeedbackView] = useState<'active' | 'archived'>('active')

  const refresh = useCallback(async () => {
    try {
      const [nextMembers, nextInvitations, nextSecurityEvents, nextFamilies, nextFeedback] = await Promise.all([listFamilyMembers(), listManagedInvitations(), listSecurityEvents(), account?.is_system_admin ? listAdminFamilies() : Promise.resolve([]), account?.is_system_admin ? listFeedback() : Promise.resolve([])])
      setMembers(nextMembers); setInvitations(nextInvitations); setSecurityEvents(nextSecurityEvents); setFamilies(nextFamilies); setFeedback(nextFeedback)
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('adminLoadFailed')) }
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- Refresh when the signed-in user's locale changes.
  }, [account?.locale, account?.is_system_admin])

  // oxlint-disable-next-line react/set-state-in-effect -- Load owner-managed data when the page opens.
  useEffect(() => { void refresh() }, [refresh])
  if (account?.role !== 'owner') return <Navigate to="/family" replace />

  async function revokeSessions(member: FamilyMember) {
    if (!window.confirm(`Sign ${member.display_name} out on every device?`)) return
    setBusy(`sessions-${member.id}`); setError('')
    try { await revokeMemberSessions(member.id); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) }
    finally { setBusy('') }
  }

  async function removeMember(member: FamilyMember) {
    if (!window.confirm(`Remove ${member.display_name} from ${account?.family_name}? They will lose access immediately.`)) return
    setBusy(`remove-${member.id}`); setError('')
    try { await removeFamilyMember(member.id); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) }
    finally { setBusy('') }
  }

  async function cancelInvitation(invitation: ManagedInvitation) {
    setBusy(`invite-${invitation.id}`); setError('')
    try { await revokeInvitation(invitation.id); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) }
    finally { setBusy('') }
  }

  async function changeRole(member: FamilyMember, role: Exclude<FamilyRole, 'owner'>) {
    setBusy(`role-${member.id}`); setError('')
    try { await updateFamilyMemberRole(member.id, role); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('permissionUpdateFailed')) }
    finally { setBusy('') }
  }

  async function makeResetLink(member: FamilyMember) {
    setBusy(`reset-${member.id}`); setError(''); setResetLink('')
    try { const reset = await createPasswordReset(member.id); setResetLink(`${window.location.origin}/password-reset/${reset.token}`); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) }
    finally { setBusy('') }
  }

  async function inviteNewFamily(event: FormEvent) {
    event.preventDefault(); setBusy('new-family'); setError(''); setNewFamilyUrl('')
    try { const invitation = await createNewFamilyInvitation(newFamilyName, newFamilyEmail); setNewFamilyUrl(`${window.location.origin}/invite/${invitation.token}`); setNewFamilyName(''); setNewFamilyEmail(''); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) }
    finally { setBusy('') }
  }

  async function removeFamily(family: AdminFamily) {
    if (!window.confirm(`${t('deleteFamilyConfirm')} “${family.name}”? ${t('deleteFamilyWarning')}`)) return
    setBusy(`family-${family.id}`); setError('')
    try { await deleteAdminFamily(family.id); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) }
    finally { setBusy('') }
  }

  async function decideFeedback(item: Feedback, status: 'approved' | 'rejected' | 'done') {
    setBusy(`feedback-${item.id}`); setError('')
    try { await reviewFeedback(item.id, status); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) }
    finally { setBusy('') }
  }

  async function copyFeedback(item: Feedback) {
    const attachment = item.attachment_url ? `\n\nUser attachment: ${window.location.origin}${item.attachment_url}` : ''
    const prompt = `Please implement this approved Mad Planner improvement:\n\n${item.content}${attachment}\n\nKeep the existing architecture, preserve current data, add relevant tests, and make the Git changes reviewable. Update CHANGELOG.md with the user-visible change. When the work and tests are complete, tell me exactly what changed and ask me to commit and push it; include the suggested Git commands.`
    if (await copyText(prompt)) setCopiedFeedback(item.id)
    else setError(t('copyFailed'))
  }

  async function removeFeedback(item: Feedback) {
    if (!window.confirm(t('deleteFeedbackConfirm'))) return
    setBusy(`feedback-${item.id}`); setError('')
    try { await deleteFeedback(item.id); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) }
    finally { setBusy('') }
  }

  const visibleFeedback = feedback.filter((item) => feedbackView === 'active' ? item.status === 'pending' || item.status === 'approved' : item.status === 'done' || item.status === 'rejected')

  return <section className="page admin-page">
    <div className="page-heading"><div><p className="eyebrow">{t('ownerControls')}</p><h1>{t('manageAccess')}</h1><p>{t('manageAccessHelp')} {account.family_name}</p></div></div>
    {error && <div className="notice notice--error" role="alert">{error}</div>}
    <div className="admin-stack">
      {account.is_system_admin && <BackupPanel reportError={setError} />}
      {account.is_system_admin && feedback.some((item) => item.attachment_url) && <section className="family-panel"><h2>{t('attachments')}</h2><div className="feedback-attachments">{feedback.filter((item) => item.attachment_url).map((item) => <a className="button" href={item.attachment_url!} target="_blank" rel="noreferrer" key={item.id}>{item.attachment_name || t('attachment')} · {item.submitted_by}</a>)}</div></section>}
      {account.is_system_admin && <section className="family-panel"><h2>{t('feedbackInbox')}</h2><p>{t('feedbackInboxHelp')}</p><nav className="feedback-tabs" aria-label={t('feedbackInbox')}><button className={feedbackView === 'active' ? 'button button--primary' : 'button'} onClick={() => setFeedbackView('active')}>{t('active')} ({feedback.filter((item) => item.status === 'pending' || item.status === 'approved').length})</button><button className={feedbackView === 'archived' ? 'button button--primary' : 'button'} onClick={() => setFeedbackView('archived')}>{t('archived')} ({feedback.filter((item) => item.status === 'done' || item.status === 'rejected').length})</button></nav>{visibleFeedback.length === 0 ? <p>{feedbackView === 'active' ? t('noActiveFeedback') : t('noArchivedFeedback')}</p> : <div className="feedback-review-list">{visibleFeedback.map((item) => <article key={item.id}><header><div><strong>{item.submitted_by}</strong><small>{item.family_name} · {new Date(item.created_at).toLocaleString(locale)}</small></div><span className={`feedback-status feedback-status--${item.status}`}>{t(item.status)}</span></header><p>{item.content}</p><footer>{item.status === 'pending' && <><button className="button button--primary" disabled={Boolean(busy)} onClick={() => void decideFeedback(item, 'approved')}>{t('approve')}</button><button className="button button--danger" disabled={Boolean(busy)} onClick={() => void decideFeedback(item, 'rejected')}>{t('reject')}</button></>}{item.status === 'approved' && <><button className="button" onClick={() => void copyFeedback(item)}>{copiedFeedback === item.id ? t('copiedForCodex') : t('copyForCodex')}</button><button className="button button--primary" disabled={Boolean(busy)} onClick={() => void decideFeedback(item, 'done')}>{t('markDone')}</button></>}{(item.status === 'done' || item.status === 'rejected') && <button className="button button--danger" disabled={Boolean(busy)} onClick={() => void removeFeedback(item)}>{t('delete')}</button>}</footer></article>)}</div>}</section>}
      {account.is_system_admin && <section className="family-panel system-family-admin"><h2>{t('manageFamilies')}</h2><p>{t('manageFamiliesHelp')}</p><form className="new-family-form" onSubmit={inviteNewFamily}><label className="field"><span>{t('newFamilyName')}</span><input required maxLength={120} value={newFamilyName} onChange={(event) => setNewFamilyName(event.target.value)} /></label><label className="field"><span>{t('ownerEmail')}</span><input required type="email" value={newFamilyEmail} onChange={(event) => setNewFamilyEmail(event.target.value)} /></label><button className="button button--primary" disabled={Boolean(busy)}>{busy === 'new-family' ? t('creating') : t('createFamilyInvitation')}</button></form>{newFamilyUrl && <div className="invite-result"><strong>{t('newFamilyInvitationReady')}</strong><input aria-label={t('invitationLink')} readOnly value={newFamilyUrl} /><button className="button" onClick={() => navigator.clipboard.writeText(newFamilyUrl)}>{t('copyLink')}</button></div>}<div className="managed-family-list">{families.map((family) => <article key={family.id}><div><strong>{family.name}</strong><small>{family.members} {t('members')} · {family.recipes} {t('recipes')}</small></div>{family.id === account.family_id ? <span className="tag">{t('currentFamily')}</span> : <button className="button button--danger" disabled={Boolean(busy)} onClick={() => void removeFamily(family)}>{t('deleteFamily')}</button>}</article>)}</div></section>}
      <section className="family-panel"><h2>{t('familyLogins')}</h2><div className="admin-list">{members.map((member) => <article key={member.id}><span className="member-avatar">{member.display_name.charAt(0).toUpperCase()}</span><div><strong>{member.display_name}</strong><small>{member.email} · {member.active_sessions} {member.active_sessions === 1 ? t('activeLogin') : t('activeLogins')}</small></div>{member.role === 'owner' ? <span className="tag">{t('owner')}</span> : <select aria-label={`${member.display_name} ${t('permission')}`} value={member.role} disabled={Boolean(busy)} onChange={(event) => void changeRole(member, event.target.value as Exclude<FamilyRole, 'owner'>)}><option value="editor">{t('editor')}</option><option value="planner">{t('plannerRole')}</option><option value="viewer">{t('viewer')}</option></select>}<div className="admin-actions"><button className="button" disabled={Boolean(busy)} onClick={() => void makeResetLink(member)}>{t('createResetLink')}</button>{member.role !== 'owner' && <><button className="button" disabled={Boolean(busy)} onClick={() => void revokeSessions(member)}>{t('signOutEverywhere')}</button><button className="button button--danger" disabled={Boolean(busy)} onClick={() => void removeMember(member)}>{t('removeAccess')}</button></>}</div></article>)}</div>{resetLink && <div className="invite-result"><strong>{t('resetLinkReady')}</strong><p>{t('resetLinkHelp')}</p><input readOnly value={resetLink} /><button className="button" onClick={() => navigator.clipboard.writeText(resetLink)}>{t('copyLink')}</button></div>}</section>
      <section className="family-panel"><h2>{t('pendingInvitations')}</h2>{invitations.length === 0 ? <p>{t('noPendingInvitations')}</p> : <div className="admin-list">{invitations.map((invitation) => <article key={invitation.id}><div><strong>{invitation.intended_email}</strong><small>{invitation.role} · {t('expires')} {new Date(invitation.expires_at).toLocaleDateString(locale)}</small></div><div className="admin-actions"><button className="button button--danger" disabled={Boolean(busy)} onClick={() => void cancelInvitation(invitation)}>{t('revokeInvitation')}</button></div></article>)}</div>}</section>
      <section className="family-panel"><h2>{t('securityHistory')}</h2><p>{t('securityHistoryHelp')}</p>{securityEvents.length === 0 ? <p>{t('noSecurityEvents')}</p> : <div className="security-event-list">{securityEvents.map((event) => <article key={event.id}><span className={`security-event-dot security-event-dot--${event.event_type === 'login_succeeded' ? 'success' : 'warning'}`} aria-hidden="true" /><div><strong>{event.event_type === 'login_succeeded' ? t('loginSucceeded') : event.event_type === 'login_failed' ? t('loginFailed') : event.event_type}</strong><small>{event.user_email || t('unknownAccount')}</small></div><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(locale)}</time></article>)}</div>}</section>
    </div>
  </section>
}
