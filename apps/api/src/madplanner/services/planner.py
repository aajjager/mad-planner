from datetime import date, timedelta

from madplanner.models import MealPlanEntry, MealType
from madplanner.repositories.planner import MealPlanRepository
from madplanner.schemas.planner import IncompletePlanWeek, MealPlanEntryResponse, MealPlanEntryWrite, MealPlanExclusionResponse, PlanReminderResponse, PlannedRecipe, WeeklyMealPlanResponse


class MealPlanService:
    def __init__(self, repository: MealPlanRepository, household_size: int) -> None:
        self.repository = repository
        self.household_size = household_size

    def get_week(self, requested_date: date) -> WeeklyMealPlanResponse:
        week_start = requested_date - timedelta(days=requested_date.weekday())
        week_end = week_start + timedelta(days=6)
        return WeeklyMealPlanResponse(
            week_start=week_start,
            week_end=week_end,
            entries=[self._to_response(entry) for entry in self.repository.list_between(week_start, week_end)],
            exclusions=[MealPlanExclusionResponse(meal_date=item.meal_date, meal_type=item.meal_type) for item in self.repository.list_exclusions_between(week_start, week_end)],
        )

    def reminders(self, today: date, enabled: bool, weeks_ahead: int, meal_types: list[str]) -> PlanReminderResponse:
        if not enabled:
            return PlanReminderResponse(enabled=False, weeks=[])
        current_monday = today - timedelta(days=today.weekday())
        incomplete: list[IncompletePlanWeek] = []
        for offset in range(1, weeks_ahead + 1):
            week_start = current_monday + timedelta(days=7 * offset)
            week_end = week_start + timedelta(days=6)
            handled = {(entry.meal_date, entry.meal_type.value) for entry in self.repository.list_between(week_start, week_end)}
            handled.update((item.meal_date, item.meal_type.value) for item in self.repository.list_exclusions_between(week_start, week_end))
            required = {(week_start + timedelta(days=day), meal_type) for day in range(7) for meal_type in meal_types}
            missing = len(required - handled)
            if missing:
                incomplete.append(IncompletePlanWeek(week_start=week_start, missing_slots=missing))
        return PlanReminderResponse(enabled=True, weeks=incomplete)

    def assign(self, meal_date: date, meal_type: MealType, data: MealPlanEntryWrite) -> MealPlanEntryResponse | None:
        recipe = self.repository.get_recipe(data.recipe_id)
        if recipe is None:
            return None
        entry = self.repository.get(meal_date, meal_type) or MealPlanEntry(meal_date=meal_date, meal_type=meal_type)
        entry.recipe = recipe
        recipe_yield = recipe.servings or self.household_size
        entry.servings = data.servings or max(recipe_yield, self.household_size)
        entry.notes = data.notes
        entry.is_leftover = False
        entry.source_entry = None
        return self._to_response(self.repository.save(entry))

    def plan_leftovers(self, source_date: date, source_type: MealType) -> MealPlanEntryResponse | None:
        source = self.repository.get(source_date, source_type)
        if source is None:
            return None
        prepared_servings = source.servings or source.recipe.servings or self.household_size
        leftover_servings = prepared_servings - self.household_size
        if leftover_servings <= 0:
            return None
        target_date = source_date + timedelta(days=1)
        target = self.repository.get(target_date, MealType.LUNCH) or MealPlanEntry(meal_date=target_date, meal_type=MealType.LUNCH)
        target.recipe = source.recipe
        target.servings = leftover_servings
        target.notes = f"Leftovers from {source_date.isoformat()} {source_type.value}"
        target.is_leftover = True
        target.source_entry = source
        return self._to_response(self.repository.save(target))

    def remove(self, meal_date: date, meal_type: MealType) -> bool:
        entry = self.repository.get(meal_date, meal_type)
        if entry is None:
            return False
        self.repository.delete(entry)
        return True

    def exclude(self, meal_date: date, meal_type: MealType) -> MealPlanExclusionResponse:
        exclusion = self.repository.exclude(meal_date, meal_type)
        return MealPlanExclusionResponse(meal_date=exclusion.meal_date, meal_type=exclusion.meal_type)

    def include(self, meal_date: date, meal_type: MealType) -> bool:
        return self.repository.remove_exclusion(meal_date, meal_type)

    @staticmethod
    def _to_response(entry: MealPlanEntry) -> MealPlanEntryResponse:
        return MealPlanEntryResponse(
            id=entry.id,
            meal_date=entry.meal_date,
            meal_type=entry.meal_type,
            servings=entry.servings,
            notes=entry.notes,
            is_leftover=entry.is_leftover,
            source_entry_id=entry.source_entry_id,
            recipe=PlannedRecipe(id=entry.recipe.id, name=entry.recipe.name, image_url=entry.recipe.image_url),
        )
