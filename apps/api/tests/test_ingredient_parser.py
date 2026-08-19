from decimal import Decimal

import pytest

from madplanner.ingredients import parse_ingredient
from madplanner.models.ingredient import UnitDimension


@pytest.mark.parametrize(
    ("raw_text", "quantity", "quantity_max", "unit", "dimension", "name"),
    [
        ("70 g. pinjekerner", Decimal("70"), None, "g", UnitDimension.MASS, "pinjekerner"),
        ("1 bundt frisk basilikum", Decimal("1"), None, "bundt", UnitDimension.COUNT, "frisk basilikum"),
        ("2 stk. æg", Decimal("2"), None, "stk", UnitDimension.COUNT, "æg"),
        ("1 dl. olivenolie", Decimal("1"), None, "dl", UnitDimension.VOLUME, "olivenolie"),
        ("1 1/2 kg kartofler", Decimal("1.5"), None, "kg", UnitDimension.MASS, "kartofler"),
        ("½ tsk salt", Decimal("0.5"), None, "tsk", UnitDimension.VOLUME, "salt"),
        ("2-3 fed hvidløg", Decimal("2"), Decimal("3"), "fed", UnitDimension.COUNT, "hvidløg"),
        ("1,5 l vand", Decimal("1.5"), None, "l", UnitDimension.VOLUME, "vand"),
    ],
)
def test_parse_danish_ingredient(raw_text, quantity, quantity_max, unit, dimension, name) -> None:
    parsed = parse_ingredient(raw_text)

    assert parsed.raw_text == raw_text
    assert parsed.quantity == quantity
    assert parsed.quantity_max == quantity_max
    assert parsed.unit is not None
    assert parsed.unit.symbol == unit
    assert parsed.unit.dimension == dimension
    assert parsed.ingredient_name == name


def test_preserves_unquantified_ingredient() -> None:
    parsed = parse_ingredient("salt/peber")

    assert parsed.ingredient_name == "salt/peber"
    assert parsed.quantity is None
    assert parsed.unit is None
