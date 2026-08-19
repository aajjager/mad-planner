from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from madplanner.schemas.recipe import UnitInput


class GroceryListItem(BaseModel):
    key: str
    name: str
    category: str
    quantity: Decimal | None
    quantity_max: Decimal | None
    unit: UnitInput | None
    recipe_names: list[str]
    raw_texts: list[str]


class WeeklyGroceryListResponse(BaseModel):
    week_start: date
    week_end: date
    planned_meals: int
    items: list[GroceryListItem]
