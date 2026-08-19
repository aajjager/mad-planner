from datetime import date, timedelta
from decimal import Decimal

from madplanner.repositories.planner import MealPlanRepository
from madplanner.schemas.grocery import GroceryListItem, WeeklyGroceryListResponse
from madplanner.schemas.recipe import UnitInput


class GroceryListService:
    def __init__(self, repository: MealPlanRepository) -> None:
        self.repository = repository

    def get_week(self, requested_date: date) -> WeeklyGroceryListResponse:
        week_start = requested_date - timedelta(days=requested_date.weekday())
        week_end = week_start + timedelta(days=6)
        entries = self.repository.list_between(week_start, week_end)
        grouped: dict[str, GroceryListItem] = {}

        for entry in entries:
            recipe = entry.recipe
            factor = entry.servings / recipe.servings if entry.servings and recipe.servings else Decimal(1)
            for item in recipe.ingredients:
                ingredient_name = item.ingredient.name if item.ingredient else item.raw_text
                ingredient_key = str(item.ingredient_id) if item.ingredient_id else f"raw:{item.raw_text.casefold()}"
                unit_key = str(item.unit_id) if item.unit_id else "none"
                key = f"{ingredient_key}:{unit_key}"
                quantity = item.quantity * factor if item.quantity is not None else None
                quantity_max = item.quantity_max * factor if item.quantity_max is not None else None
                if key not in grouped:
                    grouped[key] = GroceryListItem(
                        key=key,
                        name=ingredient_name,
                        category=item.ingredient.grocery_category if item.ingredient and item.ingredient.grocery_category else "Other",
                        quantity=quantity,
                        quantity_max=quantity_max,
                        unit=UnitInput(name=item.unit.name, symbol=item.unit.symbol, dimension=item.unit.dimension) if item.unit else None,
                        recipe_names=[recipe.name],
                        raw_texts=[item.raw_text],
                    )
                    continue
                stored = grouped[key]
                stored.quantity = stored.quantity + quantity if stored.quantity is not None and quantity is not None else None
                stored.quantity_max = stored.quantity_max + quantity_max if stored.quantity_max is not None and quantity_max is not None else stored.quantity_max or quantity_max
                if recipe.name not in stored.recipe_names:
                    stored.recipe_names.append(recipe.name)
                if item.raw_text not in stored.raw_texts:
                    stored.raw_texts.append(item.raw_text)

        items = sorted(grouped.values(), key=lambda item: (item.category.casefold(), item.name.casefold()))
        return WeeklyGroceryListResponse(week_start=week_start, week_end=week_end, planned_meals=len(entries), items=items)
