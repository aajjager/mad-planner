import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Account } from '../api/auth'
import './WelcomeGuide.css'

import { guideCopy, guideStorageKey } from './welcomeGuideContent'

export function WelcomeGuide({ account }: { account: Account }) {
  const copy = guideCopy[account.locale] ?? guideCopy.en
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(guideStorageKey(account)) !== 'seen' } catch { return true }
  })
  const [step, setStep] = useState(0)
  const canEdit = account.role === 'owner' || account.role === 'editor'
  const steps = copy.steps.filter((item) => canEdit || item[2] !== '/recipes/add')
  const [title, description, path] = steps[step]
  useEffect(() => {
    if (!open || !path.includes('#') || `${location.pathname}${location.hash}` !== path) return
    const id = path.split('#')[1]
    let target: HTMLElement | null = null
    const reveal = () => {
      const section = document.getElementById(id)
      if (!section) return false
      target = section
      section.classList.add('welcome-guide-target')
      section.focus({ preventScroll: true })
      section.scrollIntoView({ block: 'start', behavior: 'instant' })
      return true
    }
    // Family options arrive asynchronously; wait for their actual section.
    const observer = new MutationObserver(() => { if (reveal()) observer.disconnect() })
    if (!reveal()) observer.observe(document.body, { childList: true, subtree: true })
    const timeout = window.setTimeout(() => observer.disconnect(), 10_000)
    return () => { observer.disconnect(); window.clearTimeout(timeout); target?.classList.remove('welcome-guide-target') }
  }, [open, path, location.pathname, location.hash, location.key])
  function moveTo(next: number) {
    setStep(next)
    if (steps[next][2]) navigate(steps[next][2])
  }
  function close() {
    try { localStorage.setItem(guideStorageKey(account), 'seen') } catch { /* Still allow closing when browser storage is unavailable. */ }
    setOpen(false)
  }
  return <>
    <div className="welcome-guide-launcher">
      {location.pathname === '/family' && <button type="button" className="text-button" onClick={() => { setOpen(true); moveTo(steps.findIndex((item) => item[2].startsWith('/family#'))) }}>{copy.familyGuide}</button>}
      <button type="button" className="text-button" onClick={() => { setStep(0); setOpen(true) }}>{copy.open}</button>
    </div>
    {open && <aside className="welcome-guide" aria-label={copy.open}>
      <p className="welcome-guide-progress">{copy.progress} {step + 1} / {steps.length}</p>
      <div aria-live="polite" aria-atomic="true"><h2>{title}</h2><p>{description}</p></div>
      {path && <button type="button" className="text-button" onClick={() => navigate(path)}>{copy.visit}</button>}
      <div className="welcome-guide-actions">
        <button type="button" className="text-button" onClick={close}>{copy.skip}</button>
        <button type="button" className="button" disabled={step === 0} onClick={() => moveTo(step - 1)}>{copy.back}</button>
        <button type="button" className="button" onClick={() => step === steps.length - 1 ? close() : moveTo(step + 1)}>{step === steps.length - 1 ? copy.finish : copy.next}</button>
      </div>
    </aside>}
  </>
}
