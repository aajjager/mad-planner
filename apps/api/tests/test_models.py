from decimal import Decimal

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from madplanner.db.base import Base
from madplanner.models import Ingredient, IngredientAlias, Recipe, RecipeIngredient, RecipeInstruction, Tag, Unit
from madplanner.models.ingredient import UnitDimension


def test_recipe_relationships_preserve_structured_and_raw_ingredient_data() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    onion = Ingredient(
        name="Onion",
        normalized_name="onion",
        grocery_category="Vegetables",
        aliases=[IngredientAlias(alias="Yellow onions", normalized_alias="yellow onions")],
    )
    piece = Unit(name="piece", symbol="pc", dimension=UnitDimension.COUNT)
    recipe = Recipe(
        name="Onion soup",
        servings=Decimal("4"),
        ingredients=[
            RecipeIngredient(
                position=1,
                raw_text="2 large yellow onions, sliced",
                quantity=Decimal("2"),
                preparation="sliced",
                ingredient=onion,
                unit=piece,
            )
        ],
        instructions=[RecipeInstruction(position=1, text="Slice the onions.")],
        tags=[Tag(name="Dinner", normalized_name="dinner")],
    )

    with Session(engine) as session:
        session.add(recipe)
        session.commit()
        stored_recipe = session.scalar(select(Recipe).where(Recipe.name == "Onion soup"))

        assert stored_recipe is not None
        assert stored_recipe.ingredients[0].raw_text == "2 large yellow onions, sliced"
        assert stored_recipe.ingredients[0].ingredient.normalized_name == "onion"
        assert stored_recipe.ingredients[0].unit.dimension is UnitDimension.COUNT
        assert stored_recipe.instructions[0].text == "Slice the onions."
        assert stored_recipe.tags[0].normalized_name == "dinner"
