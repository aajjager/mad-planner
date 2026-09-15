import os
import shutil
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


def create_media_backup(media_root: Path) -> Path:
    media_root.mkdir(parents=True, exist_ok=True)
    temporary_directory = Path(tempfile.mkdtemp(prefix="mad-planner-media-"))
    archive_base = temporary_directory / "mad-planner-media"
    try:
        return Path(shutil.make_archive(str(archive_base), "zip", root_dir=media_root))
    except (OSError, shutil.Error) as error:
        shutil.rmtree(temporary_directory, ignore_errors=True)
        raise RuntimeError("The recipe photo backup could not be created") from error


def remove_media_backup(archive: Path) -> None:
    shutil.rmtree(archive.parent, ignore_errors=True)
