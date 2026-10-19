import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import './UpdatesPage.css'
import { releases } from '../utils/releases'


export function UpdatesPage() {
  const { account } = useAuth()
  const t = translator(account?.locale)

  return <section className="page updates-page">
    <div className="page-heading"><div><p className="eyebrow">Mad Planner</p><h1>{t('whatsNew')}</h1><p>{t('updatesIntro')}</p></div><span className="version-badge">v{releases[0].version}</span></div>
    {releases.map((release, index) => <article className="release-card" key={release.version}>
      <header><div><small>{index === 0 ? t('currentVersion') : release.period}</small><h2>Mad Planner {release.version}</h2></div>{index === 0 && <span>{t('installed')}</span>}</header>
      {index === 0 && <p>{t('releaseSummary')}</p>}
      <p>{release.period}</p>
      {release.groups.map((group) => <section key={group.title}><h3>{group.title}</h3><ul>{group.notes.map((note) => <li key={note}>{note}</li>)}</ul></section>)}
    </article>)}
  </section>
}
