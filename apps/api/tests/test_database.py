from sqlalchemy import create_engine

from madplanner.db import session


def test_database_connection_check_executes_query(monkeypatch) -> None:
    test_engine = create_engine("sqlite+pysqlite:///:memory:")
    monkeypatch.setattr(session, "engine", test_engine)

    assert session.check_database_connection() is True


def test_database_connection_check_handles_connection_failure(monkeypatch) -> None:
    class UnavailableEngine:
        def connect(self):
            raise OSError("database unavailable")

    monkeypatch.setattr(session, "engine", UnavailableEngine())

    assert session.check_database_connection() is False
