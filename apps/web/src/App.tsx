import { useEffect, useState } from 'react'
import './App.css'

type ApiState = 'checking' | 'online' | 'offline'

function App() {
  const [apiState, setApiState] = useState<ApiState>('checking')

  useEffect(() => {
    const controller = new AbortController()

    async function checkApi() {
      try {
        const response = await fetch('/api/v1/health', {
          signal: controller.signal,
        })
        setApiState(response.ok ? 'online' : 'offline')
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setApiState('offline')
      }
    }

    void checkApi()
    return () => controller.abort()
  }, [])

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Mad Planner home">
          <span className="brand-mark" aria-hidden="true">M</span>
          Mad Planner
        </a>
        <div className={`api-status api-status--${apiState}`} role="status">
          <span className="status-dot" aria-hidden="true" />
          {apiState === 'checking' && 'Checking API'}
          {apiState === 'online' && 'API online'}
          {apiState === 'offline' && 'API unavailable'}
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">Plan well. Waste less. Eat better.</p>
        <h1 id="hero-title">Your week of meals, made simple.</h1>
        <p className="hero-copy">
          Mad Planner will bring recipes, weekly planning, and organized grocery
          lists together in one private, self-hosted home.
        </p>
        <div className="phase-card">
          <span>Currently building</span>
          <strong>Phase 1 · Application foundation</strong>
        </div>
      </section>

      <section className="feature-grid" aria-label="Planned features">
        <article>
          <span aria-hidden="true">01</span>
          <h2>Collect recipes</h2>
          <p>Save favorites from the web or add your own recipes manually.</p>
        </article>
        <article>
          <span aria-hidden="true">02</span>
          <h2>Plan the week</h2>
          <p>Arrange meals across the week in a clear, flexible planner.</p>
        </article>
        <article>
          <span aria-hidden="true">03</span>
          <h2>Shop smarter</h2>
          <p>Combine ingredients into one practical, organized grocery list.</p>
        </article>
      </section>
    </main>
  )
}

export default App
