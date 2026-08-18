from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from madplanner.models import Ingredient, Recipe, RecipeIngredient, Unit
from madplanner.models.ingredient import UnitDimension


class RecipeRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list(self) -> list[Recipe]:
        statement = select(Recipe).options(*self._load_options()).order_by(Recipe.name)
        return list(self.session.scalars(statement).all())

    def get(self, recipe_id: int) -> Recipe | None:
        statement = select(Recipe).where(Recipe.id == recipe_id).options(*self._load_options())
        return self.session.scalar(statement)

    def add(self, recipe: Recipe) -> Recipe:
        self.session.add(recipe)
        self.session.commit()
        stored = self.get(recipe.id)
        assert stored is not None
        return stored

    def save(self, recipe: Recipe) -> Recipe:
        self.session.add(recipe)
        self.session.commit()
        stored = self.get(recipe.id)
        assert stored is not None
        return stored

    def delete(self, recipe: Recipe) -> None:
        self.session.delete(recipe)
        self.session.commit()

    def clear_contents(self, recipe: Recipe) -> None:
        recipe.ingredients.clear()
        recipe.instructions.clear()
        self.session.flush()

    def get_or_create_ingredient(self, name: str) -> Ingredient:
        normalized_name = " ".join(name.casefold().split())
        ingredient = self.session.scalar(select(Ingredient).where(Ingredient.normalized_name == normalized_name))
        if ingredient is None:
            ingredient = Ingredient(name=name.strip(), normalized_name=normalized_name)
            self.session.add(ingredient)
        return ingredient

    def get_or_create_unit(self, name: str, symbol: str, dimension: UnitDimension) -> Unit:
        normalized_name = " ".join(name.casefold().split())
        unit = self.session.scalar(select(Unit).where(Unit.name == normalized_name))
        if unit is None:
            unit = Unit(name=normalized_name, symbol=symbol.strip(), dimension=dimension)
            self.session.add(unit)
        return unit

    @staticmethod
    def _load_options() -> tuple:
        return (
            selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient),
            selectinload(Recipe.ingredients).selectinload(RecipeIngredient.unit),
            selectinload(Recipe.instructions),
        )
