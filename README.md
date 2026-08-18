# Mad Planner

Mad Planner is a self-hosted meal-planning, recipe-management, and grocery-planning application.

The project is being built incrementally as a modular monolith:

- React and TypeScript frontend
- FastAPI backend
- PostgreSQL database
- Docker Compose deployment

## Current status

Phase 1 is in progress. The first checkpoint provides a minimal API and automated health-check test. It does not yet include the frontend, database connection, or Compose services.

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
{"status":"ok","service":"madplanner-api"}
```

Run the tests:

```powershell
pytest
```

## Roadmap

See [TODO.md](TODO.md) for phase boundaries and progress.

