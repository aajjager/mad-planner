import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { backgroundSubscribed, disableBackgroundPush, enableBackgroundPush, pushConfig, pushSupported } from '../push'

export function BackgroundPushSettings() {
  const { account, setBrowserNotifications } = useAuth()
  const t = useMemo(() => translator(account?.locale), [account?.locale])
  const [config, setConfig] = useState<{ enabled: boolean; public_key: string | null } | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(pushSupported)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!pushSupported()) return
    let active = true
    Promise.all([pushConfig(), backgroundSubscribed()]).then(async ([next, current]) => {
      if (!active) return
      // Existing opt-ins with permission already granted need no second switch.
      if (!current && next.enabled && next.public_key && account?.browser_notifications_enabled && Notification.permission === 'granted') {
        current = await enableBackgroundPush(next.public_key)
      }
      if (active) { setConfig(next); setSubscribed(current) }
    }).catch(() => { if (active) setError(t('pushFailed')) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [account?.id, account?.browser_notifications_enabled, t])
  async function toggle(enabled: boolean) {
    setBusy(true); setError('')
    try {
      if (!enabled) {
        // Pause server delivery first, even if browser unsubscribe later fails.
        await setBrowserNotifications(false)
        setSubscribed(false)
        if (pushSupported()) await disableBackgroundPush()
      }
      else if (config?.public_key) {
        if (!(await enableBackgroundPush(config.public_key))) { setError(t('notificationsDenied')); return }
        try { await setBrowserNotifications(true) }
        catch (reason) { if (!subscribed) await disableBackgroundPush(); throw reason }
        setSubscribed(true)
      }
    } catch { setError(t('pushFailed')) } finally { setBusy(false) }
  }
  return <div>
    <label className="setting-toggle"><input type="checkbox"
      checked={Boolean(account?.browser_notifications_enabled && (subscribed || !pushSupported() || config?.enabled === false))}
      disabled={busy || ((!pushSupported() || !config?.enabled) && !account?.browser_notifications_enabled)}
      onChange={(event) => void toggle(event.target.checked)}
    /><span><strong>{t('phoneNotifications')}</strong><small>{t('combinedNotificationsHelp')}</small></span></label>
    {!pushSupported() ? <p>{t('pushUnsupported')}</p> : config && !config.enabled ? <p>{t('pushNotConfigured')}</p> : null}
    {error && <p role="alert">{error}</p>}
  </div>
}
