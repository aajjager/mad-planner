from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from madplanner.db.base import Base


class ImplementationJob(Base):
    __tablename__ = "implementation_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    feedback_id: Mapped[int | None] = mapped_column(ForeignKey("feedback_submissions.id", ondelete="SET NULL"), index=True)
    requested_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    category: Mapped[str] = mapped_column(String(20))
    request_text: Mapped[str] = mapped_column(Text)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(30), default="queued", index=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    claim_hash: Mapped[str | None] = mapped_column(String(64))
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
