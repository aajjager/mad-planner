from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from madplanner.models import MealPlanEntry, MealPlanExclusion, MealType, Recipe, RecipeIngredient


class MealPlanRepository:
    def __init__(self, session: Session, family_id: int) -> None:
        self.session = session
        self.family_id = family_id

    def list_between(self, start: date, end: date) -> list[MealPlanEntry]:
        statement = (
            select(MealPlanEntry)
            .where(MealPlanEntry.family_id == self.family_id, MealPlanEntry.meal_date.between(start, end))
            .options(
                selectinload(MealPlanEntry.recipe).selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient),
                selectinload(MealPlanEntry.recipe).selectinload(Recipe.ingredients).selectinload(RecipeIngredient.unit),
            )
            .order_by(MealPlanEntry.meal_date, MealPlanEntry.meal_type)
        )
        return list(self.session.scalars(statement).all())

    def get(self, meal_date: date, meal_type: MealType) -> MealPlanEntry | None:
        return self.session.scalar(
            select(MealPlanEntry)
            .where(MealPlanEntry.family_id == self.family_id, MealPlanEntry.meal_date == meal_date, MealPlanEntry.meal_type == meal_type)
            .options(selectinload(MealPlanEntry.recipe))
        )

    def list_exclusions_between(self, start: date, end: date) -> list[MealPlanExclusion]:
        return list(self.session.scalars(select(MealPlanExclusion).where(MealPlanExclusion.family_id == self.family_id, MealPlanExclusion.meal_date.between(start, end)).order_by(MealPlanExclusion.meal_date, MealPlanExclusion.meal_type)).all())

    def get_exclusion(self, meal_date: date, meal_type: MealType) -> MealPlanExclusion | None:
        return self.session.scalar(select(MealPlanExclusion).where(MealPlanExclusion.family_id == self.family_id, MealPlanExclusion.meal_date == meal_date, MealPlanExclusion.meal_type == meal_type))

    def get_recipe(self, recipe_id: int) -> Recipe | None:
        return self.session.scalar(select(Recipe).where(Recipe.id == recipe_id, Recipe.family_id == self.family_id))

    def save(self, entry: MealPlanEntry) -> MealPlanEntry:
        exclusion = self.get_exclusion(entry.meal_date, entry.meal_type)
        if exclusion is not None:
            self.session.delete(exclusion)
        entry.family_id = self.family_id
        self.session.add(entry)
        self.session.commit()
        stored = self.get(entry.meal_date, entry.meal_type)
        assert stored is not None
        return stored

    def delete(self, entry: MealPlanEntry) -> None:
        self.session.delete(entry)
        self.session.commit()

    def exclude(self, meal_date: date, meal_type: MealType) -> MealPlanExclusion:
        entry = self.get(meal_date, meal_type)
        if entry is not None:
            self.session.delete(entry)
        exclusion = self.get_exclusion(meal_date, meal_type) or MealPlanExclusion(family_id=self.family_id, meal_date=meal_date, meal_type=meal_type)
        self.session.add(exclusion)
        self.session.commit()
        self.session.refresh(exclusion)
        return exclusion

    def remove_exclusion(self, meal_date: date, meal_type: MealType) -> bool:
        exclusion = self.get_exclusion(meal_date, meal_type)
        if exclusion is None:
            return False
        self.session.delete(exclusion)
        self.session.commit()
        return True
