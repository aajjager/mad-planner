import { useId, useState } from 'react'
import { translator } from '../i18n'
import { useAuth } from '../auth/AuthContext'

const previewLength = 320

export function RecipeDescription({ text }: { text: string }) {
  const { account } = useAuth()
  const t = translator(account?.locale)
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const long = text.length > previewLength
  const prefix = text.slice(0, previewLength)
  const lastSpace = prefix.lastIndexOf(' ')
  const preview = `${prefix.slice(0, lastSpace > previewLength / 2 ? lastSpace : previewLength).trimEnd()}…`
  return <div className="recipe-description">
    <p id={id}>{long && !expanded ? preview : text}</p>
    {long && <button type="button" className="text-button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((value) => !value)}>{expanded ? t('showLessDescription') : t('showMoreDescription')}</button>}
  </div>
}
