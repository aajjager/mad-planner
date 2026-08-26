from datetime import date
from decimal import Decimal
from enum import Enum

from sqlalchemy import Boolean, Date, Enum as SqlEnum, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from madplanner.db.base import Base


class MealType(str, Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"


class MealPlanEntry(Base):
    __tablename__ = "meal_plan_entries"
    __table_args__ = (
        UniqueConstraint("family_id", "meal_date", "meal_type", name="uq_meal_plan_entries_family_date_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_id: Mapped[int | None] = mapped_column(
        ForeignKey("families.id", ondelete="CASCADE"), index=True
    )
    meal_date: Mapped[date] = mapped_column(Date, index=True)
    meal_type: Mapped[MealType] = mapped_column(
        SqlEnum(MealType, name="meal_type", native_enum=False, values_callable=lambda values: [value.value for value in values])
    )
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), index=True)
    servings: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    notes: Mapped[str | None] = mapped_column(String(300))
    is_leftover: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    source_entry_id: Mapped[int | None] = mapped_column(
        ForeignKey("meal_plan_entries.id", ondelete="SET NULL"), index=True
    )

    recipe: Mapped["Recipe"] = relationship()
    source_entry: Mapped["MealPlanEntry | None"] = relationship(
        remote_side="MealPlanEntry.id", foreign_keys=[source_entry_id]
    )


class MealPlanExclusion(Base):
    __tablename__ = "meal_plan_exclusions"
    __table_args__ = (
        UniqueConstraint("family_id", "meal_date", "meal_type", name="uq_meal_plan_exclusions_family_date_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    meal_date: Mapped[date] = mapped_column(Date, index=True)
    meal_type: Mapped[MealType] = mapped_column(
        SqlEnum(MealType, name="meal_type", native_enum=False, values_callable=lambda values: [value.value for value in values])
    )


from madplanner.models.recipe import Recipe  # noqa: E402
