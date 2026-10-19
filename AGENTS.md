# Mad Planner changes

- Preserve the existing architecture and user data; add relevant regression tests.
- Every implementation must update CHANGELOG.md under its completion week's release.
- Versions use `year since 2026.month.week` in Europe/Copenhagen time: 2026 = 0,
  January = 1, October = 10. Days 1–7 = week 1, 8–14 = 2, 15–21 = 3,
  and 22 through the end of the month = 4. For example, 18 October 2026 = 0.10.3.
- Group entries under `### Bug fixes`, `### Features`, or `### Improvements`.
  Match the approved feedback category: bug → Bug fixes, feature → Features,
  improvement → Improvements. Record every completed request in a batch.
- Reuse the current week's section or add a new section above older releases.
  Keep historical releases intact. Do not use Unreleased for completed work.
- Run `node scripts/sync-changelog.mjs` after editing CHANGELOG.md. The web copy
  is packaged for Docker; the Updates page and family version link read it.
- Keep the API project version aligned with the newest release. Test before
  proposing a commit. Follow the user's current commit/push instructions and
  never include credentials or unrelated deployment changes.
