import { useCallback, useEffect, useState } from 'react'
import { createPasswordReset, listFamilyMembers, listManagedInvitations, listSecurityEvents, removeFamilyMember, revokeInvitation, revokeMemberSessions, updateFamilyMemberRole, type FamilyMember, type FamilyRole, type ManagedInvitation, type SecurityEvent } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { localeTag, translator } from '../i18n'
import { Navigate } from 'react-router-dom'
import './AccountPages.css'

export function AdminPage() {
  const { account } = useAuth()
  const t = translator(account?.locale); const locale = localeTag(account?.locale)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [invitations, setInvitations] = useState<ManagedInvitation[]>([])
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [resetLink, setResetLink] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [nextMembers, nextInvitations, nextSecurityEvents] = await Promise.all([listFamilyMembers(), listManagedInvitations(), listSecurityEvents()])
      setMembers(nextMembers); setInvitations(nextInvitations); setSecurityEvents(nextSecurityEvents)
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('adminLoadFailed')) }
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- Refresh when the signed-in user's locale changes.
  }, [account?.locale])

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

  return <section className="page admin-page">
    <div className="page-heading"><div><p className="eyebrow">{t('ownerControls')}</p><h1>{t('manageAccess')}</h1><p>{t('manageAccessHelp')} {account.family_name}</p></div></div>
    {error && <div className="notice notice--error" role="alert">{error}</div>}
    <div className="admin-stack">
      <section className="family-panel"><h2>{t('familyLogins')}</h2><div className="admin-list">{members.map((member) => <article key={member.id}><span className="member-avatar">{member.display_name.charAt(0).toUpperCase()}</span><div><strong>{member.display_name}</strong><small>{member.email} · {member.active_sessions} {member.active_sessions === 1 ? t('activeLogin') : t('activeLogins')}</small></div>{member.role === 'owner' ? <span className="tag">{t('owner')}</span> : <select aria-label={`${member.display_name} ${t('permission')}`} value={member.role} disabled={Boolean(busy)} onChange={(event) => void changeRole(member, event.target.value as Exclude<FamilyRole, 'owner'>)}><option value="editor">{t('editor')}</option><option value="planner">{t('plannerRole')}</option><option value="viewer">{t('viewer')}</option></select>}<div className="admin-actions"><button className="button" disabled={Boolean(busy)} onClick={() => void makeResetLink(member)}>{t('createResetLink')}</button>{member.role !== 'owner' && <><button className="button" disabled={Boolean(busy)} onClick={() => void revokeSessions(member)}>{t('signOutEverywhere')}</button><button className="button button--danger" disabled={Boolean(busy)} onClick={() => void removeMember(member)}>{t('removeAccess')}</button></>}</div></article>)}</div>{resetLink && <div className="invite-result"><strong>{t('resetLinkReady')}</strong><p>{t('resetLinkHelp')}</p><input readOnly value={resetLink} /><button className="button" onClick={() => navigator.clipboard.writeText(resetLink)}>{t('copyLink')}</button></div>}</section>
      <section className="family-panel"><h2>{t('pendingInvitations')}</h2>{invitations.length === 0 ? <p>{t('noPendingInvitations')}</p> : <div className="admin-list">{invitations.map((invitation) => <article key={invitation.id}><div><strong>{invitation.intended_email}</strong><small>{invitation.role} · {t('expires')} {new Date(invitation.expires_at).toLocaleDateString(locale)}</small></div><div className="admin-actions"><button className="button button--danger" disabled={Boolean(busy)} onClick={() => void cancelInvitation(invitation)}>{t('revokeInvitation')}</button></div></article>)}</div>}</section>
      <section className="family-panel"><h2>{t('securityHistory')}</h2><p>{t('securityHistoryHelp')}</p>{securityEvents.length === 0 ? <p>{t('noSecurityEvents')}</p> : <div className="security-event-list">{securityEvents.map((event) => <article key={event.id}><span className={`security-event-dot security-event-dot--${event.event_type === 'login_succeeded' ? 'success' : 'warning'}`} aria-hidden="true" /><div><strong>{event.event_type === 'login_succeeded' ? t('loginSucceeded') : event.event_type === 'login_failed' ? t('loginFailed') : event.event_type}</strong><small>{event.user_email || t('unknownAccount')}</small></div><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(locale)}</time></article>)}</div>}</section>
    </div>
  </section>
}
