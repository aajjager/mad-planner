import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

import psycopg
from psycopg import sql
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


def validate_database_backup(content: bytes, database_url: str) -> dict[str, str | int]:
    if not content or len(content) > 100 * 1024 * 1024:
        raise RuntimeError("Choose a database backup up to 100 MB")
    url = make_url(database_url)
    database_name = f"madplanner_verify_{uuid.uuid4().hex[:12]}"
    admin_url = url.set(database="postgres").render_as_string(hide_password=False).replace("postgresql+psycopg://", "postgresql://", 1)
    restore_url = url.set(database=database_name).render_as_string(hide_password=False).replace("postgresql+psycopg://", "postgresql://", 1)
    restore_environment = os.environ.copy()
    restore_environment.update({"PGHOST": url.host or "", "PGPORT": str(url.port or 5432), "PGUSER": url.username or "", "PGPASSWORD": url.password or "", "PGDATABASE": database_name})
    dump = Path(tempfile.mkstemp(prefix="mad-planner-upload-", suffix=".dump")[1])
    dump.write_bytes(content)
    try:
        with psycopg.connect(admin_url, autocommit=True) as connection:
            connection.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
        subprocess.run(["pg_restore", "--no-owner", "--no-privileges", f"--dbname={database_name}", str(dump)], env=restore_environment, check=True, capture_output=True, timeout=300)
        with psycopg.connect(restore_url) as connection:
            tables = connection.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'").fetchone()[0]
            recipes = connection.execute("SELECT count(*) FROM recipes").fetchone()[0]
            users = connection.execute("SELECT count(*) FROM users").fetchone()[0]
            migration = connection.execute("SELECT version_num FROM alembic_version").fetchone()[0]
        return {"tables": tables, "recipes": recipes, "users": users, "migration": migration}
    except (OSError, subprocess.SubprocessError, psycopg.Error) as error:
        raise RuntimeError("The uploaded file is not a usable Mad Planner database backup") from error
    finally:
        dump.unlink(missing_ok=True)
        try:
            with psycopg.connect(admin_url, autocommit=True) as connection:
                connection.execute("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %s", (database_name,))
                connection.execute(sql.SQL("DROP DATABASE IF EXISTS {}").format(sql.Identifier(database_name)))
        except psycopg.Error:
            pass
