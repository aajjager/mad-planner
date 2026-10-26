import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { useEffect, useState } from 'react'

export function HealthIndicator() {
  const { account } = useAuth(); const t = translator(account?.locale)
  const [state, setState] = useState<'checking' | 'online' | 'offline'>('checking')
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/v1/health', { signal: controller.signal }).then((response) => setState(response.ok ? 'online' : 'offline')).catch((error: Error) => { if (error.name !== 'AbortError') setState('offline') })
    return () => controller.abort()
  }, [])
  return <div className={`api-status api-status--${state}`} role="status"><span className="status-dot" />{state === 'checking' ? t('checkingApi') : state === 'online' ? t('apiOnline') : t('apiUnavailable')}</div>
}
