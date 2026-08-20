from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from madplanner.db.base import Base
from madplanner.models import Family, MealPlanEntry, MealType, Recipe
from madplanner.repositories.planner import MealPlanRepository
from madplanner.repositories.recipes import RecipeRepository


def test_repositories_isolate_family_recipes_and_meal_plans() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine, expire_on_commit=False) as session:
        first = Family(name="First family")
        second = Family(name="Second family")
        first_recipe = Recipe(name="First dinner", family_id=None)
        second_recipe = Recipe(name="Second dinner", family_id=None)
        session.add_all([first, second])
        session.flush()
        first_recipe.family_id = first.id
        second_recipe.family_id = second.id
        session.add_all([first_recipe, second_recipe])
        session.flush()
        session.add_all(
            [
                MealPlanEntry(family_id=first.id, meal_date=date(2026, 8, 20), meal_type=MealType.DINNER, recipe=first_recipe),
                MealPlanEntry(family_id=second.id, meal_date=date(2026, 8, 20), meal_type=MealType.DINNER, recipe=second_recipe),
            ]
        )
        session.commit()

        assert [item.name for item in RecipeRepository(session, first.id).list()] == ["First dinner"]
        assert [item.name for item in RecipeRepository(session, second.id).list()] == ["Second dinner"]
        assert MealPlanRepository(session, first.id).get(date(2026, 8, 20), MealType.DINNER).recipe.name == "First dinner"
        assert MealPlanRepository(session, second.id).get(date(2026, 8, 20), MealType.DINNER).recipe.name == "Second dinner"
