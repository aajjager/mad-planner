import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import './UpdatesPage.css'
import { localizedReleases, releaseNoteSummary } from '../utils/releases'


export function UpdatesPage() {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  function toggle(version: string) { setExpanded((current) => { const next = new Set(current); if (next.has(version)) next.delete(version); else next.add(version); return next }) }
  const { account } = useAuth()
  const t = translator(account?.locale)
  const releases = localizedReleases(account?.locale)

  return <section className="page updates-page">
    <div className="page-heading"><div><p className="eyebrow">Mad Planner</p><h1>{t('whatsNew')}</h1><p>{t('updatesIntro')}</p></div><span className="version-badge">v{releases[0].version}</span></div>
    <p className="release-details-hint">{t('releaseDetailsHint')}</p>
    {releases.map((release, index) => <article className="release-card" key={release.version}>
      <header><div><small>{index === 0 ? t('currentVersion') : release.period}</small><h2><button type="button" className="release-toggle" aria-expanded={expanded.has(release.version)} aria-controls={`release-${release.version}`} title={`${expanded.has(release.version) ? t('hideReleaseDetails') : t('showReleaseDetails')} ${release.version}`} onClick={() => toggle(release.version)}>Mad Planner {release.version}<span aria-hidden="true">{expanded.has(release.version) ? ' −' : ' +'}</span></button></h2></div>{index === 0 && <span>{t('installed')}</span>}</header>
      {index === 0 && <p>{t('releaseSummary')}</p>}
      {index === 0 && <p>{release.period}</p>}
      <div id={`release-${release.version}`}>{release.groups.map((group) => <section key={group.title}><h3>{group.title}</h3><ul>{group.notes.map((note) => <li key={note}>{expanded.has(release.version) ? note : releaseNoteSummary(note, account?.locale)}</li>)}</ul></section>)}</div>
    </article>)}
  </section>
}
