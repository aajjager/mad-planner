# Mad Planner

Mad Planner is a self-hosted meal-planning, recipe-management, and grocery-planning application.

The project is being built incrementally as a modular monolith:

- React and TypeScript frontend
- FastAPI backend
- PostgreSQL database
- Docker Compose deployment

## Current status

Phase 1 is in progress. The API provides separate liveness and database-readiness health checks. The frontend and Compose services are not yet included.

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

## Roadmap

See [TODO.md](TODO.md) for phase boundaries and progress.
