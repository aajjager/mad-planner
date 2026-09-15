from pydantic import BaseModel, Field


class RecipeImportRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)


class ImportedRecipePreview(BaseModel):
    name: str
    description: str | None = None
    image_url: str | None = None
    source_url: str
    author: str | None = None
    servings: str | None = None
    preparation_time_minutes: int | None = None
    cooking_time_minutes: int | None = None
    total_time_minutes: int | None = None
    cuisine: str | None = None
    category: str | None = None
    ingredients: list[str]
    instructions: list[str]
    nutrition: dict | None = None
    parser: str
    warnings: list[str] = Field(default_factory=list)
    suggested_recipe_types: list[str] = Field(default_factory=list)
    recipe_type_confidence: str = "low"


class CookBookRecipePreview(BaseModel):
    name: str
    description: str | None = None
    image_url: str | None = None
    servings: str | None = None
    preparation_time_minutes: int | None = None
    cooking_time_minutes: int | None = None
    total_time_minutes: int | None = None
    category: str | None = None
    tags: list[str] = Field(default_factory=list)
    ingredients: list[str]
    instructions: list[str]
    suggested_recipe_types: list[str] = Field(default_factory=list)
    duplicate: bool = False
    warnings: list[str] = Field(default_factory=list)


class CookBookArchivePreview(BaseModel):
    recipes: list[CookBookRecipePreview]
    warnings: list[str] = Field(default_factory=list)
