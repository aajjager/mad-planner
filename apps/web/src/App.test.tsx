import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows the homepage and a healthy API status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Your week of meals, made simple.' })).toBeInTheDocument()
    expect(await screen.findByText('API online')).toBeInTheDocument()
  })

  it('shows when the API is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    render(<App />)
    expect(await screen.findByText('API unavailable')).toBeInTheDocument()
  })
})
