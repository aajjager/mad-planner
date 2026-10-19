import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'

export function PreviewBanner() {
  const { account } = useAuth()
  const t = translator(account?.locale)
  const [version, setVersion] = useState<{ job: number; revision: number; head_sha: string } | null>(null)
  useEffect(() => {
    let active = true
    void fetch('/preview-version.json', { cache: 'no-store' }).then((response) => response.json()).then((data) => {
      if (active && Number.isInteger(data.job) && Number.isInteger(data.revision) && /^[a-f0-9]{40}$/.test(data.head_sha)) setVersion(data)
    }).catch(() => undefined)
    return () => { active = false }
  }, [])
  return version && <aside className="notice">{t('testPreview')} · #{version.job} · {t('implementationRevision')} {version.revision} · <code>{version.head_sha.slice(0, 12)}</code><p>{t('testPreviewHelp')}</p></aside>
}
