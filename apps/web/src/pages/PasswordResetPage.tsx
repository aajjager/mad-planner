import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import type { Account, PasswordResetPreview } from '../api/auth'
import { completePasswordReset, getPasswordReset } from '../api/auth'
import { rememberedLocale, rememberLocale, translator } from '../i18n'
import './AccountPages.css'
import { BrandMark } from '../components/BrandMark'

export function PasswordResetPage() {
  const { token } = useParams(); const [locale, setLocale] = useState<Account['locale']>(rememberedLocale); const [preview, setPreview] = useState<PasswordResetPreview | null>(null); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [complete, setComplete] = useState(false); const [busy, setBusy] = useState(false); const t = translator(locale)
  useEffect(() => { if (token) getPasswordReset(token).then(setPreview).catch((reason) => setError(reason.message)) }, [token])
  async function submit(event: FormEvent) { event.preventDefault(); if (!token) return; setBusy(true); setError(''); try { await completePasswordReset(token, password); setComplete(true) } catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) } finally { setBusy(false) } }
  return <div className="account-shell"><section className="account-card"><div className="brand account-brand"><BrandMark />Mad Planner</div><label className="field"><span>{t('language')}</span><select value={locale} onChange={(event) => { const next = event.target.value as Account['locale']; setLocale(next); rememberLocale(next) }}><option value="en">English</option><option value="da">Dansk</option><option value="nl">Nederlands</option></select></label><p className="eyebrow">{t('accountSecurity')}</p><h1>{complete ? t('passwordResetComplete') : preview ? t('resetPassword') : t('openingReset')}</h1>{preview && !complete && <><p className="account-intro">{t('chooseNewPassword')} <strong>{preview.intended_email}</strong><br />{t('resetMfaNotice')}</p><form onSubmit={submit}><label className="field"><span>{t('newPassword')}</span><input required minLength={10} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><small>{t('passwordHelp')}</small><button className="button button--primary" disabled={busy}>{busy ? t('pleaseWait') : t('resetPassword')}</button></form></>}{complete && <button className="button button--primary" onClick={() => window.location.assign('/')}>{t('returnToSignIn')}</button>}{error && <div className="notice notice--error" role="alert">{error}</div>}</section></div>
}
