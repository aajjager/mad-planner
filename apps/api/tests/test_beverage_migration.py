import runpy
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text
from madplanner.db.base import Base
import madplanner.models  # Register the complete existing schema.


def test_backfill_preserves_custom_types_and_is_repeatable():
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    migration = runpy.run_path(str(Path(__file__).parents[1] / 'migrations/versions/20261123_35_add_beverages_recipe_type.py'))
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO families (id, name) VALUES (1, 'First'), (2, 'Second')"))
        connection.execute(text("INSERT INTO recipe_types (family_id, name, normalized_name, meal_type) VALUES (2, 'BEVERAGES', 'beverages', 'lunch'), (1, 'Custom tea', 'custom tea', NULL)"))
        with Operations.context(MigrationContext.configure(connection)):
            migration['upgrade']()
            migration['upgrade']()
            migration['downgrade']()
        rows = connection.execute(text('SELECT family_id, name, meal_type FROM recipe_types ORDER BY family_id, name')).all()
        assert [tuple(row) for row in rows] == [(1, 'Beverages', None), (1, 'Custom tea', None), (2, 'BEVERAGES', 'lunch')]
