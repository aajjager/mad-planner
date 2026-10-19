import { useId, useLayoutEffect, useRef, useState } from 'react'
import { translator } from '../i18n'
import { useAuth } from '../auth/AuthContext'

export function RecipeDescription({ text }: { text: string }) {
  const { account } = useAuth()
  const t = translator(account?.locale)
  const [expanded, setExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)
  const paragraph = useRef<HTMLParagraphElement>(null)
  const id = useId()
  useLayoutEffect(() => {
    const node = paragraph.current
    if (!node) return
    const measure = () => { if (!expanded) setCanExpand(node.scrollHeight > node.clientHeight + 1) }
    // Measure the five-line preview after layout, including font and width changes.
    // oxlint-disable-next-line react/set-state-in-effect -- The toggle depends on measured text overflow.
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [text, expanded])
  return <div className="recipe-description">
    <p ref={paragraph} id={id} className={`recipe-description-text${expanded ? '' : ' recipe-description-text--collapsed'}`}>{text}</p>
    {canExpand && <button type="button" className="text-button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((value) => !value)}>{expanded ? t('showLessDescription') : t('showMoreDescription')}</button>}
  </div>
}
