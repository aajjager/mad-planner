import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { acceptInvitation, getInvitation, type Account, type InvitationPreview } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { rememberedLocale, rememberLocale, translator } from '../i18n'
import './AccountPages.css'

export function InvitationPage() {
  const { token } = useParams(); const navigate = useNavigate(); const { account, acceptAccount } = useAuth(); const [locale, setPageLocale] = useState<Account['locale']>(rememberedLocale); const [invitation, setInvitation] = useState<InvitationPreview | null>(null); const [displayName, setDisplayName] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const t = translator(locale)
  useEffect(() => { if (token) getInvitation(token).then(setInvitation).catch((reason) => setError(reason.message)) }, [token])
  if (account) return <Navigate to="/recipes" replace />
  async function submit(event: FormEvent) { event.preventDefault(); if (!token) return; try { acceptAccount(await acceptInvitation(token, { display_name: displayName, password })); navigate('/recipes') } catch (reason) { setError(reason instanceof Error ? reason.message : t('invitationAcceptFailed')) } }
  return <div className="account-shell"><section className="account-card"><div className="brand account-brand"><span className="brand-mark">M</span>Mad Planner</div><label className="field"><span>{t('language')}</span><select value={locale} onChange={(event) => { const next = event.target.value as Account['locale']; setPageLocale(next); rememberLocale(next) }}><option value="en">English</option><option value="da">Dansk</option><option value="nl">Nederlands</option></select></label><p className="eyebrow">{t('familyInvitation')}</p><h1>{invitation ? `${t('joinFamily')} ${invitation.family_name}.` : t('openingInvitation')}</h1>{invitation && <><p className="account-intro">{t('createInvitationAccount')} <strong>{invitation.intended_email}</strong>.</p><form onSubmit={submit}><label className="field"><span>{t('yourName')}</span><input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label className="field"><span>{t('password')}</span><input required minLength={10} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><small>{t('passwordHelp')}</small><button className="button button--primary">{t('joinFamily')}</button></form></>}{error && <div className="notice notice--error" role="alert">{error}</div>}</section></div>
}
