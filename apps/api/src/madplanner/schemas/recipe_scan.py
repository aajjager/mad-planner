from pydantic import BaseModel, Field


class RecipeScanPreview(BaseModel):
    confidence: float = Field(default=0.7, ge=0, le=1)
    name: str
    description: str | None = None
    ingredients: list[str] = Field(default_factory=list)
    instructions: list[str] = Field(default_factory=list)
    raw_text: str
    warnings: list[str] = Field(default_factory=list)
