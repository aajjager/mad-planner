import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImplementationPanel } from './ImplementationPanel'
import type { Feedback } from '../api/auth'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { locale: 'en' } }) }))
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
const feedback = { id: 4, status: 'approved', category: 'improvement', content: 'Improve the recipe editor', is_question: false } as Feedback
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Implementation controls', () => {
  it('keeps actionable jobs active and completed jobs in history without deleting them', async () => {
    const jobs = ['queued', 'ready', 'failed', 'merged', 'cancelled'].map((status, id) => ({
      id, revision: 1, status, request_text: `${status} request`, details: { pr_number: id + 10 },
    }))
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ enabled: true, jobs }))
    render(<ImplementationPanel feedback={[feedback]} />)
    await screen.findByText('failed request')
    expect(screen.getByText('queued request')).toBeVisible()
    expect(screen.getByText('ready request')).toBeVisible()
    expect(screen.queryByText('merged request')).not.toBeInTheDocument()
    expect(screen.queryByText('cancelled request')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'History (2)' }))
    expect(screen.getByText('merged request')).toBeVisible()
    expect(screen.getByText('cancelled request')).toBeVisible()
    expect(screen.queryByText('failed request')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Implement' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Review changes' })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Active (3)' }))
    expect(screen.getByText('failed request')).toBeVisible()
    expect(fetch.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })

  it('moves a completed job into history when its status refreshes', async () => {
    let merged = false
    vi.spyOn(globalThis, 'fetch').mockImplementation((_, options) => {
      if (options?.method) merged = true
      return Promise.resolve(response({ enabled: true, jobs: [{ id: 7, revision: 1,
        status: merged ? 'merged' : 'ready', request_text: 'Completed change', details: { head_sha: 'a'.repeat(40) } }] }))
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ImplementationPanel feedback={[]} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Approve and merge' }))
    await screen.findByText('No current implementations. Completed and cancelled jobs are in History.')
    expect(screen.queryByText('Completed change')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'History (1)' }))
    expect(screen.getByText('Completed change')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Approve and merge' })).not.toBeInTheDocument()
  })

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
