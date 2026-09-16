import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import './UpdatesPage.css'

const releases = [
  { version: '0.2.3', period: 'September 2026 · week 3', notes: [
    'Family-only rating filtering for owned recipes',
    'Branded iOS and installable-app icons',
    'Reviewable tag suggestions for selected recipes',
    'Removal of recipes shared with your family',
    'Screenshot paste support for feedback',
    'Whole-card selection when managing multiple recipes',
    'Grouped administrator feedback completion',
  ] },
  { version: '0.1.4', period: 'August 2026 · week 4', notes: [
    'CookBook YAML ZIP bulk import with preview and duplicate detection',
    'Recipe filters for rating, calories, cuisine, type, and tags',
    'User feedback workflow with administrator review and completion notices',
    'Compact recipe cards for long imported descriptions',
  ] },
]

export function UpdatesPage() {
  const { account } = useAuth()
  const t = translator(account?.locale)

  return <section className="page updates-page">
    <div className="page-heading"><div><p className="eyebrow">Mad Planner</p><h1>{t('whatsNew')}</h1><p>{t('updatesIntro')}</p></div><span className="version-badge">v{releases[0].version}</span></div>
    {releases.map((release, index) => <article className="release-card" key={release.version}>
      <header><div><small>{index === 0 ? t('currentVersion') : release.period}</small><h2>Mad Planner {release.version}</h2></div>{index === 0 && <span>{t('installed')}</span>}</header>
      {index === 0 && <p>{t('releaseSummary')}</p>}
      <ul>{release.notes.map((note) => <li key={note}>{note}</li>)}</ul>
    </article>)}
  </section>
}
