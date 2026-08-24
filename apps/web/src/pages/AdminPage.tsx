import { useCallback, useEffect, useState } from 'react'
import { listFamilyMembers, listManagedInvitations, removeFamilyMember, revokeInvitation, revokeMemberSessions, updateFamilyMemberRole, type FamilyMember, type FamilyRole, type ManagedInvitation } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { Navigate } from 'react-router-dom'
import './AccountPages.css'

export function AdminPage() {
  const { account } = useAuth()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [invitations, setInvitations] = useState<ManagedInvitation[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [nextMembers, nextInvitations] = await Promise.all([listFamilyMembers(), listManagedInvitations()])
      setMembers(nextMembers); setInvitations(nextInvitations)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The admin page could not be loaded.') }
  }, [])

  // oxlint-disable-next-line react/set-state-in-effect -- Load owner-managed data when the page opens.
  useEffect(() => { void refresh() }, [refresh])
  if (account?.role !== 'owner') return <Navigate to="/family" replace />

  async function revokeSessions(member: FamilyMember) {
    if (!window.confirm(`Sign ${member.display_name} out on every device?`)) return
    setBusy(`sessions-${member.id}`); setError('')
    try { await revokeMemberSessions(member.id); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The request could not be completed.') }
    finally { setBusy('') }
  }

  async function removeMember(member: FamilyMember) {
    if (!window.confirm(`Remove ${member.display_name} from ${account?.family_name}? They will lose access immediately.`)) return
    setBusy(`remove-${member.id}`); setError('')
    try { await removeFamilyMember(member.id); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The request could not be completed.') }
    finally { setBusy('') }
  }

  async function cancelInvitation(invitation: ManagedInvitation) {
    setBusy(`invite-${invitation.id}`); setError('')
    try { await revokeInvitation(invitation.id); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The request could not be completed.') }
    finally { setBusy('') }
  }

  async function changeRole(member: FamilyMember, role: Exclude<FamilyRole, 'owner'>) {
    setBusy(`role-${member.id}`); setError('')
    try { await updateFamilyMemberRole(member.id, role); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The permission could not be updated.') }
    finally { setBusy('') }
  }

  return <section className="page admin-page">
    <div className="page-heading"><div><p className="eyebrow">Owner controls</p><h1>Manage access.</h1><p>Review who can sign in to {account.family_name}, close active sessions, and remove access when needed.</p></div></div>
    {error && <div className="notice notice--error" role="alert">{error}</div>}
    <div className="admin-stack">
      <section className="family-panel"><h2>Family logins</h2><div className="admin-list">{members.map((member) => <article key={member.id}><span className="member-avatar">{member.display_name.charAt(0).toUpperCase()}</span><div><strong>{member.display_name}</strong><small>{member.email} · {member.active_sessions} active {member.active_sessions === 1 ? 'login' : 'logins'}</small></div>{member.role === 'owner' ? <span className="tag">owner</span> : <select aria-label={`${member.display_name} permission`} value={member.role} disabled={Boolean(busy)} onChange={(event) => void changeRole(member, event.target.value as Exclude<FamilyRole, 'owner'>)}><option value="editor">Editor</option><option value="planner">Planner</option><option value="viewer">Viewer</option></select>}{member.role !== 'owner' && <div className="admin-actions"><button className="button" disabled={Boolean(busy)} onClick={() => void revokeSessions(member)}>Sign out everywhere</button><button className="button button--danger" disabled={Boolean(busy)} onClick={() => void removeMember(member)}>Remove access</button></div>}</article>)}</div></section>
      <section className="family-panel"><h2>Pending invitations</h2>{invitations.length === 0 ? <p>No pending invitations.</p> : <div className="admin-list">{invitations.map((invitation) => <article key={invitation.id}><div><strong>{invitation.intended_email}</strong><small>{invitation.role} · Expires {new Date(invitation.expires_at).toLocaleDateString()}</small></div><div className="admin-actions"><button className="button button--danger" disabled={Boolean(busy)} onClick={() => void cancelInvitation(invitation)}>Revoke invitation</button></div></article>)}</div>}</section>
    </div>
  </section>
}
