# Mad Planner changelog

All notable user-visible changes are recorded here. Versions use year since 2026.month.week in Europe/Copenhagen time: 2026 = 0, October = 10; days 1–7 = week 1, 8–14 = week 2, 15–21 = week 3, and 22–month-end = week 4. Older release numbers below are retained as historical identifiers.

## 0.10.4 — October 2026, week 4

### Bug fixes

- Fixed saving scanned recipes with long ingredient commentary exceeding the database name limit. Ingredient names and notes are stored separately, while the complete scanned ingredient text and existing authored notes are preserved.

- Improved cookbook scanning with image enlargement, local contrast correction, separate reading passes for book spreads, and column-aware text ordering. Preserved scanned introductions in an editable description and joined wrapped ingredient lines; review quantities and OCR text before saving.

- Fixed implementation jobs failing on routine weekly version updates or ignored dependency symlinks. Version-only updates are checked against the current release; dependency/configuration changes and symlinks in published source still require manual review.

- Recipe imports now select the recipe title instead of publisher or author names such as Valdemarsro. Existing saved recipes are preserved; review the title when reimporting an affected recipe.

### Features

- Weekly planning preferences now search saved meal names alongside ingredients and styles, including small typos such as “bruger” for burger. Select a matching meal to prioritize it in suggested plans for any week.

### Improvements

- Improved book OCR with verified higher-accuracy English, Danish, and Dutch models, language selection, focused reading of ingredient columns, and grouping of wrapped ingredient notes. Photo-only images can be excluded from text scanning, unreliable photo text is ignored, and ingredient-only pages explicitly ask for cooking instructions instead of inventing steps.

- Cookbook scanning now accepts up to six photos of the same recipe, including page views and close-ups. Add or remove photos, follow per-photo progress, combine overlapping text into one editable preview using recognition confidence, and choose the saved recipe image. Failed photos are reported while successful scans remain available for review. Updated guidance in English, Danish, and Dutch.

- Grouped manual recipe creation, website imports, cookbook scans, and CookBook archive imports in a guided Add recipe menu with equally sized, aligned option cards. Simplified collection and navigation actions, added return links to choose another method, and updated the welcome guide in English, Danish, and Dutch.

- Completed Danish and Dutch recipe filters, sorting, ratings, navigation, planner states, and backup controls. The Updates page now translates release dates, categories, and the full release history using the account language; personal language choices and saved data are preserved.


## 0.10.3 — October 2026, week 3

### Improvements

- Combined browser and background notifications into one switch in personal settings. Enabling registers background delivery and requests permission when needed; existing granted opt-ins register automatically. Turning it off pauses account notifications and removes this device's subscription.

- Implementation workspace now keeps merged and cancelled jobs in a separate History view. Current jobs and failures needing attention remain in the main view; saved job details and review links are retained.

- Added lavender, terracotta, and teal menu palettes in Family personal settings, with light and dark variants and English, Danish, and Dutch labels. Existing colour choices are preserved, and saved palettes are restored when reopening the app.

- Completed feedback notices now disappear after five days and can still be dismissed earlier. Closed request history is retained, and expired completions no longer trigger browser notifications.

- Owners and editors can edit saved family recipes using the prefilled recipe form, including details, ingredients, and instructions. Recipe identity, pictures, source nutrition, ratings, sharing, and meal-plan links are retained.

- Guide navigation now opens the relevant page and scrolls to and highlights the specific Family settings section, including sections that load after opening the page.

- Expanded the welcome guide with personal preferences, account security, shared family planning options, recipe types, member invitations, and permissions. The Family page offers a direct shortcut to these tips.

- Added an interactive first-visit welcome guide covering recipes, importing, meal planning, groceries, family feedback, and Updates. Reopen it anytime; tips respect account permissions and are available in English, Danish, and Dutch. Guide dismissal is remembered per account in the current browser.

- Recipe descriptions now collapse to five visible lines, adapting to screen width, with Read more / Read less controls when the text overflows. The full saved description is preserved.

- Recipe imports now preserve paragraph-based instruction steps, including Valdemarsro recipes, instead of combining the whole method into one step. Previously flattened imports need reimporting to recover their original steps.

- Long recipe descriptions now start with a short preview and offer Show more / Show less, keeping the full saved text available.

- Added a family deletion warning that names the family and requires typing delete before permanent deletion is enabled.

- Administrators can mark feedback as a question and send or revise an answer. Requesters see red unread-answer counts on their family links, can read and acknowledge replies in Family settings, and keep answers in their closed request history.

- Aligned release numbers with the calendar month and four week buckets; the Updates page and family version link now use the packaged changelog.
- Added visible Bug fixes, Features, and Improvements groups for new releases. Single and grouped Codex prompts preserve the approved request type and require entries in the correct weekly changelog group. Added project guidance for all future implementations.

### Features

- Added opt-in background Web Push for incomplete meal plans and completed feedback, with per-device enable/disable, English/Danish/Dutch messages, daily planning limits, and automatic cleanup of expired subscriptions. Requires administrator VAPID setup and HTTPS; phone delivery depends on browser/OS support.

- Added an optional administrator implementation workspace with queued jobs, progress, preview and pull-request links, revision requests, and approval of the exact tested commit. A separately configured Linux controller runs isolated implementations and checks, publishes preview branches, and merges only after approval. TrueNAS deployment remains manual; worker credentials and a protected preview address must be configured before use.

### Bug fixes

- Fixed HTML tags and encoded characters appearing in imported recipe instructions, including HelloFresh recipes. Previously saved recipes also display readable instructions without needing to be imported again.

## 0.2.5 — September 2026, week 5

- Added the public IP address to administrator login history for new successful and failed login attempts, including MFA failures. Existing history remains available and is marked as not recorded.
- Limited the initial security history to the newest 30 events, with filters for successful logins, failed logins, password resets, and MFA changes plus on-demand access to older events.
- Restored nutrition estimates for older imported recipes by reading quantities and units from their original ingredient text, with broader Danish, English, and Dutch food recognition.
- Labelled estimated nutrition as per serving, whole recipe, or whole baking batch so totals such as cookie calories are not presented as a single serving.
- Improved book-recipe scanning with two complementary page-layout passes, expanded multilingual section headings, better numbered-step handling, wrapped instruction recovery, and clearer missing-section warnings.

## 0.2.4 — September 2026, week 4

- Split personal feedback history into Open and Closed request views, with Open shown by default.
- Added owner access to Administration from the mobile navigation and improved phone layouts for feedback review and approval controls.

## 0.2.3 — September 2026, week 3

- Added an optional Cloudflare Tunnel deployment for HTTPS without router port forwarding.
- Limited recipe rating filters and rating sorting to ratings made by the current family on its own recipes.
- Added branded home-screen icons based on the Mad Planner bowl-and-heart logo.
- Added editable, per-recipe tag suggestions for multi-selected recipes, with separate accept and deny actions.
- Added monthly and weekly version history to the in-app Updates page.
- Added removal of recipes shared with the current family without deleting the source family’s recipe.
- Added direct clipboard screenshot pasting to feedback submissions.
- Made the full recipe card clickable while selecting multiple recipes.

The releases below retain their original development-month numbering; new releases use the calendar-based convention above.

## 0.2.2 — September 2026, week 2

- Added required improvement, bug, and feature-request categories to feedback submissions; existing pending and approved requests are placed under Feature request.
- Added category-based administrator prompts that combine all approved requests of one type for Codex.
- Added a single administrator action to complete every approved request in a category and notify all requesters.
- Added category-specific in-app and browser completion notifications for the original requester.

- Added multi-select recipe management for publishing or unpublishing recipes and adding or removing tags in one action.

- Added an opt-in public recipe library where families can browse and import independent recipe copies.
- Added optional image, PDF, or text attachments to feedback and improvement requests.
- Added private automatic recipe analysis that suggests useful tags and meal classifications from recipe text and ingredients.
- Improved tag contrast across all accent colors when dark mode is enabled.

- Added a first-install choice between example recipes and an empty collection.
- Added user feedback submissions and an administrator approval backlog.
- Added administrator completion tracking and in-app notifications for the user who requested an improvement.
- Added separate active and archived administrator feedback views, with permanent deletion for archived requests.
- Added combinable family-rating and calories-per-serving range filters to the recipe collection.
- Added CookBook Manager YAML ZIP preview and bulk import with duplicate-name detection and recipe-type fallback.
- Fixed CookBook imports failing when one recipe repeats the same ingredient in multiple sections.
- Limited recipe-card descriptions to six lines so long imported text keeps the collection compact.
- Added an Updates page showing the installed version and release highlights.
- Moved the Updates link into Family settings to keep the main header uncluttered.
- Added an installation-administrator control for downloading portable PostgreSQL database backups.
- Matched the backup client to PostgreSQL 18 so administrator downloads work with the deployed database.
- Added a separate administrator download for all uploaded recipe photos.
- Added non-destructive database-backup validation using a disposable PostgreSQL database.
- Fixed web backup validation so the uploaded dump is applied to the disposable database before checks run.
- Added guided HTTPS configuration for Debian and TrueNAS reverse proxies, including secure cookies and loopback binding.
- Made smart planning reuse surplus recipe portions on the same meal across consecutive days without duplicating grocery quantities.
- Fixed consecutive leftover meals falling back to lunch when applying a suggested plan.
- Added copyable Codex implementation prompts that require tests, a changelog update, and a final commit request.
- Fixed “Copy for Codex” on local HTTP installations by adding a compatible clipboard fallback.
