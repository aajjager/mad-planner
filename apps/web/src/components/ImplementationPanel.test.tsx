import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImplementationPanel } from './ImplementationPanel'
import type { Feedback } from '../api/auth'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { locale: 'en' } }) }))
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
const feedback = { id: 4, status: 'approved', category: 'improvement', content: 'Improve the recipe editor', is_question: false } as Feedback
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Implementation controls', () => {
  it('only queues approved requests, excludes questions, and requires a configured worker', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ enabled: false, jobs: [] }))
    render(<ImplementationPanel feedback={[feedback, { ...feedback, id: 5, is_question: true }, { ...feedback, id: 6, status: 'pending' }]} />)
    await screen.findByText(/Worker connection/)
    expect(screen.getAllByRole('button', { name: 'Implement' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Implement' })).toBeDisabled()
    expect(fetch.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })

  it('submits the exact tested commit and revision after explicit approval', async () => {
    const sha = 'a'.repeat(40)
    const job = { id: 7, feedback_id: 4, revision: 2, status: 'ready', request_text: feedback.content, details: { head_sha: sha, preview_url: 'http://127.0.0.1:8090', tests_passed: true, pr_number: 8 } }
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((_, options) => Promise.resolve(response(options?.method ? {} : { enabled: true, jobs: [job] })))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ImplementationPanel feedback={[feedback]} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Approve and merge' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/v1/implementations/7/approve', expect.objectContaining({ body: JSON.stringify({ revision: 2, head_sha: sha }) })))
    expect(screen.getByRole('link', { name: 'Open preview' })).toHaveAttribute('href', job.details.preview_url)
    expect(screen.queryByRole('button', { name: 'Implement' })).not.toBeInTheDocument()
  })

  it('shows stale-approval failures instead of claiming a merge succeeded', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_, options) => Promise.resolve(options?.method
      ? response({ detail: 'The preview has changed; review it again' }, 409)
      : response({ enabled: true, jobs: [{ id: 7, revision: 2, status: 'ready', request_text: 'Change', details: { head_sha: 'a'.repeat(40) } }] })))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ImplementationPanel feedback={[]} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Approve and merge' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The preview has changed; review it again')
  })
})
