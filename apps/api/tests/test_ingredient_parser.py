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


def test_long_scanned_commentary_is_preserved_as_notes():
    raw = "1 Big Mac (McDonald's). " + "A long printed note about this ingredient. " * 10
    parsed = parse_ingredient(raw)
    assert parsed.ingredient_name == "Big Mac (McDonald's)"
    assert parsed.quantity == Decimal('1')
    assert parsed.notes == ("A long printed note about this ingredient. " * 10).strip()
    assert parsed.raw_text == raw.strip()


@pytest.mark.parametrize('raw', ['1 ' + 'very long ingredient name ' * 20, 'ß' * 180])
def test_unnatural_long_names_fit_both_database_columns_without_losing_raw_text(raw):
    parsed = parse_ingredient(raw)
    assert len(parsed.ingredient_name) <= 200
    assert len(parsed.ingredient_name.casefold()) <= 200
    assert parsed.notes
    assert parsed.raw_text == raw.strip()


def test_ingredient_name_abbreviation_is_not_mistaken_for_commentary():
    parsed = parse_ingredient("1 St. John's wort. Optional garnish.")
    assert parsed.ingredient_name == "St. John's wort"
    assert parsed.notes == 'Optional garnish.'
