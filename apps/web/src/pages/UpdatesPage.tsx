import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import './UpdatesPage.css'

const releaseNotes = [
  'CookBook YAML ZIP bulk import with preview and duplicate detection',
  'Recipe filters for rating, calories, cuisine, type, and tags',
  'User feedback workflow with administrator review and completion notices',
  'Compact recipe cards for long imported descriptions',
]

export function UpdatesPage() {
  const { account } = useAuth()
  const t = translator(account?.locale)

  return <section className="page updates-page">
    <div className="page-heading"><div><p className="eyebrow">Mad Planner</p><h1>{t('whatsNew')}</h1><p>{t('updatesIntro')}</p></div><span className="version-badge">v0.1.0</span></div>
    <article className="release-card">
      <header><div><small>{t('currentVersion')}</small><h2>Mad Planner 0.1.0</h2></div><span>{t('installed')}</span></header>
      <p>{t('releaseSummary')}</p>
      <ul>{releaseNotes.map((note) => <li key={note}>{note}</li>)}</ul>
    </article>
  </section>
}
