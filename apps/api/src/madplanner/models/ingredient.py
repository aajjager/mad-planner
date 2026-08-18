from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SqlEnum
from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from madplanner.db.base import Base

if TYPE_CHECKING:
    from madplanner.models.recipe import RecipeIngredient


class UnitDimension(str, Enum):
    MASS = "mass"
    VOLUME = "volume"
    COUNT = "count"


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    symbol: Mapped[str] = mapped_column(String(20))
    dimension: Mapped[UnitDimension] = mapped_column(
        SqlEnum(
            UnitDimension,
            name="unit_dimension",
            native_enum=False,
            values_callable=lambda values: [value.value for value in values],
        )
    )

    recipe_ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        back_populates="unit"
    )


class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    normalized_name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    grocery_category: Mapped[str | None] = mapped_column(String(100))

    aliases: Mapped[list["IngredientAlias"]] = relationship(
        back_populates="ingredient",
        cascade="all, delete-orphan",
    )
    recipe_ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        back_populates="ingredient"
    )


class IngredientAlias(Base):
    __tablename__ = "ingredient_aliases"
    __table_args__ = (
        UniqueConstraint("normalized_alias", name="uq_ingredient_aliases_normalized_alias"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ingredient_id: Mapped[int] = mapped_column(
        ForeignKey("ingredients.id", ondelete="CASCADE"), index=True
    )
    alias: Mapped[str] = mapped_column(String(200))
    normalized_alias: Mapped[str] = mapped_column(String(200))

    ingredient: Mapped[Ingredient] = relationship(back_populates="aliases")

