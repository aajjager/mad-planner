from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from madplanner.models import Ingredient, Recipe, RecipeIngredient, Tag, Unit
from madplanner.models.ingredient import UnitDimension


class RecipeRepository:
    def __init__(self, session: Session, family_id: int) -> None:
        self.session = session
        self.family_id = family_id

    def list(self) -> list[Recipe]:
        statement = select(Recipe).where(Recipe.family_id == self.family_id).options(*self._load_options()).order_by(Recipe.name)
        return list(self.session.scalars(statement).all())

    def get(self, recipe_id: int) -> Recipe | None:
        statement = select(Recipe).where(Recipe.id == recipe_id, Recipe.family_id == self.family_id).options(*self._load_options())
        return self.session.scalar(statement)

    def add(self, recipe: Recipe) -> Recipe:
        recipe.family_id = self.family_id
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
        recipe.tags.clear()
        self.session.flush()

    def get_or_create_ingredient(self, name: str) -> Ingredient:
        normalized_name = " ".join(name.casefold().split())
        with self.session.no_autoflush:
            ingredient = self.session.scalar(select(Ingredient).where(Ingredient.normalized_name == normalized_name))
        if ingredient is None:
            ingredient = Ingredient(name=name.strip(), normalized_name=normalized_name)
            self.session.add(ingredient)
        return ingredient

    def get_or_create_unit(self, name: str, symbol: str, dimension: UnitDimension) -> Unit:
        normalized_name = " ".join(name.casefold().split())
        with self.session.no_autoflush:
            unit = self.session.scalar(select(Unit).where(Unit.name == normalized_name))
        if unit is None:
            unit = Unit(name=normalized_name, symbol=symbol.strip(), dimension=dimension)
            self.session.add(unit)
        return unit

    def get_or_create_tag(self, name: str) -> Tag:
        cleaned_name = " ".join(name.strip().split())
        normalized_name = cleaned_name.casefold()
        with self.session.no_autoflush:
            tag = self.session.scalar(select(Tag).where(Tag.normalized_name == normalized_name))
        if tag is None:
            tag = Tag(name=cleaned_name, normalized_name=normalized_name)
            self.session.add(tag)
        return tag

    @staticmethod
    def _load_options() -> tuple:
        return (
            selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient),
            selectinload(Recipe.ingredients).selectinload(RecipeIngredient.unit),
            selectinload(Recipe.instructions),
            selectinload(Recipe.tags),
        )
