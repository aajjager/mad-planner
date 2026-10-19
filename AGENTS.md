# Mad Planner changes

- Preserve the existing architecture and user data; add relevant regression tests.
- Update CHANGELOG.md only for completed improvements, bug fixes, and feature
  requests, under their completion week's release. Do not add entries for ordinary
  conversation, questions, explanations, Git help, deployment support, or project
  instruction changes unless the user explicitly requests a changelog entry.
- Versions use `year since 2026.month.week` in Europe/Copenhagen time: 2026 = 0,
  January = 1, October = 10. Days 1–7 = week 1, 8–14 = 2, 15–21 = 3,
  and 22 through the end of the month = 4. For example, 18 October 2026 = 0.10.3.
- Group entries under `### Bug fixes`, `### Features`, or `### Improvements`.
  Match the approved feedback category: bug → Bug fixes, feature → Features,
  improvement → Improvements. Record every completed qualifying request in a batch.
- Reuse the current week's section or add a new section above older releases.
  Keep historical releases intact. Do not use Unreleased for completed work.
- Run `node scripts/sync-changelog.mjs` after editing CHANGELOG.md. The web copy
  is packaged for Docker; the Updates page and family version link read it.
- Keep the API project version aligned with the newest release. Test before
  proposing a commit. Follow the user's current commit/push instructions and
  never include credentials or unrelated deployment changes.
- Do not include `git diff --cached` in user-facing Git instructions unless asked.
- Keep the interactive welcome guide in apps/web/src/components/welcomeGuideContent.ts
  current with user-facing feature changes. Update relevant tips and all three
  languages, respect account permissions, and add regression coverage as needed.
  Review guide accuracy for every feature implementation; do not reset completed
  guides for routine updates. The Updates page provides release-by-release news.
- When verifying changes against the local Docker app, rebuild the affected
  services and verify localhost:8080 before reporting the changes as visible there.

## Working across machines

- Keep durable project workflow instructions in this tracked AGENTS.md so they
  travel with the repository. Follow these defaults without asking the user to
  repeat them, while honoring newer task-specific instructions.
- Start from README.md and the relevant source and tests; inspect the current Git
  status before editing. Preserve unrelated work and never assume previous chat
  changes were committed, pushed, deployed, or tested on this machine.
- Use paths and available tools on the current machine rather than assuming the
  original computer's paths, credentials, Docker containers, or chat history exist.
- Report what changed, relevant test results, and whether changes are committed
  and pushed. Keep user-facing explanations concise and easy to understand.
