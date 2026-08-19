from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from madplanner.models.planner import MealType


class MealPlanEntryWrite(BaseModel):
    recipe_id: int = Field(gt=0)
    servings: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    notes: str | None = Field(default=None, max_length=300)


class PlannedRecipe(BaseModel):
    id: int
    name: str
    image_url: str | None


class MealPlanEntryResponse(BaseModel):
    id: int
    meal_date: date
    meal_type: MealType
    servings: Decimal | None
    notes: str | None
    is_leftover: bool
    source_entry_id: int | None
    recipe: PlannedRecipe


class WeeklyMealPlanResponse(BaseModel):
    week_start: date
    week_end: date
    entries: list[MealPlanEntryResponse]
