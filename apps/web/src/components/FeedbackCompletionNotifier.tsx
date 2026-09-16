import { useEffect } from 'react'
import { listMyFeedback } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { showFeedbackCompletionNotification } from '../notifications'

export function FeedbackCompletionNotifier() {
  const { account } = useAuth(); const t = translator(account?.locale)
  useEffect(() => {
    if (!account?.browser_notifications_enabled) return
    const check = () => listMyFeedback().then((items) => items.filter((item) => item.status === 'done' && !item.completion_seen_at).forEach((item) => {
      const title = item.category === 'bug' ? t('bugFixed') : item.category === 'feature' ? t('featureAdded') : t('improvementCompleted')
      void showFeedbackCompletionNotification(title, item.content, item.id)
    })).catch(() => undefined)
    check(); const timer = window.setInterval(check, 60_000)
    return () => window.clearInterval(timer)
  }, [account?.browser_notifications_enabled, t])
  return null
}
