# Mad Planner changelog

All notable user-visible changes to Mad Planner are recorded here. Releases will use semantic version numbers once the controlled update system is introduced.

## Unreleased

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
