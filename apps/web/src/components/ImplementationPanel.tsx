import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Feedback } from '../api/auth'
import { translator } from '../i18n'

interface Job {
  id: number; feedback_id: number | null; request_text: string; revision: number; status: string;
  details: { head_sha?: string; summary?: string; preview_url?: string; pr_number?: number; tests_passed?: boolean }
}
const terminal = ['merged', 'failed', 'cancelled']
const archived = ['merged', 'cancelled']
async function request(path = '', body?: unknown) {
  const response = await fetch(`/api/v1/implementations${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'The implementation request failed.')
  return data
}

export function ImplementationPanel({ feedback }: { feedback: Feedback[] }) {
  const { account } = useAuth(); const t = translator(account?.locale)
  const [jobs, setJobs] = useState<Job[]>([])
  const [view, setView] = useState<'active' | 'history'>('active')
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<Record<number, string>>({})
  const refresh = useCallback(async () => {
    const result = await request(); setJobs(result.jobs || []); setEnabled(Boolean(result.enabled))
  }, [])
  useEffect(() => {
    let active = true
    const load = () => { if (active) void refresh().catch((reason) => { if (active) setError(reason.message) }) }
    load(); const timer = window.setInterval(load, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [refresh])
  async function act(path: string, body: unknown) {
    setBusy(true); setError('')
    try { await request(path, body); await refresh() } catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) } finally { setBusy(false) }
  }
  const candidates = feedback.filter((item) => item.status === 'approved' && !item.is_question && !jobs.some((job) => job.feedback_id === item.id && !terminal.includes(job.status)))
  const currentJobs = jobs.filter((job) => !archived.includes(job.status))
  const historyJobs = jobs.filter((job) => archived.includes(job.status))
  const visibleJobs = view === 'active' ? currentJobs : historyJobs
  return <section className="family-panel"><h2>{t('implementationTitle')}</h2><p>{t('implementationHelp')}</p>
    {!enabled && <p className="notice">{t('implementationSetup')}</p>}
    {error && <p role="alert" className="notice notice--error">{error}</p>}
    <nav className="feedback-tabs" aria-label={t('implementationTitle')}>
      <button className={view === 'active' ? 'button button--primary' : 'button'} aria-pressed={view === 'active'} onClick={() => setView('active')}>{t('active')} ({currentJobs.length})</button>
      <button className={view === 'history' ? 'button button--primary' : 'button'} aria-pressed={view === 'history'} onClick={() => setView('history')}>{t('history')} ({historyJobs.length})</button>
    </nav>
    {visibleJobs.length === 0 && (view === 'history' || candidates.length === 0) && <p>{t(view === 'history' ? 'implementationHistoryEmpty' : 'implementationActiveEmpty')}</p>}
    <div className="feedback-review-list">
      {view === 'active' && candidates.map((item) => <article key={`request-${item.id}`}><strong>{t(item.category === 'feature' ? 'featureRequest' : item.category)}</strong><p>{item.content}</p><button className="button button--primary" disabled={busy || !enabled} onClick={() => void act(`/feedback/${item.id}`, {})}>{t('implementRequest')}</button></article>)}
      {visibleJobs.map((job) => <article key={job.id}><header><strong>#{job.id} · {t('implementationRevision')} {job.revision}</strong><span className="tag">{t(`implementation_${job.status}` as Parameters<typeof t>[0])}</span></header><p>{job.request_text}</p>
        {job.details.summary && <p style={{ whiteSpace: 'pre-wrap' }}>{job.details.summary}</p>}
        {job.details.head_sha && <p>{t('implementationCommit')}: <code>{job.details.head_sha.slice(0, 12)}</code>{job.details.tests_passed && ` · ${t('implementationChecksPassed')}`}</p>}
        <div className="heading-actions">
          {job.status === 'ready' && job.details.preview_url && <a className="button" href={job.details.preview_url} target="_blank" rel="noreferrer">{t('implementationPreview')}</a>}
          {job.details.pr_number && <a className="button" href={`https://github.com/aajjager/mad-planner/pull/${job.details.pr_number}`} target="_blank" rel="noreferrer">{t('implementationReview')}</a>}
          {job.status === 'ready' && <button className="button button--primary" disabled={busy} onClick={() => { if (window.confirm(`${t('implementationApproveConfirm')} ${job.details.head_sha?.slice(0, 12)}?`)) void act(`/${job.id}/approve`, { revision: job.revision, head_sha: job.details.head_sha }) }}>{t('implementationApprove')}</button>}
          {!terminal.includes(job.status) && job.status !== 'merging' && <button className="button" disabled={busy} onClick={() => void act(`/${job.id}/cancel`, {})}>{t('cancel')}</button>}
        </div>
        {['ready', 'failed'].includes(job.status) && <div><label className="field"><span>{t('implementationChangeNotes')}</span><textarea maxLength={4000} value={notes[job.id] || ''} onChange={(event) => setNotes({ ...notes, [job.id]: event.target.value })} /></label><button className="button" disabled={busy || !notes[job.id]?.trim()} onClick={() => void act(`/${job.id}/changes`, { revision: job.revision, message: notes[job.id] })}>{t('implementationRequestChanges')}</button></div>}
      </article>)}
    </div>
  </section>
}
