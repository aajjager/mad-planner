import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import './AccountPages.css'

export function AccountAccessPage() {
  const { setupRequired, login, setupOwner } = useAuth()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true); setError('')
    try {
      if (setupRequired) await setupOwner({ email, display_name: displayName, password, family_name: familyName })
      else await login(email, password)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The request could not be completed.')
    } finally { setSubmitting(false) }
  }

  return <div className="account-shell">
    <section className="account-card">
      <div className="brand account-brand"><span className="brand-mark">M</span>Mad Planner</div>
      <p className="eyebrow">{setupRequired ? 'Welcome home' : 'Private family space'}</p>
      <h1>{setupRequired ? 'Create your family.' : 'Welcome back.'}</h1>
      <p className="account-intro">{setupRequired ? 'Create the first owner account. Your existing recipes and plans will move into this family automatically.' : 'Sign in to see your family’s recipes, meal plan, and grocery list.'}</p>
      <form onSubmit={submit}>
        {setupRequired && <>
          <label className="field"><span>Your name</span><input required maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" /></label>
          <label className="field"><span>Family name</span><input required maxLength={120} value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder="The Jensen family" /></label>
        </>}
        <label className="field"><span>Email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        <label className="field"><span>Password</span><input required minLength={setupRequired ? 10 : 1} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={setupRequired ? 'new-password' : 'current-password'} /></label>
        {setupRequired && <small>Use at least 10 characters.</small>}
        {error && <div className="notice notice--error" role="alert">{error}</div>}
        <button className="button button--primary" disabled={submitting}>{submitting ? 'Please wait…' : setupRequired ? 'Create family' : 'Sign in'}</button>
      </form>
    </section>
  </div>
}
