# Mad Planner

Mad Planner is a self-hosted meal-planning, recipe-management, and grocery-planning application.

The project is being built incrementally as a modular monolith:

- React and TypeScript frontend
- FastAPI backend
- PostgreSQL database
- Docker Compose deployment

## Run the complete application

Copy the example environment file, then build and start all three services:

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

Open <http://localhost:8080>. The web container serves the React application and proxies `/api` requests internally to FastAPI. PostgreSQL data is retained in the named `postgres_data` volume.

Check container health with:

```powershell
docker compose ps
```

Stop the application without deleting its database data:

```powershell
docker compose down
```

The `.env` file is ignored by Git. Change its password before deploying outside local development.

## Database migrations

Run schema migrations from `apps/api` with:

```powershell
alembic upgrade head
```

Inside the Compose stack, use:

```powershell
docker compose exec api alembic upgrade head
```

Every database schema change must be represented by an Alembic migration.
The API container applies pending migrations automatically before it starts serving requests.

## Recipe API

The initial recipe API is available under `/api/v1/recipes`:

```text
GET    /api/v1/recipes
POST   /api/v1/recipes
GET    /api/v1/recipes/{recipe_id}
PUT    /api/v1/recipes/{recipe_id}
DELETE /api/v1/recipes/{recipe_id}
```

Interactive API documentation is available at <http://localhost:8080/api/docs> when the Compose stack is running.

## Current status

Phase 1 is complete. The React frontend, FastAPI backend, and PostgreSQL database run together through Docker Compose with container health checks and persistent database storage.

## Backend development

From `apps/api`, create and activate a virtual environment, then install the development dependencies:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

Run the API:

```powershell
uvicorn madplanner.main:app --reload
```

Open <http://127.0.0.1:8000/api/v1/health>. A healthy API returns:

```json
{"status":"ok","service":"madplanner-api","database":"not_checked"}
```

The database-aware readiness check is available at <http://127.0.0.1:8000/api/v1/health/ready>. It returns HTTP `200` when PostgreSQL is reachable and HTTP `503` otherwise.

Run the tests:

```powershell
pytest
```

## Frontend development

From `apps/web`, install dependencies and run the development server:

```powershell
npm install
npm run dev
```

Vite opens the frontend at <http://127.0.0.1:5173> and proxies `/api` requests to the locally running backend. Use `npm test`, `npm run lint`, and `npm run build` to verify frontend changes.

## Roadmap

See [TODO.md](TODO.md) for phase boundaries and progress.
