from collections import Counter
from datetime import date, timedelta

from madplanner.models import MealType, Recipe
from madplanner.repositories.planner import MealPlanRepository
from madplanner.repositories.recipes import RecipeRepository
from madplanner.schemas.planner import MealSuggestion, MealSuggestionPreferences, PlannedRecipe, WeeklyMealSuggestionsResponse

_MEAL_WORDS = {
    MealType.BREAKFAST: {"breakfast", "morgenmad", "brunch"},
    MealType.LUNCH: {"lunch", "frokost"},
    MealType.DINNER: {"dinner", "aftensmad", "hovedret", "hovedretter"},
}


class MealSuggestionService:
    def __init__(self, planner: MealPlanRepository, recipes: RecipeRepository) -> None:
        self.planner = planner
        self.recipes = recipes

    def suggest_week(self, requested_date: date, preferences: MealSuggestionPreferences) -> WeeklyMealSuggestionsResponse:
        week_start = requested_date - timedelta(days=requested_date.weekday())
        week_end = week_start + timedelta(days=6)
        existing = {(entry.meal_date, entry.meal_type) for entry in self.planner.list_between(week_start, week_end)}
        recipes = self.recipes.list()
        if preferences.max_cooking_time_minutes is not None:
            within_limit = [recipe for recipe in recipes if recipe.total_time_minutes is not None and recipe.total_time_minutes <= preferences.max_cooking_time_minutes]
            if within_limit:
                recipes = within_limit

        suggestions: list[MealSuggestion] = []
        usage: Counter[int] = Counter()
        selected_ingredients: set[str] = set()
        preferred = {tag.casefold() for tag in preferences.preferred_tags}
        dinner_by_date: dict[date, MealSuggestion] = {}
        for offset in range(7):
            meal_date = week_start + timedelta(days=offset)
            for meal_type in preferences.meal_types:
                if (meal_date, meal_type) in existing or not recipes:
                    continue
                ranked = [self._rank(recipe, meal_type, preferred, usage[recipe.id], selected_ingredients) for recipe in recipes]
                score, _, recipe, reasons = max(ranked, key=lambda value: (value[0], value[1]))
                suggestion = MealSuggestion(meal_date=meal_date, meal_type=meal_type, recipe=PlannedRecipe(id=recipe.id, name=recipe.name, image_url=recipe.image_url), score=score, reasons=reasons)
                suggestions.append(suggestion)
                usage[recipe.id] += 1
                selected_ingredients.update(self._ingredients(recipe))
                if meal_type is MealType.DINNER:
                    dinner_by_date[meal_date] = suggestion

        if preferences.include_leftover_lunches:
            for source_date, dinner in dinner_by_date.items():
                target_date = source_date + timedelta(days=1)
                if target_date > week_end or (target_date, MealType.LUNCH) in existing:
                    continue
                suggestions.append(MealSuggestion(meal_date=target_date, meal_type=MealType.LUNCH, recipe=dinner.recipe, score=dinner.score, reasons=["Uses the previous dinner and avoids food waste"], is_leftover=True, source_date=source_date))

        suggestions.sort(key=lambda item: (item.meal_date, item.meal_type.value))
        return WeeklyMealSuggestionsResponse(week_start=week_start, week_end=week_end, suggestions=suggestions)

    def _rank(self, recipe: Recipe, meal_type: MealType, preferred: set[str], repeats: int, selected: set[str]):
        labels = {tag.name.casefold() for tag in recipe.tags}
        labels.update(part.strip().casefold() for part in (recipe.category or "").split(",") if part.strip())
        reasons: list[str] = []
        score = 100 - repeats * 60
        if labels & _MEAL_WORDS[meal_type]:
            score += 30
            reasons.append(f"Matches {meal_type.value}")
        matching_tags = labels & preferred
        if matching_tags:
            score += 15 * len(matching_tags)
            reasons.append(f"Matches {', '.join(sorted(matching_tags))}")
        overlap = self._ingredients(recipe) & selected
        if overlap:
            score += min(len(overlap), 5) * 2
            reasons.append("Reuses ingredients already on the list")
        if repeats == 0:
            reasons.append("Adds variety")
        return score, recipe.name.casefold(), recipe, reasons

    @staticmethod
    def _ingredients(recipe: Recipe) -> set[str]:
        return {item.ingredient.normalized_name if item.ingredient else item.raw_text.casefold() for item in recipe.ingredients}
