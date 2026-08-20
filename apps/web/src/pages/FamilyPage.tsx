import { useEffect, useState, type FormEvent } from 'react'
import { createFamilyInvitation, listFamilyMembers, type FamilyMember } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import './AccountPages.css'

export function FamilyPage() {
  const { account } = useAuth()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [email, setEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { listFamilyMembers().then(setMembers).catch((reason) => setError(reason.message)) }, [])

  async function invite(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setError(''); setInviteUrl('')
    try {
      const invitation = await createFamilyInvitation(email)
      setInviteUrl(`${window.location.origin}/invite/${invitation.token}`)
      setEmail('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The request could not be completed.') }
    finally { setSubmitting(false) }
  }

  return <section className="page family-page">
    <div className="page-heading"><div><p className="eyebrow">Shared household</p><h1>{account?.family_name}</h1><p>Everyone listed here shares this recipe library, planner, and grocery list.</p></div></div>
    <div className="family-grid">
      <section className="family-panel"><h2>Family members</h2><div className="member-list">{members.map((member) => <article key={member.id}><span className="member-avatar">{member.display_name.charAt(0).toUpperCase()}</span><div><strong>{member.display_name}</strong><small>{member.email}</small></div><span className="tag">{member.role}</span></article>)}</div></section>
      {account?.role === 'owner' && <section className="family-panel"><h2>Invite someone</h2><p>We’ll create a private link you can send to this person. It expires after seven days.</p><form onSubmit={invite}><label className="field"><span>Email address</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="button button--primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create invitation'}</button></form>{inviteUrl && <div className="invite-result"><strong>Invitation ready</strong><input aria-label="Invitation link" readOnly value={inviteUrl} /><button className="button" onClick={() => navigator.clipboard.writeText(inviteUrl)}>Copy link</button></div>}{error && <div className="notice notice--error" role="alert">{error}</div>}</section>}
    </div>
  </section>
}
