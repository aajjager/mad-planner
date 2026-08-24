from datetime import date, timedelta
from decimal import Decimal

from madplanner.ingredients import parse_ingredient
from madplanner.grocery_categories import categorize_grocery_item
from madplanner.repositories.planner import MealPlanRepository
from madplanner.repositories.grocery import GroceryListRepository
from madplanner.models import GroceryListEntry
from madplanner.schemas.grocery import GroceryListItem, WeeklyGroceryListResponse
from madplanner.schemas.recipe import UnitInput


class GroceryListService:
    def __init__(self, repository: MealPlanRepository, grocery_repository: GroceryListRepository) -> None:
        self.repository = repository
        self.grocery_repository = grocery_repository

    def get_week(self, requested_date: date) -> WeeklyGroceryListResponse:
        week_start = requested_date - timedelta(days=requested_date.weekday())
        week_end = week_start + timedelta(days=6)
        entries = self.repository.list_between(week_start, week_end)
        grouped: dict[str, GroceryListItem] = {}

        for entry in entries:
            if entry.is_leftover:
                continue
            recipe = entry.recipe
            factor = entry.servings / recipe.servings if entry.servings and recipe.servings else Decimal(1)
            for item in recipe.ingredients:
                legacy = parse_ingredient(item.raw_text) if item.ingredient is None else None
                ingredient_name = item.ingredient.name if item.ingredient else legacy.ingredient_name
                normalized_name = item.ingredient.normalized_name if item.ingredient else ingredient_name.casefold()
                source_unit = item.unit or (legacy.unit if legacy else None)
                source_quantity = item.quantity if item.quantity is not None else legacy.quantity if legacy else None
                source_quantity_max = item.quantity_max if item.quantity_max is not None else legacy.quantity_max if legacy else None
                unit_key = source_unit.name.casefold() if source_unit else "none"
                ingredient_key = " ".join(normalized_name.split())
                key = f"{ingredient_key}:{unit_key}"
                quantity = source_quantity * factor if source_quantity is not None else None
                quantity_max = source_quantity_max * factor if source_quantity_max is not None else None
                if key not in grouped:
                    grouped[key] = GroceryListItem(
                        key=key,
                        name=ingredient_name,
                        category=item.ingredient.grocery_category if item.ingredient and item.ingredient.grocery_category else categorize_grocery_item(ingredient_name),
                        quantity=quantity,
                        quantity_max=quantity_max,
                        unit=UnitInput(name=source_unit.name, symbol=source_unit.symbol, dimension=source_unit.dimension) if source_unit else None,
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
        cooked_meals = sum(not entry.is_leftover for entry in entries)
        self.grocery_repository.sync_generated(week_start, items)
        return WeeklyGroceryListResponse(week_start=week_start, week_end=week_end, planned_meals=cooked_meals, items=[self._response(item) for item in self.grocery_repository.list_current(week_start)], history=[self._response(item) for item in self.grocery_repository.list_history(week_start)])

    def add_manual(self, requested_date: date, raw_text: str) -> GroceryListItem:
        week_start = requested_date - timedelta(days=requested_date.weekday())
        parsed = parse_ingredient(raw_text)
        unit = UnitInput(name=parsed.unit.name, symbol=parsed.unit.symbol, dimension=parsed.unit.dimension) if parsed.unit else None
        entry = GroceryListEntry(week_start=week_start, origin="manual", name=parsed.ingredient_name, category=categorize_grocery_item(parsed.ingredient_name), quantity=parsed.quantity, quantity_max=parsed.quantity_max, unit=unit.model_dump(mode="json") if unit else None, raw_text=parsed.raw_text, recipe_names=[])
        return self._response(self.grocery_repository.add_manual(entry))

    def set_purchased(self, entry_id: int, purchased: bool) -> GroceryListItem | None:
        entry = self.grocery_repository.set_purchased(entry_id, purchased)
        return self._response(entry) if entry else None

    @staticmethod
    def _response(entry: GroceryListEntry) -> GroceryListItem:
        def clean_decimal(value: Decimal | None) -> Decimal | None:
            if value is None: return None
            text = format(value, "f")
            if "." in text: text = text.rstrip("0").rstrip(".")
            return Decimal(text)
        return GroceryListItem(id=entry.id, key=f"entry:{entry.id}", name=entry.name, category=entry.category, quantity=clean_decimal(entry.quantity), quantity_max=clean_decimal(entry.quantity_max), unit=UnitInput.model_validate(entry.unit) if entry.unit else None, recipe_names=entry.recipe_names, raw_texts=[entry.raw_text], origin=entry.origin, purchased_at=entry.purchased_at)
