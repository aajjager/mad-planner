import { useState } from 'react'
import { answerFeedback, type Feedback } from '../api/auth'
import { translator } from '../i18n'
import { useAuth } from '../auth/AuthContext'

export function FeedbackAnswerEditor({ item, refresh }: { item: Feedback; refresh: () => Promise<void> }) {
  const { account } = useAuth()
  const t = translator(account?.locale)
  const [answer, setAnswer] = useState(item.answer ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(text?: string) {
    setBusy(true); setError('')
    try { await answerFeedback(item.id, text); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) }
    finally { setBusy(false) }
  }
  if (!item.is_question) return <button className="button" disabled={busy} onClick={() => void save()}>{t('markQuestion')}{error && <span role="alert">{error}</span>}</button>
  return <form className="feedback-answer-editor" onSubmit={(event) => { event.preventDefault(); void save(answer.trim()) }}>
    <label className="field"><span>{t('adminAnswer')}</span><textarea required maxLength={4000} rows={4} value={answer} onChange={(event) => setAnswer(event.target.value)} /></label>
    <button className="button button--primary" disabled={busy || !answer.trim()}>{busy ? t('sending') : t('sendAnswer')}</button>
    {error && <p role="alert">{error}</p>}
  </form>
}
