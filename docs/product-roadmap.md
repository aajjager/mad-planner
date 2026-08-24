# Mad Planner expanded product roadmap

This roadmap orders requested features by dependency so database and permission changes are introduced safely before the screens that rely on them.

## Phase 10 — Family preferences and permissions

- Store household size and use it as the default planned serving count.
- Store a family-wide leftovers toggle.
- Store family-wide breakfast, lunch, and dinner toggles.
- Store a family-wide cooking-mode toggle.
- Replace the single member role with owner, editor, planner, and viewer permissions.
- Let owners choose permissions when inviting or editing a member.
- Move planner preferences out of the weekly planner and into family settings.
- Calculate leftover availability from recipe yield, household size, and planned servings.

Leftovers must be quantity-aware. For example, a recipe yielding four portions serves a two-person household for dinner and leaves two portions for lunch. It does not automatically create leftovers for a four-person household unless the planned quantity is increased.

## Phase 11 — Recipe types and guided recipe entry

- Add family-managed recipe types such as breakfast, lunch, dinner, bake-off, cake, dessert, snack, and bread.
- Suggest recipe types during website import from structured categories, text, and existing tags.
- Require the user to confirm or correct suggested types before saving.
- Require at least one manually selected type when no reliable suggestion exists.
- Replace the current manual recipe form with a guided sequence: basics, type, servings/times, ingredients, instructions, photo, and review.
- Keep instructions uniformly ordered and validated.

Recipe types are distinct from free-form tags: types control planner eligibility, while tags remain useful for attributes such as quick, vegetarian, or freezer-friendly.

## Phase 12 — Persistent grocery lists

- Persist generated grocery lists and their items in PostgreSQL.
- Add manual grocery items.
- Parse Danish and English quantity phrases such as `6 bananas` and `2 ds tomater`.
- Normalize common units and aliases, including `ds`/`dåse`/`dåser`.
- Mark an item purchased by clicking it and move it out of the active list.
- Add purchase history and undo/restore actions.
- Categorize items and assign icons using a maintained category mapping with safe generic fallbacks.
- Enforce family permissions for viewing and editing groceries.

Icons should be category-driven rather than maintained for every possible product. For example, tomatoes use produce/tomato, while soap and toilet-cleaning tablets use cleaning/soap.

## Phase 13 — Recipe photos, cooking mode, and scanning

- Add persistent media storage outside the application containers.
- Support camera capture and file upload for manually created recipes.
- Display recipes in a high-contrast white-paper reading view.
- Add an optional cooking mode that marks steps complete only for the current cooking session.
- Allow undoing completed steps without changing the stored recipe.
- Add book-recipe scanning: image upload, OCR, structured preview, correction, and confirmation before saving.

Original scans should be retained only when the user chooses to keep them. OCR output must always be reviewed because quantities and units are safety-sensitive.

## Phase 14 — Personal language settings

- Add a personal locale setting to each user account.
- Translate application navigation and interface text into English, Danish, and Dutch.
- Keep recipes in their original language initially; recipe translation is a separate future capability.
- Format dates, quantities, and units for the signed-in user's locale.

## Phase 15 — Strong authentication

- Add account recovery before enabling stronger authentication requirements.
- Add TOTP MFA with recovery codes.
- Add WebAuthn/passkeys as the preferred passwordless option.
- Add passkey and MFA management to personal account security settings.
- Require HTTPS and a stable hostname on TrueNAS before production passkey enrollment.
- Add security-event logging and rate limiting for login and recovery endpoints.

## Phase 16 — Deployment resilience

- Add a dedicated media dataset/volume alongside PostgreSQL storage.
- Add a supported backup command producing timestamped PostgreSQL dumps.
- Document and test restoration into a clean stack.
- Add pre-update TrueNAS snapshot guidance and a post-update health checklist.
- Pin production image versions so updates are deliberate and reversible.
- Verify authentication, family isolation, media, backups, and restore on TrueNAS SCALE.

## Data compatibility rules

- Every schema change uses a reviewed Alembic migration.
- Updates must never delete the PostgreSQL volume or TrueNAS dataset.
- Destructive migrations require a tested backup and restore path first.
- Existing recipes, plans, families, and accounts receive safe migration defaults.
- Application containers remain disposable; PostgreSQL and uploaded media remain persistent.
