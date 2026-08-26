import { useCallback, useEffect, useState } from 'react'
import { listFamilyMembers, listManagedInvitations, removeFamilyMember, revokeInvitation, revokeMemberSessions, updateFamilyMemberRole, type FamilyMember, type FamilyRole, type ManagedInvitation } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { localeTag, translator } from '../i18n'
import { Navigate } from 'react-router-dom'
import './AccountPages.css'

export function AdminPage() {
  const { account } = useAuth()
  const t = translator(account?.locale); const locale = localeTag(account?.locale)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [invitations, setInvitations] = useState<ManagedInvitation[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [nextMembers, nextInvitations] = await Promise.all([listFamilyMembers(), listManagedInvitations()])
      setMembers(nextMembers); setInvitations(nextInvitations)
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

  return <section className="page admin-page">
    <div className="page-heading"><div><p className="eyebrow">{t('ownerControls')}</p><h1>{t('manageAccess')}</h1><p>{t('manageAccessHelp')} {account.family_name}</p></div></div>
    {error && <div className="notice notice--error" role="alert">{error}</div>}
    <div className="admin-stack">
      <section className="family-panel"><h2>{t('familyLogins')}</h2><div className="admin-list">{members.map((member) => <article key={member.id}><span className="member-avatar">{member.display_name.charAt(0).toUpperCase()}</span><div><strong>{member.display_name}</strong><small>{member.email} · {member.active_sessions} {member.active_sessions === 1 ? t('activeLogin') : t('activeLogins')}</small></div>{member.role === 'owner' ? <span className="tag">{t('owner')}</span> : <select aria-label={`${member.display_name} ${t('permission')}`} value={member.role} disabled={Boolean(busy)} onChange={(event) => void changeRole(member, event.target.value as Exclude<FamilyRole, 'owner'>)}><option value="editor">{t('editor')}</option><option value="planner">{t('plannerRole')}</option><option value="viewer">{t('viewer')}</option></select>}{member.role !== 'owner' && <div className="admin-actions"><button className="button" disabled={Boolean(busy)} onClick={() => void revokeSessions(member)}>{t('signOutEverywhere')}</button><button className="button button--danger" disabled={Boolean(busy)} onClick={() => void removeMember(member)}>{t('removeAccess')}</button></div>}</article>)}</div></section>
      <section className="family-panel"><h2>{t('pendingInvitations')}</h2>{invitations.length === 0 ? <p>{t('noPendingInvitations')}</p> : <div className="admin-list">{invitations.map((invitation) => <article key={invitation.id}><div><strong>{invitation.intended_email}</strong><small>{invitation.role} · {t('expires')} {new Date(invitation.expires_at).toLocaleDateString(locale)}</small></div><div className="admin-actions"><button className="button button--danger" disabled={Boolean(busy)} onClick={() => void cancelInvitation(invitation)}>{t('revokeInvitation')}</button></div></article>)}</div>}</section>
    </div>
  </section>
}
