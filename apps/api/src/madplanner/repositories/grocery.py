from datetime import date, datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from madplanner.models import GroceryListEntry
from madplanner.schemas.grocery import GroceryListItem


class GroceryListRepository:
    def __init__(self, session: Session, family_id: int) -> None:
        self.session = session
        self.family_id = family_id

    def sync_generated(self, week_start: date, items: list[GroceryListItem]) -> None:
        self.session.execute(update(GroceryListEntry).where(GroceryListEntry.family_id == self.family_id, GroceryListEntry.week_start == week_start, GroceryListEntry.origin == "generated").values(active=False))
        existing = {item.source_key: item for item in self.session.scalars(select(GroceryListEntry).where(GroceryListEntry.family_id == self.family_id, GroceryListEntry.week_start == week_start, GroceryListEntry.origin == "generated"))}
        for item in items:
            entry = existing.get(item.key)
            if entry is None:
                entry = GroceryListEntry(family_id=self.family_id, week_start=week_start, source_key=item.key, origin="generated", name=item.name, raw_text=item.raw_texts[0] if item.raw_texts else item.name)
                self.session.add(entry)
            entry.name = item.name; entry.category = item.category; entry.quantity = item.quantity; entry.quantity_max = item.quantity_max
            entry.unit = item.unit.model_dump(mode="json") if item.unit else None; entry.recipe_names = item.recipe_names; entry.active = True
        self.session.commit()

    def list_current(self, week_start: date) -> list[GroceryListEntry]:
        return list(self.session.scalars(select(GroceryListEntry).where(GroceryListEntry.family_id == self.family_id, GroceryListEntry.week_start == week_start, GroceryListEntry.active.is_(True), GroceryListEntry.purchased_at.is_(None)).order_by(GroceryListEntry.category, GroceryListEntry.name)))

    def list_history(self, week_start: date) -> list[GroceryListEntry]:
        return list(self.session.scalars(select(GroceryListEntry).where(GroceryListEntry.family_id == self.family_id, GroceryListEntry.week_start == week_start, GroceryListEntry.purchased_at.is_not(None)).order_by(GroceryListEntry.purchased_at.desc())))

    def add_manual(self, entry: GroceryListEntry) -> GroceryListEntry:
        entry.family_id = self.family_id; self.session.add(entry); self.session.commit(); self.session.refresh(entry); return entry

    def set_purchased(self, entry_id: int, purchased: bool) -> GroceryListEntry | None:
        entry = self.session.scalar(select(GroceryListEntry).where(GroceryListEntry.id == entry_id, GroceryListEntry.family_id == self.family_id))
        if entry is None: return None
        entry.purchased_at = datetime.now(timezone.utc) if purchased else None
        self.session.commit(); self.session.refresh(entry); return entry
