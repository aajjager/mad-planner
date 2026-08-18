from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from madplanner.db.base import Base
from madplanner.models.ingredient import Ingredient, Unit


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(300), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(Text)
    author: Mapped[str | None] = mapped_column(String(200))
    servings: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    preparation_time_minutes: Mapped[int | None] = mapped_column(Integer)
    cooking_time_minutes: Mapped[int | None] = mapped_column(Integer)
    total_time_minutes: Mapped[int | None] = mapped_column(Integer)
    cuisine: Mapped[str | None] = mapped_column(String(100), index=True)
    category: Mapped[str | None] = mapped_column(String(100), index=True)
    nutrition: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="RecipeIngredient.position",
    )
    instructions: Mapped[list["RecipeInstruction"]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="RecipeInstruction.position",
    )


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"
    __table_args__ = (
        UniqueConstraint(
            "recipe_id",
            "position",
            name="uq_recipe_ingredients_recipe_position",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipe_id: Mapped[int] = mapped_column(
        ForeignKey("recipes.id", ondelete="CASCADE"), index=True
    )
    ingredient_id: Mapped[int | None] = mapped_column(
        ForeignKey("ingredients.id", ondelete="RESTRICT"), index=True
    )
    unit_id: Mapped[int | None] = mapped_column(
        ForeignKey("units.id", ondelete="RESTRICT")
    )
    position: Mapped[int] = mapped_column(Integer)
    raw_text: Mapped[str] = mapped_column(Text)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    quantity_max: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    preparation: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)

    recipe: Mapped[Recipe] = relationship(back_populates="ingredients")
    ingredient: Mapped[Ingredient | None] = relationship(
        back_populates="recipe_ingredients"
    )
    unit: Mapped[Unit | None] = relationship(back_populates="recipe_ingredients")


class RecipeInstruction(Base):
    __tablename__ = "recipe_instructions"
    __table_args__ = (
        UniqueConstraint(
            "recipe_id",
            "position",
            name="uq_recipe_instructions_recipe_position",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipe_id: Mapped[int] = mapped_column(
        ForeignKey("recipes.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)

    recipe: Mapped[Recipe] = relationship(back_populates="instructions")

