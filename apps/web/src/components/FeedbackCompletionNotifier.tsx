import { useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { showWeeklyReleaseNotification } from '../notifications'
import { releases, releaseVersion } from '../utils/releases'

export function FeedbackCompletionNotifier() {
  const { account } = useAuth()
  useEffect(() => {
    if (!account?.browser_notifications_enabled) return
    const t = translator(account.locale)
    const check = () => {
      const now = new Date()
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', hour: 'numeric', hourCycle: 'h23' }).format(now))
      const release = releases[0]
      if (hour < 9 || release.version !== releaseVersion(now) || !release.groups.some((group) => group.notes.length)) return
      void showWeeklyReleaseNotification(t('weeklyReleaseTitle'), t('weeklyReleaseBody'), release.version, account.id, account.family_id).catch(() => undefined)
    }
    check()
    const timer = window.setInterval(check, 60_000)
    return () => window.clearInterval(timer)
  }, [account?.browser_notifications_enabled, account?.locale, account?.id, account?.family_id])
  return null
}
