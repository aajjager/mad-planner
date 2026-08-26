from dataclasses import dataclass
from decimal import Decimal

from madplanner.models import Recipe
from madplanner.models.ingredient import UnitDimension


@dataclass(frozen=True)
class Nutrients:
    calories: float
    fat: float
    carbohydrates: float
    protein: float
    count_grams: float = 100


# Approximate values per 100 g for generic foods rather than branded products.
_FOODS: tuple[tuple[tuple[str, ...], Nutrients], ...] = (
    (("olive oil", "olivenolie", "olijfolie", "oil", "olie"), Nutrients(884, 100, 0, 0, 14)),
    (("butter", "smør", "boter"), Nutrients(717, 81.1, 0.1, 0.9, 14)),
    (("cream", "fløde", "room"), Nutrients(340, 36, 2.8, 2.1)),
    (("cheese", "ost", "kaas", "parmesan"), Nutrients(402, 33, 1.3, 25, 25)),
    (("milk", "mælk", "melk"), Nutrients(61, 3.3, 4.8, 3.2)),
    (("egg", "æg", "ei"), Nutrients(143, 9.5, 0.7, 12.6, 55)),
    (("chicken", "kylling", "kip"), Nutrients(165, 3.6, 0, 31, 150)),
    (("beef", "oksekød", "rundvlees"), Nutrients(250, 15, 0, 26, 150)),
    (("pork", "svinekød", "varkensvlees"), Nutrients(242, 14, 0, 27, 150)),
    (("ham", "skinke"), Nutrients(145, 5.5, 1.5, 21, 25)),
    (("salmon", "laks", "zalm"), Nutrients(208, 13, 0, 20, 125)),
    (("tuna", "tun", "tonijn"), Nutrients(132, 1.3, 0, 29, 120)),
    (("pasta", "spaghetti", "macaroni"), Nutrients(371, 1.5, 75, 13)),
    (("rice", "ris", "rijst"), Nutrients(365, 0.7, 80, 7.1)),
    (("quinoa",), Nutrients(368, 6.1, 64, 14.1)),
    (("flour", "mel", "bloem"), Nutrients(364, 1, 76, 10)),
    (("bread", "brød", "brood"), Nutrients(265, 3.2, 49, 9, 35)),
    (("potato", "kartoffel", "aardappel"), Nutrients(77, 0.1, 17, 2, 150)),
    (("tomato", "tomat", "tomaat"), Nutrients(18, 0.2, 3.9, 0.9, 100)),
    (("onion", "løg", "ui"), Nutrients(40, 0.1, 9.3, 1.1, 110)),
    (("garlic", "hvidløg", "knoflook"), Nutrients(149, 0.5, 33, 6.4, 3)),
    (("broccoli",), Nutrients(34, 0.4, 6.6, 2.8, 300)),
    (("cucumber", "agurk", "komkommer"), Nutrients(15, 0.1, 3.6, 0.7, 300)),
    (("avocado",), Nutrients(160, 14.7, 8.5, 2, 150)),
    (("carrot", "gulerod", "wortel"), Nutrients(41, 0.2, 9.6, 0.9, 70)),
    (("banana", "banan", "banaan"), Nutrients(89, 0.3, 22.8, 1.1, 120)),
    (("apple", "æble", "appel"), Nutrients(52, 0.2, 13.8, 0.3, 180)),
    (("sugar", "sukker", "suiker"), Nutrients(387, 0, 100, 0)),
)


def _food(name: str) -> Nutrients | None:
    normalized = name.casefold()
    return next((value for aliases, value in _FOODS if any(alias in normalized for alias in aliases)), None)


def _grams(item, food: Nutrients) -> float | None:
    if item.quantity is None:
        return None
    quantity = float(item.quantity_max or item.quantity)
    if item.unit is None:
        return quantity * food.count_grams
    symbol = item.unit.symbol.casefold().strip(".")
    if item.unit.dimension is UnitDimension.MASS:
        return quantity * (1000 if symbol in {"kg", "kilo"} else 1)
    if item.unit.dimension is UnitDimension.VOLUME:
        return quantity * ({"l": 1000, "dl": 100, "cl": 10, "ml": 1, "spsk": 15, "tbsp": 15, "tsk": 5, "tsp": 5}.get(symbol, 1))
    return quantity * food.count_grams


def estimate_nutrition(recipe: Recipe) -> dict | None:
    totals = {"calories": 0.0, "fatContent": 0.0, "carbohydrateContent": 0.0, "proteinContent": 0.0}
    measured = 0
    for item in recipe.ingredients:
        name = item.ingredient.normalized_name if item.ingredient else item.raw_text
        food = _food(name)
        grams = _grams(item, food) if food else None
        if food is None or grams is None:
            continue
        measured += 1
        factor = grams / 100
        totals["calories"] += food.calories * factor
        totals["fatContent"] += food.fat * factor
        totals["carbohydrateContent"] += food.carbohydrates * factor
        totals["proteinContent"] += food.protein * factor
    if measured == 0:
        return None
    servings = float(recipe.servings or Decimal(1))
    result = {key: round(value / servings, 1) for key, value in totals.items()}
    result.update({"estimated": True, "coveragePercent": round(measured / max(len(recipe.ingredients), 1) * 100), "servingBasis": "per serving"})
    return result


def nutrition_for_recipe(recipe: Recipe) -> dict | None:
    supplied = recipe.nutrition or {}
    nutrient_keys = {"calories", "calorieContent", "energy", "fatContent", "fat", "carbohydrateContent", "carbohydrates", "carbs", "proteinContent", "protein"}
    has_value = any(key in supplied and any(character.isdigit() for character in str(supplied[key])) for key in nutrient_keys)
    return supplied if has_value else estimate_nutrition(recipe)
