from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, HttpUrl, model_validator

from madplanner.models.ingredient import UnitDimension


class UnitInput(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    symbol: str = Field(min_length=1, max_length=20)
    dimension: UnitDimension


class RecipeIngredientInput(BaseModel):
    raw_text: str = Field(min_length=1)
    ingredient_name: str | None = Field(default=None, min_length=1, max_length=200)
    quantity: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=4)
    quantity_max: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=4)
    unit: UnitInput | None = None
    preparation: str | None = Field(default=None, max_length=200)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_quantity_range(self) -> "RecipeIngredientInput":
        if self.quantity is not None and self.quantity_max is not None and self.quantity_max < self.quantity:
            raise ValueError("quantity_max must be greater than or equal to quantity")
        return self


class RecipeInstructionInput(BaseModel):
    text: str = Field(min_length=1)


class RecipeWrite(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    description: str | None = None
    image_url: HttpUrl | None = None
    source_url: HttpUrl | None = None
    author: str | None = Field(default=None, max_length=200)
    servings: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    preparation_time_minutes: int | None = Field(default=None, ge=0)
    cooking_time_minutes: int | None = Field(default=None, ge=0)
    total_time_minutes: int | None = Field(default=None, ge=0)
    cuisine: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=100)
    nutrition: dict | None = None
    ingredients: list[RecipeIngredientInput] = Field(default_factory=list)
    instructions: list[RecipeInstructionInput] = Field(default_factory=list)


class RecipeIngredientResponse(BaseModel):
    id: int
    position: int
    raw_text: str
    ingredient_name: str | None
    quantity: Decimal | None
    quantity_max: Decimal | None
    unit: UnitInput | None
    preparation: str | None
    notes: str | None


class RecipeInstructionResponse(BaseModel):
    id: int
    position: int
    text: str


class RecipeResponse(BaseModel):
    id: int
    name: str
    description: str | None
    image_url: str | None
    source_url: str | None
    author: str | None
    servings: Decimal | None
    preparation_time_minutes: int | None
    cooking_time_minutes: int | None
    total_time_minutes: int | None
    cuisine: str | None
    category: str | None
    nutrition: dict | None
    ingredients: list[RecipeIngredientResponse]
    instructions: list[RecipeInstructionResponse]
    created_at: datetime
    updated_at: datetime
