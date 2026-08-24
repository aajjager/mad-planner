from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from madplanner.db.base import Base


class GroceryListEntry(Base):
    __tablename__ = "grocery_list_entries"
    __table_args__ = (UniqueConstraint("family_id", "week_start", "source_key", name="uq_grocery_entries_family_week_source"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    week_start: Mapped[date] = mapped_column(Date, index=True)
    source_key: Mapped[str | None] = mapped_column(String(300))
    origin: Mapped[str] = mapped_column(String(20), default="manual")
    name: Mapped[str] = mapped_column(String(300))
    category: Mapped[str] = mapped_column(String(100), default="Other")
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    quantity_max: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    unit: Mapped[dict | None] = mapped_column(JSON)
    raw_text: Mapped[str] = mapped_column(String(500))
    recipe_names: Mapped[list[str]] = mapped_column(JSON, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    purchased_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

