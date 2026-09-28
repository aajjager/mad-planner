from madplanner.models import Recipe
from madplanner.models.recipe import RecipeIngredient
from madplanner.services.nutrition import estimate_nutrition


def test_legacy_raw_ingredient_quantities_are_used_for_nutrition() -> None:
    recipe = Recipe(
        name="Monsterpasta",
        servings=4,
        ingredients=[
            RecipeIngredient(position=1, raw_text="500 g pasta"),
            RecipeIngredient(position=2, raw_text="600 g kyllingebryst"),
            RecipeIngredient(position=3, raw_text="200 g cherrytomater"),
        ],
    )

    nutrition = estimate_nutrition(recipe)

    assert nutrition is not None
    assert nutrition["coveragePercent"] == 100
    assert nutrition["calories"] > 0
    assert nutrition["proteinContent"] > 0


def test_danish_count_and_volume_ingredients_can_be_estimated() -> None:
    recipe = Recipe(
        name="Kikærtekarry",
        servings=4,
        ingredients=[
            RecipeIngredient(position=1, raw_text="2 dåser kikærter"),
            RecipeIngredient(position=2, raw_text="1 dåse kokosmælk"),
            RecipeIngredient(position=3, raw_text="2 spsk olivenolie"),
        ],
    )

    nutrition = estimate_nutrition(recipe)

    assert nutrition is not None
    assert nutrition["coveragePercent"] == 100


def test_cookie_nutrition_is_labelled_as_the_whole_batch() -> None:
    recipe = Recipe(
        name="Chocolate chip cookies",
        servings=1,
        ingredients=[
            RecipeIngredient(position=1, raw_text="500 g flour"),
            RecipeIngredient(position=2, raw_text="250 g butter"),
            RecipeIngredient(position=3, raw_text="200 g sugar"),
        ],
    )

    nutrition = estimate_nutrition(recipe)

    assert nutrition is not None
    assert nutrition["servingBasis"] == "whole batch"
    assert nutrition["calories"] > 4000


def test_meal_with_multiple_servings_remains_per_serving() -> None:
    recipe = Recipe(name="Chicken dinner", servings=4, ingredients=[RecipeIngredient(position=1, raw_text="600 g chicken")])

    nutrition = estimate_nutrition(recipe)

    assert nutrition is not None
    assert nutrition["servingBasis"] == "per serving"
    assert nutrition["calories"] < 300
