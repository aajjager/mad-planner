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
- [ ] Phase 8 — TrueNAS deployment
  - [x] Add a TrueNAS Compose override and environment template
  - [x] Add published container images and a TrueNAS Apps YAML configuration
  - [x] Document installation, backup, restore, and update procedures
  - [ ] Deploy and verify the stack on the user's TrueNAS SCALE system
