import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPlanReminders, type PlanReminder } from '../api/planner'
import { useAuth } from '../auth/AuthContext'
import { localeTag, translator } from '../i18n'
import { showPlanReminderNotification } from '../notifications'

export function PlanReminderBanner() {
  const { account } = useAuth()
  const t = useMemo(() => translator(account?.locale), [account?.locale])
  const [reminder, setReminder] = useState<PlanReminder | null>(null)
  useEffect(() => {
    const refresh = () => getPlanReminders().then((next) => {
        setReminder(next)
        const firstWeek = next.weeks[0]
        if (account?.browser_notifications_enabled && next.enabled && firstWeek) {
          void showPlanReminderNotification(t('planReminderTitle'), `${firstWeek.missing_slots} ${t('mealSlotsMissing')}`, firstWeek.week_start)
        }
      }).catch(() => undefined)
    void refresh()
    window.addEventListener('madplanner:plan-changed', refresh)
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('madplanner:plan-changed', refresh); window.removeEventListener('focus', refresh) }
  }, [account?.browser_notifications_enabled, t])
  const first = reminder?.weeks?.[0]
  if (!reminder?.enabled || !first) return null
  const [year, month, day] = first.week_start.split('-').map(Number)
  const weekLabel = new Date(year, month - 1, day).toLocaleDateString(localeTag(account?.locale), { day: 'numeric', month: 'short', year: 'numeric' })
  return <aside className="plan-reminder" role="status"><span aria-hidden="true">◷</span><div><strong>{t('planReminderTitle')}</strong><small>{t('weekStarting')} {weekLabel} · {first.missing_slots} {t('mealSlotsMissing')}</small></div><Link to={`/planner?week=${first.week_start}`}>{t('planNow')} →</Link></aside>
}
