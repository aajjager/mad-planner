import type { Feedback, FeedbackCategory } from '../api/auth'
import { releaseVersion, type ChangeCategory } from './releases'

const categories: Record<FeedbackCategory, { singular: string; plural: string; heading: ChangeCategory }> = {
  bug: { singular: 'bug fix', plural: 'bug fixes', heading: 'Bug fixes' },
  feature: { singular: 'feature request', plural: 'feature requests', heading: 'Features' },
  improvement: { singular: 'improvement', plural: 'improvements', heading: 'Improvements' },
}

export function feedbackPrompt(category: FeedbackCategory, items: Feedback[], origin: string, date = new Date()): string {
  const type = categories[category]
  const batch = items.length !== 1
  const requests = items.map((item, index) => `${batch ? `${index + 1}. ` : ''}${item.content}${item.attachment_url ? `\n\nUser attachment: ${origin}${item.attachment_url}` : ''}`).join('\n\n')
  return `Please implement ${batch ? 'these approved Mad Planner ' + type.plural : 'this approved Mad Planner ' + type.singular}:\n\nRequest type: ${category}\n\n${requests}\n\n${batch ? 'Treat these as one reviewable implementation batch while keeping each request independently testable. ' : ''}Keep the existing architecture, preserve current data, add relevant tests, and make the Git changes reviewable. Follow AGENTS.md. Update CHANGELOG.md with every user-visible change under ### ${type.heading} in the completion week's release. Use year since 2026.month.week in Europe/Copenhagen time, with days 1–7, 8–14, 15–21, and 22–month-end as weeks 1–4. At prompt creation the release is ${releaseVersion(date)}; recalculate if implementation finishes in another week. Run node scripts/sync-changelog.mjs and keep the API version aligned. When the work and tests are complete, tell me exactly what changed and ask me to commit and push it; include the suggested Git commands.`
}
