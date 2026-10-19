import { useEffect, useRef, useState, type FormEvent } from 'react'
import { translator } from '../i18n'
import { useAuth } from '../auth/AuthContext'

export function DeleteFamilyDialog({ name, busy, error, onCancel, onConfirm }: {
  name: string; busy: boolean; error: string; onCancel: () => void; onConfirm: () => Promise<void>
}) {
  const { account } = useAuth()
  const t = translator(account?.locale)
  const dialog = useRef<HTMLDialogElement>(null)
  const submitting = useRef(false)
  const [confirmation, setConfirmation] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (confirmation !== 'delete' || busy || submitting.current) return
    submitting.current = true
    try { await onConfirm() } finally { submitting.current = false }
  }
  return <dialog ref={dialog} className="delete-family-dialog" aria-labelledby="delete-family-title" aria-describedby="delete-family-warning" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}>
    <form onSubmit={(event) => void submit(event)}>
      <h2 id="delete-family-title">{t('deleteFamilyConfirm')} “{name}”?</h2>
      <p id="delete-family-warning">{t('deleteFamilyWarning')}</p>
      <label className="field"><span>{t('typeDeleteToConfirm')}</span><input autoFocus autoComplete="off" spellCheck={false} value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} /></label>
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      <div className="heading-actions"><button type="button" className="button" disabled={busy} onClick={onCancel}>{t('cancel')}</button><button type="submit" className="button button--danger" disabled={busy || confirmation !== 'delete'}>{busy ? t('deletingFamily') : t('deleteFamily')}</button></div>
    </form>
  </dialog>
}
