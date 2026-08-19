from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from madplanner.models import MealPlanEntry, MealType, Recipe


class MealPlanRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_between(self, start: date, end: date) -> list[MealPlanEntry]:
        statement = (
            select(MealPlanEntry)
            .where(MealPlanEntry.meal_date.between(start, end))
            .options(selectinload(MealPlanEntry.recipe))
            .order_by(MealPlanEntry.meal_date, MealPlanEntry.meal_type)
        )
        return list(self.session.scalars(statement).all())

    def get(self, meal_date: date, meal_type: MealType) -> MealPlanEntry | None:
        return self.session.scalar(
            select(MealPlanEntry)
            .where(MealPlanEntry.meal_date == meal_date, MealPlanEntry.meal_type == meal_type)
            .options(selectinload(MealPlanEntry.recipe))
        )

    def get_recipe(self, recipe_id: int) -> Recipe | None:
        return self.session.get(Recipe, recipe_id)

    def save(self, entry: MealPlanEntry) -> MealPlanEntry:
        self.session.add(entry)
        self.session.commit()
        stored = self.get(entry.meal_date, entry.meal_type)
        assert stored is not None
        return stored

    def delete(self, entry: MealPlanEntry) -> None:
        self.session.delete(entry)
        self.session.commit()
