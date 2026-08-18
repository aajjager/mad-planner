from sqlalchemy import Engine, create_engine, text

from madplanner.core.config import get_settings


def create_database_engine(database_url: str | None = None) -> Engine:
    url = database_url or get_settings().database_url.get_secret_value()
    return create_engine(url, pool_pre_ping=True)


engine = create_database_engine()


def check_database_connection() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        return False

    return True

