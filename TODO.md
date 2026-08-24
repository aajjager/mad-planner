# Mad Planner roadmap

## Phase 1 — Initial application

- [x] Initialize the repository structure
- [x] Add a minimal FastAPI application
- [x] Add an API health endpoint and test
- [x] Add PostgreSQL connectivity and database health checking
- [x] Add the React frontend and basic homepage
- [x] Add Dockerfiles and Compose configuration
- [x] Verify the complete stack with `docker compose up`

## Phase 2 — Recipe database and CRUD

- [x] Add recipe, ingredient, unit, and instruction models
- [x] Add the initial Alembic migration
- [x] Add recipe API schemas and CRUD endpoints
- [x] Add recipe list and details pages
- [x] Add manual recipe creation

## Phase 3 — Recipe importer

- [x] Add safe URL fetching and JSON-LD preview endpoint
- [x] Add importer preview and confirmation UI
- [x] Parse and normalize ingredient quantities
- [x] Add generic HTML fallback
- [x] Add Mummum and Arla fixtures/adapters as needed

## Phase 4 — Tags and filtering

- [x] Add persistent recipe tags
- [x] Add tags to recipe creation and imported categories
- [x] Add recipe search and tag filtering

## Phase 5 — Weekly planner

- [x] Add persistent breakfast, lunch, and dinner assignments
- [x] Add weekly planner API
- [x] Add seven-day planner interface and week navigation

## Phase 6 — Grocery lists

- [x] Generate grocery lists from a planned week
- [x] Combine matching ingredients and scale planned servings
- [x] Add a weekly grocery checklist interface

## Phase 7 — Smart meal generation

- [x] Allow a cooked meal to become next-day lunch leftovers
- [x] Generate a varied week from recipe tags and meal types
- [x] Add generation preferences and review before applying
- [x] Classify recipes for breakfast, lunch, and/or dinner

## Later phases
- [x] Phase 8 — Accounts and shared families
  - [x] Add family, user, membership, invitation, and session models
  - [x] Add owner setup, login, logout, and invitation APIs
  - [x] Scope recipes, plans, and grocery lists to a family
  - [x] Add login and family management interfaces
  - [x] Add owner-only login and invitation administration
- [ ] Phase 9 — TrueNAS deployment
  - [x] Add a TrueNAS Compose override and environment template
  - [x] Add published container images and a TrueNAS Apps YAML configuration
  - [x] Document installation, backup, restore, and update procedures
  - [ ] Deploy and verify the stack on the user's TrueNAS SCALE system

- [x] Phase 10 — Family preferences and permissions
  - [x] Add household size and leftovers preferences
  - [x] Move enabled meal types into family settings
  - [x] Add cooking-mode preference
  - [x] Add configurable member permissions
  - [x] Make leftovers quantity-aware

- [x] Phase 11 — Recipe types and guided entry
  - [x] Add family-managed recipe types
  - [x] Suggest and confirm types during recipe import
  - [x] Add a guided manual recipe workflow
  - [x] Require type selection when classification is uncertain

- [x] Phase 12 — Persistent grocery lists
  - [x] Add manual grocery items and quantity parsing
  - [x] Persist purchased state and history
  - [x] Add undo and restore actions
  - [x] Add category-based grocery icons

- [ ] Phase 13 — Recipe media and cooking mode
  - [ ] Add persistent recipe photo storage and camera upload
  - [ ] Add white-paper recipe reading view
  - [ ] Add reversible cooking-step completion
  - [ ] Add book-recipe OCR with review before saving

- [ ] Phase 14 — Personal languages
  - [ ] Add per-user locale settings
  - [ ] Translate the interface into English, Danish, and Dutch
  - [ ] Localize dates, quantities, and units

- [ ] Phase 15 — MFA and passkeys
  - [ ] Add account recovery and security-event logging
  - [ ] Add TOTP MFA and recovery codes
  - [ ] Add WebAuthn/passkeys after HTTPS and hostname setup

- [ ] Phase 16 — Deployment resilience
  - [ ] Add persistent media storage
  - [ ] Add and test PostgreSQL backup/restore tooling
  - [ ] Pin production versions and document rollback

See [docs/product-roadmap.md](docs/product-roadmap.md) for design notes and dependency ordering.
