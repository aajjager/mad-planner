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
- [ ] Add Mummum and Arla fixtures/adapters as needed

## Later phases
- [ ] Phase 4 — Tags and filtering
- [ ] Phase 5 — Weekly planner
- [ ] Phase 6 — Grocery lists
- [ ] Phase 7 — Smart meal generation
- [ ] Phase 8 — TrueNAS deployment
