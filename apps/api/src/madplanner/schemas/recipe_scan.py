from pydantic import BaseModel, Field


class RecipeScanPreview(BaseModel):
    name: str
    ingredients: list[str] = Field(default_factory=list)
    instructions: list[str] = Field(default_factory=list)
    raw_text: str
    warnings: list[str] = Field(default_factory=list)
