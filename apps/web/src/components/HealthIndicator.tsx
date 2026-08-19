import { useEffect, useState } from 'react'

export function HealthIndicator() {
  const [state, setState] = useState<'checking' | 'online' | 'offline'>('checking')
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/v1/health', { signal: controller.signal }).then((response) => setState(response.ok ? 'online' : 'offline')).catch((error: Error) => { if (error.name !== 'AbortError') setState('offline') })
    return () => controller.abort()
  }, [])
  return <div className={`api-status api-status--${state}`} role="status"><span className="status-dot" />{state === 'checking' ? 'Checking API' : state === 'online' ? 'API online' : 'API unavailable'}</div>
}
