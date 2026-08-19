from datetime import date
from decimal import Decimal
from enum import Enum

from sqlalchemy import Date, Enum as SqlEnum, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from madplanner.db.base import Base


class MealType(str, Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"


class MealPlanEntry(Base):
    __tablename__ = "meal_plan_entries"
    __table_args__ = (
        UniqueConstraint("meal_date", "meal_type", name="uq_meal_plan_entries_date_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meal_date: Mapped[date] = mapped_column(Date, index=True)
    meal_type: Mapped[MealType] = mapped_column(
        SqlEnum(MealType, name="meal_type", native_enum=False, values_callable=lambda values: [value.value for value in values])
    )
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), index=True)
    servings: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    notes: Mapped[str | None] = mapped_column(String(300))

    recipe: Mapped["Recipe"] = relationship()


from madplanner.models.recipe import Recipe  # noqa: E402
