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


class MealSuggestionPreferences(BaseModel):
    meal_types: list[MealType] = Field(default_factory=lambda: [MealType.DINNER], min_length=1)
    preferred_tags: list[str] = Field(default_factory=list, max_length=10)
    max_cooking_time_minutes: int | None = Field(default=None, ge=5, le=1440)
    include_leftover_lunches: bool = True


class MealSuggestion(BaseModel):
    meal_date: date
    meal_type: MealType
    recipe: PlannedRecipe
    score: int
    reasons: list[str]
    is_leftover: bool = False
    source_date: date | None = None


class WeeklyMealSuggestionsResponse(BaseModel):
    week_start: date
    week_end: date
    suggestions: list[MealSuggestion]
