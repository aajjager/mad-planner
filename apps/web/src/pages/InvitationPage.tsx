import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { acceptInvitation, getInvitation, type InvitationPreview } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import './AccountPages.css'

export function InvitationPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { account, acceptAccount } = useAuth()
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (token) getInvitation(token).then(setInvitation).catch((reason) => setError(reason.message))
  }, [token])

  if (account) return <Navigate to="/recipes" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    try { acceptAccount(await acceptInvitation(token, { display_name: displayName, password })); navigate('/recipes') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The invitation could not be accepted.') }
  }

  return <div className="account-shell"><section className="account-card"><div className="brand account-brand"><span className="brand-mark">M</span>Mad Planner</div><p className="eyebrow">Family invitation</p><h1>{invitation ? `Join ${invitation.family_name}.` : 'Opening invitation…'}</h1>{invitation && <><p className="account-intro">Create your account for <strong>{invitation.intended_email}</strong>.</p><form onSubmit={submit}><label className="field"><span>Your name</span><input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label className="field"><span>Password</span><input required minLength={10} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><small>Use at least 10 characters.</small><button className="button button--primary">Join family</button></form></>}{error && <div className="notice notice--error" role="alert">{error}</div>}</section></div>
}
