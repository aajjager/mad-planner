import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from madplanner.models.ingredient import UnitDimension


@dataclass(frozen=True)
class ParsedUnit:
    name: str
    symbol: str
    dimension: UnitDimension


@dataclass(frozen=True)
class ParsedIngredient:
    raw_text: str
    ingredient_name: str
    quantity: Decimal | None = None
    quantity_max: Decimal | None = None
    unit: ParsedUnit | None = None


_UNITS: dict[str, ParsedUnit] = {}


def _add_unit(name: str, symbol: str, dimension: UnitDimension, *aliases: str) -> None:
    unit = ParsedUnit(name=name, symbol=symbol, dimension=dimension)
    for alias in aliases:
        _UNITS[alias.casefold().rstrip(".")] = unit


_add_unit("gram", "g", UnitDimension.MASS, "g", "gr", "gram", "gramme")
_add_unit("kilogram", "kg", UnitDimension.MASS, "kg", "kilo", "kilogram")
_add_unit("milliliter", "ml", UnitDimension.VOLUME, "ml", "milliliter")
_add_unit("deciliter", "dl", UnitDimension.VOLUME, "dl", "deciliter")
_add_unit("liter", "l", UnitDimension.VOLUME, "l", "liter")
_add_unit("teaspoon", "tsk", UnitDimension.VOLUME, "tsk", "teske", "teskeer")
_add_unit("tablespoon", "spsk", UnitDimension.VOLUME, "spsk", "spiseske", "spiseskeer")
_add_unit("piece", "stk", UnitDimension.COUNT, "stk", "styk", "stykker")
_add_unit("clove", "fed", UnitDimension.COUNT, "fed")
_add_unit("bunch", "bundt", UnitDimension.COUNT, "bundt")

_FRACTIONS = {
    "¼": Decimal("0.25"), "½": Decimal("0.5"), "¾": Decimal("0.75"),
    "⅓": Decimal(1) / Decimal(3), "⅔": Decimal(2) / Decimal(3),
    "⅛": Decimal("0.125"), "⅜": Decimal("0.375"),
    "⅝": Decimal("0.625"), "⅞": Decimal("0.875"),
}
_NUMBER = r"(?:\d+[.,]\d+|\d+\s+\d+/\d+|\d+/\d+|\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞]|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+)"
_LEADING_QUANTITY = re.compile(rf"^\s*(?P<first>{_NUMBER})(?:\s*(?:-|–|—|til)\s*(?P<second>{_NUMBER}))?\s*", re.IGNORECASE)
_LEADING_UNIT = re.compile(r"^(?P<unit>[^\s,.]+)\.?\s*", re.IGNORECASE)


def _decimal(value: str) -> Decimal | None:
    value = value.strip().replace(",", ".")
    try:
        for glyph, fraction in _FRACTIONS.items():
            if glyph in value:
                whole = value.replace(glyph, "").strip()
                return (Decimal(whole) if whole else Decimal(0)) + fraction
        if " " in value and "/" in value:
            whole, fraction = value.split(maxsplit=1)
            numerator, denominator = fraction.split("/", maxsplit=1)
            return Decimal(whole) + Decimal(numerator) / Decimal(denominator)
        if "/" in value:
            numerator, denominator = value.split("/", maxsplit=1)
            return Decimal(numerator) / Decimal(denominator)
        return Decimal(value)
    except (InvalidOperation, ValueError, ZeroDivisionError):
        return None


def parse_ingredient(raw_text: str) -> ParsedIngredient:
    raw_text = " ".join(raw_text.strip().split())
    if not raw_text:
        return ParsedIngredient(raw_text=raw_text, ingredient_name=raw_text)

    quantity_match = _LEADING_QUANTITY.match(raw_text)
    if quantity_match is None:
        return ParsedIngredient(raw_text=raw_text, ingredient_name=raw_text)

    quantity = _decimal(quantity_match.group("first"))
    quantity_max = _decimal(quantity_match.group("second")) if quantity_match.group("second") else None
    remainder = raw_text[quantity_match.end():]
    unit = None
    unit_match = _LEADING_UNIT.match(remainder)
    if unit_match:
        unit = _UNITS.get(unit_match.group("unit").casefold().rstrip("."))
        if unit:
            remainder = remainder[unit_match.end():]

    ingredient_name = remainder.lstrip(" ,.-").strip() or raw_text
    return ParsedIngredient(
        raw_text=raw_text,
        ingredient_name=ingredient_name,
        quantity=quantity,
        quantity_max=quantity_max,
        unit=unit,
    )
