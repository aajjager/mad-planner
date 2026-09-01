from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from madplanner.models import Ingredient, Recipe, RecipeIngredient, RecipeRating, RecipeType, Tag, Unit
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

    def set_rating(self, recipe: Recipe, user_id: int, rating: int | None) -> None:
        existing = self.session.scalar(select(RecipeRating).where(RecipeRating.recipe_id == recipe.id, RecipeRating.user_id == user_id))
        if rating is None:
            if existing is not None:
                self.session.delete(existing)
        elif existing is None:
            self.session.add(RecipeRating(recipe_id=recipe.id, user_id=user_id, rating=rating))
        else:
            existing.rating = rating
        self.session.commit()
        self.session.expire(recipe, ["ratings"])

    def clear_contents(self, recipe: Recipe) -> None:
        recipe.ingredients.clear()
        recipe.instructions.clear()
        recipe.tags.clear()
        recipe.recipe_types.clear()
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
        pending = next((item for item in self.session.new if isinstance(item, Unit) and item.name == normalized_name), None)
        if pending is not None:
            return pending
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

    def get_recipe_types(self, names: list[str]) -> list[RecipeType]:
        normalized = {" ".join(name.casefold().split()) for name in names if name.strip()}
        if not normalized:
            return []
        return list(
            self.session.scalars(
                select(RecipeType).where(
                    RecipeType.family_id == self.family_id,
                    RecipeType.normalized_name.in_(normalized),
                )
            )
        )

    @staticmethod
    def _load_options() -> tuple:
        return (
            selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient),
            selectinload(Recipe.ingredients).selectinload(RecipeIngredient.unit),
            selectinload(Recipe.instructions),
            selectinload(Recipe.tags),
            selectinload(Recipe.recipe_types),
            selectinload(Recipe.ratings),
        )
