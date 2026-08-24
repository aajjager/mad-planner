from datetime import date
from decimal import Decimal

from datetime import datetime
from pydantic import BaseModel, Field

from madplanner.schemas.recipe import UnitInput


class GroceryListItem(BaseModel):
    id: int | None = None
    key: str
    name: str
    category: str
    quantity: Decimal | None
    quantity_max: Decimal | None
    unit: UnitInput | None
    recipe_names: list[str]
    raw_texts: list[str]
    origin: str = "generated"
    purchased_at: datetime | None = None


class ManualGroceryItemCreate(BaseModel):
    raw_text: str = Field(min_length=1, max_length=500)


class GroceryPurchasedUpdate(BaseModel):
    purchased: bool


class WeeklyGroceryListResponse(BaseModel):
    week_start: date
    week_end: date
    planned_meals: int
    items: list[GroceryListItem]
    history: list[GroceryListItem] = Field(default_factory=list)
