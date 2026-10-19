import { useEffect, useState } from 'react'
import { listMyFeedback } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'

export function FeedbackAnswerBadge() {
  const { account } = useAuth()
  const t = translator(account?.locale)
  const [count, setCount] = useState(0)
  useEffect(() => {
    let active = true
    const refresh = () => { void listMyFeedback().then((items) => { if (active) setCount(items.filter((item) => item.status === 'done' && item.is_question && item.answer && !item.answer_seen_at).length) }).catch(() => undefined) }
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('feedback-answers-read', refresh)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('feedback-answers-read', refresh) }
  }, [account?.id])
  return count ? <span className="feedback-answer-badge" role="status" aria-label={`${t('unreadAnswers')}: ${count}`}>{count}</span> : null
}
