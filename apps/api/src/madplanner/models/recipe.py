from datetime import datetime
from decimal import Decimal

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, Numeric, String, Table, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from madplanner.db.base import Base
from madplanner.models.ingredient import Ingredient, Unit


recipe_tags = Table(
    "recipe_tags", Base.metadata,
    Column("recipe_id", ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

recipe_recipe_types = Table(
    "recipe_recipe_types", Base.metadata,
    Column("recipe_id", ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
    Column("recipe_type_id", ForeignKey("recipe_types.id", ondelete="RESTRICT"), primary_key=True),
)


class RecipeType(Base):
    __tablename__ = "recipe_types"
    __table_args__ = (
        UniqueConstraint("family_id", "normalized_name", name="uq_recipe_types_family_normalized_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    normalized_name: Mapped[str] = mapped_column(String(60))
    meal_type: Mapped[str | None] = mapped_column(String(20))
    recipes: Mapped[list["Recipe"]] = relationship(
        secondary=recipe_recipe_types, back_populates="recipe_types"
    )


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    normalized_name: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    recipes: Mapped[list["Recipe"]] = relationship(secondary=recipe_tags, back_populates="tags")


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_id: Mapped[int | None] = mapped_column(
        ForeignKey("families.id", ondelete="CASCADE"), index=True
    )
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
    meal_types: Mapped[list[str]] = mapped_column(JSON, default=list, server_default="[]")
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
    tags: Mapped[list[Tag]] = relationship(
        secondary=recipe_tags, back_populates="recipes", order_by="Tag.name"
    )
    recipe_types: Mapped[list[RecipeType]] = relationship(
        secondary=recipe_recipe_types, back_populates="recipes", order_by="RecipeType.name"
    )
    ratings: Mapped[list["RecipeRating"]] = relationship(back_populates="recipe", cascade="all, delete-orphan")


class RecipeRating(Base):
    __tablename__ = "recipe_ratings"
    __table_args__ = (UniqueConstraint("recipe_id", "user_id", name="uq_recipe_ratings_recipe_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    recipe: Mapped[Recipe] = relationship(back_populates="ratings")


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
