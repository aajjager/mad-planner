import os
import subprocess
import tempfile
from pathlib import Path

from sqlalchemy.engine import make_url


def create_database_backup(database_url: str) -> Path:
    url = make_url(database_url)
    if url.get_backend_name() != "postgresql":
        raise RuntimeError("Database backups require PostgreSQL")
    target = Path(tempfile.mkstemp(prefix="mad-planner-", suffix=".dump")[1])
    environment = os.environ.copy()
    environment.update({"PGHOST": url.host or "", "PGPORT": str(url.port or 5432), "PGUSER": url.username or "", "PGPASSWORD": url.password or "", "PGDATABASE": url.database or ""})
    try:
        subprocess.run(["pg_dump", "--format=custom", "--no-owner", "--no-privileges", f"--file={target}"], env=environment, check=True, capture_output=True, timeout=300)
    except (OSError, subprocess.SubprocessError) as error:
        target.unlink(missing_ok=True)
        raise RuntimeError("The database backup could not be created") from error
    return target
