from madplanner.models import Recipe, RecipeIngredient, RecipeInstruction
from madplanner.repositories.recipes import RecipeRepository
from madplanner.schemas.recipe import (
    RecipeIngredientResponse,
    RecipeInstructionResponse,
    RecipeResponse,
    RecipeWrite,
    UnitInput,
)


class RecipeService:
    def __init__(self, repository: RecipeRepository) -> None:
        self.repository = repository

    def list_recipes(self) -> list[RecipeResponse]:
        return [self._to_response(recipe) for recipe in self.repository.list()]

    def get_recipe(self, recipe_id: int) -> RecipeResponse | None:
        recipe = self.repository.get(recipe_id)
        return self._to_response(recipe) if recipe else None

    def create_recipe(self, data: RecipeWrite) -> RecipeResponse:
        recipe = Recipe()
        self._apply(recipe, data)
        return self._to_response(self.repository.add(recipe))

    def replace_recipe(self, recipe_id: int, data: RecipeWrite) -> RecipeResponse | None:
        recipe = self.repository.get(recipe_id)
        if recipe is None:
            return None
        self._apply(recipe, data)
        return self._to_response(self.repository.save(recipe))

    def delete_recipe(self, recipe_id: int) -> bool:
        recipe = self.repository.get(recipe_id)
        if recipe is None:
            return False
        self.repository.delete(recipe)
        return True

    def _apply(self, recipe: Recipe, data: RecipeWrite) -> None:
        if recipe.id is not None:
            self.repository.clear_contents(recipe)

        values = data.model_dump(exclude={"ingredients", "instructions"})
        for url_field in ("image_url", "source_url"):
            if values[url_field] is not None:
                values[url_field] = str(values[url_field])
        for field, value in values.items():
            setattr(recipe, field, value)

        for position, item in enumerate(data.ingredients, start=1):
            ingredient = self.repository.get_or_create_ingredient(item.ingredient_name) if item.ingredient_name else None
            unit = self.repository.get_or_create_unit(item.unit.name, item.unit.symbol, item.unit.dimension) if item.unit else None
            recipe.ingredients.append(RecipeIngredient(position=position, raw_text=item.raw_text, quantity=item.quantity, quantity_max=item.quantity_max, preparation=item.preparation, notes=item.notes, ingredient=ingredient, unit=unit))

        recipe.instructions.extend(
            [
            RecipeInstruction(position=position, text=item.text)
            for position, item in enumerate(data.instructions, start=1)
            ]
        )

    @staticmethod
    def _to_response(recipe: Recipe) -> RecipeResponse:
        return RecipeResponse(
            id=recipe.id, name=recipe.name, description=recipe.description,
            image_url=recipe.image_url, source_url=recipe.source_url, author=recipe.author,
            servings=recipe.servings, preparation_time_minutes=recipe.preparation_time_minutes,
            cooking_time_minutes=recipe.cooking_time_minutes, total_time_minutes=recipe.total_time_minutes,
            cuisine=recipe.cuisine, category=recipe.category, nutrition=recipe.nutrition,
            ingredients=[RecipeIngredientResponse(
                id=item.id, position=item.position, raw_text=item.raw_text,
                ingredient_name=item.ingredient.name if item.ingredient else None,
                quantity=item.quantity, quantity_max=item.quantity_max,
                unit=UnitInput(name=item.unit.name, symbol=item.unit.symbol, dimension=item.unit.dimension) if item.unit else None,
                preparation=item.preparation, notes=item.notes,
            ) for item in recipe.ingredients],
            instructions=[
                RecipeInstructionResponse(
                    id=item.id,
                    position=item.position,
                    text=item.text,
                )
                for item in recipe.instructions
            ],
            created_at=recipe.created_at,
            updated_at=recipe.updated_at,
        )
