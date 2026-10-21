import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { backgroundSubscribed, disableBackgroundPush, enableBackgroundPush, pushConfig, pushSupported } from '../push'

export function BackgroundPushSettings() {
  const { account, setBrowserNotifications } = useAuth()
  const t = useMemo(() => translator(account?.locale), [account?.locale])
  const [config, setConfig] = useState<{ enabled: boolean; public_key: string | null } | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!pushSupported()) return
    let active = true
    Promise.all([pushConfig(), backgroundSubscribed()]).then(([next, current]) => {
      if (active) { setConfig(next); setSubscribed(current) }
    }).catch(() => { if (active) setError(t('pushFailed')) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [account?.id, t])
  async function toggle() {
    setBusy(true); setError('')
    try {
      if (subscribed && account?.browser_notifications_enabled) { await disableBackgroundPush(); setSubscribed(false) }
      else if (config?.public_key) {
        if (!(await enableBackgroundPush(config.public_key))) { setError(t('notificationsDenied')); return }
        try { await setBrowserNotifications(true) }
        catch (reason) { await disableBackgroundPush(); throw reason }
        setSubscribed(true)
      }
    } catch { setError(t('pushFailed')) } finally { setBusy(false) }
  }
  return <section className="family-panel" aria-labelledby="background-push-title">
    <h2 id="background-push-title">{t('backgroundPush')}</h2><p>{t('backgroundPushHelp')}</p>
    {!pushSupported() ? <p>{t('pushUnsupported')}</p> : config && !config.enabled ? <p>{t('pushNotConfigured')}</p> : <>
      <p role="status">{subscribed && account?.browser_notifications_enabled ? t('pushDeviceOn') : t('pushDeviceOff')}</p>
      <button className="button" disabled={busy || !config?.enabled} onClick={() => void toggle()}>{subscribed && account?.browser_notifications_enabled ? t('pushDisable') : t('pushEnable')}</button>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>
}
