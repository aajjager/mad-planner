from sqlalchemy import select

from madplanner.models import Family, Recipe, RecipeIngredient, RecipeInstruction
from madplanner.ingredients import parse_ingredient
from madplanner.repositories.recipes import RecipeRepository
from madplanner.services.nutrition import nutrition_for_recipe
from madplanner.schemas.recipe import (
    RecipeIngredientResponse,
    RecipeInstructionResponse,
    RecipeMealTypesUpdate,
    RecipeRatingUpdate,
    RecipeShareTarget,
    RecipeSharesUpdate,
    RecipeVisibilityUpdate,
    RecipeMetadataSuggestions,
    RecipeBulkUpdate,
    RecipeTagsUpdate,
    RecipeResponse,
    RecipeWrite,
    UnitInput,
)


class RecipeService:
    def __init__(self, repository: RecipeRepository, user_id: int) -> None:
        self.repository = repository
        self.user_id = user_id

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
        recipe = self.repository.get_owned(recipe_id)
        if recipe is None:
            return None
        self._apply(recipe, data)
        return self._to_response(self.repository.save(recipe))

    def delete_recipe(self, recipe_id: int) -> bool:
        recipe = self.repository.get_owned(recipe_id)
        if recipe is None:
            return False
        self.repository.delete(recipe)
        return True

    def update_meal_types(self, recipe_id: int, data: RecipeMealTypesUpdate) -> RecipeResponse | None:
        recipe = self.repository.get_owned(recipe_id)
        if recipe is None:
            return None
        recipe.meal_types = data.meal_types
        return self._to_response(self.repository.save(recipe))

    def update_tags(self, recipe_id: int, data: RecipeTagsUpdate) -> RecipeResponse | None:
        recipe = self.repository.get_owned(recipe_id)
        if recipe is None:
            return None
        recipe.tags.clear()
        recipe.tags.extend(self.repository.get_or_create_tag(tag) for tag in data.tags)
        return self._to_response(self.repository.save(recipe))

    def update_rating(self, recipe_id: int, data: RecipeRatingUpdate) -> RecipeResponse | None:
        recipe = self.repository.get(recipe_id)
        if recipe is None:
            return None
        self.repository.set_rating(recipe, self.user_id, data.rating)
        stored = self.repository.get(recipe_id)
        return self._to_response(stored) if stored else None

    def update_image(self, recipe_id: int, image_url: str) -> RecipeResponse | None:
        recipe = self.repository.get_owned(recipe_id)
        if recipe is None:
            return None
        recipe.image_url = image_url
        return self._to_response(self.repository.save(recipe))

    def list_share_targets(self) -> list[RecipeShareTarget]:
        return [RecipeShareTarget(id=family.id, name=family.name) for family in self.repository.list_share_targets()]

    def update_shares(self, recipe_id: int, data: RecipeSharesUpdate) -> RecipeResponse | None:
        recipe = self.repository.get_owned(recipe_id)
        if recipe is None:
            return None
        return self._to_response(self.repository.replace_shares(recipe, data.family_ids, self.user_id))

    def list_public_recipes(self) -> list[RecipeResponse]:
        return [self._to_response(recipe) for recipe in self.repository.list_public()]

    def update_visibility(self, recipe_id: int, data: RecipeVisibilityUpdate) -> RecipeResponse | None:
        recipe = self.repository.get_owned(recipe_id)
        if recipe is None:
            return None
        recipe.is_public = data.is_public
        return self._to_response(self.repository.save(recipe))

    def import_public_recipe(self, recipe_id: int) -> RecipeResponse | None:
        source = self.repository.get_public(recipe_id)
        if source is None:
            return None
        copy = Recipe(name=source.name, description=source.description, image_url=source.image_url, source_url=source.source_url,
                      author=source.author, servings=source.servings, preparation_time_minutes=source.preparation_time_minutes,
                      cooking_time_minutes=source.cooking_time_minutes, total_time_minutes=source.total_time_minutes,
                      cuisine=source.cuisine, category=source.category, nutrition=source.nutrition, meal_types=list(source.meal_types or []))
        copy.tags.extend(self.repository.get_or_create_tag(tag.name) for tag in source.tags)
        for position, item in enumerate(source.ingredients, 1):
            ingredient = self.repository.get_or_create_ingredient(item.ingredient.name) if item.ingredient else None
            unit = self.repository.get_or_create_unit(item.unit.name, item.unit.symbol, item.unit.dimension) if item.unit else None
            copy.ingredients.append(RecipeIngredient(position=position, raw_text=item.raw_text, quantity=item.quantity, quantity_max=item.quantity_max, preparation=item.preparation, notes=item.notes, ingredient=ingredient, unit=unit))
        copy.instructions.extend(RecipeInstruction(position=index, text=item.text) for index, item in enumerate(source.instructions, 1))
        return self._to_response(self.repository.add(copy))

    def suggest_metadata(self, recipe_id: int) -> RecipeMetadataSuggestions | None:
        recipe = self.repository.get_owned(recipe_id)
        if recipe is None:
            return None
        text = " ".join(filter(None, [recipe.name, recipe.description, recipe.category, recipe.cuisine, *(item.raw_text for item in recipe.ingredients)])).casefold()
        groups = {
            "Mexican": ("mexican", "mexicansk", "taco", "tortilla", "salsa"),
            "Italian": ("italian", "italiensk", "pasta", "lasagne", "pizza", "risotto"),
            "Asian": ("asian", "asiatisk", "soy", "soja", "wok", "curry", "karry"),
            "Fish": ("fish", "fisk", "salmon", "laks", "tuna", "tun"),
            "Vegetarian": ("vegetarian", "vegetar", "chickpea", "kikært", "tofu"),
            "Quick": ("quick", "hurtig", "fast"),
            "Rice": ("rice", "ris"), "Potato": ("potato", "kartoffel"), "Chicken": ("chicken", "kylling"),
        }
        tags = [label for label, keywords in groups.items() if any(keyword in text for keyword in keywords)]
        meal_types = []
        if any(word in text for word in ("breakfast", "morgenmad", "pancake", "pandekage", "oat", "havre")): meal_types.append("breakfast")
        if any(word in text for word in ("lunch", "frokost", "sandwich", "salad", "salat")): meal_types.append("lunch")
        if not meal_types or any(word in text for word in ("dinner", "aftensmad", "pasta", "curry", "karry", "stew", "gryde")): meal_types.append("dinner")
        cuisine = next((name for name in ("Mexican", "Italian", "Asian") if name in tags), recipe.cuisine)
        return RecipeMetadataSuggestions(tags=tags[:8], meal_types=list(dict.fromkeys(meal_types)), cuisine=cuisine)

    def bulk_update(self, data: RecipeBulkUpdate) -> list[RecipeResponse]:
        recipes = [self.repository.get_owned(recipe_id) for recipe_id in data.recipe_ids]
        if any(recipe is None for recipe in recipes):
            raise ValueError("One or more selected recipes cannot be changed")
        remove = {tag.casefold() for tag in data.remove_tags}
        for recipe in recipes:
            assert recipe is not None
            if data.is_public is not None:
                recipe.is_public = data.is_public
            if remove:
                recipe.tags[:] = [tag for tag in recipe.tags if tag.name.casefold() not in remove]
            existing = {tag.name.casefold() for tag in recipe.tags}
            for tag in data.add_tags:
                if tag.casefold() not in existing:
                    recipe.tags.append(self.repository.get_or_create_tag(tag)); existing.add(tag.casefold())
            if len(recipe.tags) > 20:
                raise ValueError("A recipe cannot have more than 20 tags")
        self.repository.session.commit()
        updated = [self.repository.get_owned(recipe_id) for recipe_id in data.recipe_ids]
        return [self._to_response(recipe) for recipe in updated if recipe is not None]

    def _apply(self, recipe: Recipe, data: RecipeWrite) -> None:
        if recipe.id is not None:
            self.repository.clear_contents(recipe)

        values = data.model_dump(exclude={"ingredients", "instructions", "tags", "recipe_types"})
        for url_field in ("image_url", "source_url"):
            if values[url_field] is not None:
                values[url_field] = str(values[url_field])
        for field, value in values.items():
            setattr(recipe, field, value)

        for position, item in enumerate(data.ingredients, start=1):
            parsed = parse_ingredient(item.raw_text) if item.ingredient_name is None else None
            ingredient_name = item.ingredient_name or (parsed.ingredient_name if parsed else None)
            quantity = item.quantity if item.quantity is not None else (parsed.quantity if parsed else None)
            quantity_max = item.quantity_max if item.quantity_max is not None else (parsed.quantity_max if parsed else None)
            parsed_unit = parsed.unit if parsed else None
            unit_input = item.unit
            ingredient = self.repository.get_or_create_ingredient(ingredient_name) if ingredient_name else None
            unit = (
                self.repository.get_or_create_unit(unit_input.name, unit_input.symbol, unit_input.dimension)
                if unit_input
                else self.repository.get_or_create_unit(parsed_unit.name, parsed_unit.symbol, parsed_unit.dimension)
                if parsed_unit
                else None
            )
            recipe.ingredients.append(RecipeIngredient(position=position, raw_text=item.raw_text, quantity=quantity, quantity_max=quantity_max, preparation=item.preparation, notes=item.notes, ingredient=ingredient, unit=unit))

        recipe.instructions.extend(
            [
            RecipeInstruction(position=position, text=item.text)
            for position, item in enumerate(data.instructions, start=1)
            ]
        )
        recipe.tags.extend(self.repository.get_or_create_tag(tag) for tag in data.tags)
        requested_types = data.recipe_types or [meal_type.title() for meal_type in data.meal_types]
        recipe_types = self.repository.get_recipe_types(requested_types)
        if len(recipe_types) != len({name.casefold() for name in requested_types}):
            raise ValueError("Unknown recipe type")
        recipe.recipe_types.extend(recipe_types)

    def _to_response(self, recipe: Recipe) -> RecipeResponse:
        ratings = [item.rating for item in recipe.ratings if item.family_id == self.repository.family_id]
        owner_name = self.repository.session.scalar(select(Family.name).where(Family.id == recipe.family_id))
        shared_family_ids = [share.recipient_family_id for share in recipe.shares]
        shared_family_names = list(self.repository.session.scalars(select(Family.name).where(Family.id.in_(shared_family_ids)).order_by(Family.name))) if shared_family_ids else []
        return RecipeResponse(
            id=recipe.id, name=recipe.name, description=recipe.description,
            image_url=recipe.image_url, source_url=recipe.source_url, author=recipe.author,
            servings=recipe.servings, preparation_time_minutes=recipe.preparation_time_minutes,
            cooking_time_minutes=recipe.cooking_time_minutes, total_time_minutes=recipe.total_time_minutes,
            cuisine=recipe.cuisine, category=recipe.category, nutrition=nutrition_for_recipe(recipe),
            tags=sorted((tag.name for tag in recipe.tags), key=str.casefold),
            meal_types=recipe.meal_types or [],
            recipe_types=[item.name for item in recipe.recipe_types],
            family_rating=round(sum(ratings) / len(ratings), 2) if ratings else None,
            rating_count=len(ratings),
            my_rating=next((item.rating for item in recipe.ratings if item.user_id == self.user_id and item.family_id == self.repository.family_id), None),
            owned_by_current_family=recipe.family_id == self.repository.family_id,
            owner_family_name=owner_name,
            shared_with_family_ids=shared_family_ids,
            shared_with_families=shared_family_names,
            is_public=recipe.is_public,
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
