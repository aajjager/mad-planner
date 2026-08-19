import json
import re
from typing import Any

from selectolax.parser import HTMLParser

from madplanner.schemas.imported_recipe import ImportedRecipePreview


class RecipeParseError(ValueError):
    pass


def _minutes(value: Any) -> int | None:
    if not isinstance(value, str):
        return None
    match = re.fullmatch(r"P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?", value)
    if not match:
        return None
    days, hours, minutes = (int(part or 0) for part in match.groups())
    return days * 1440 + hours * 60 + minutes


def _text(value: Any) -> str | None:
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, dict):
        return _text(value.get("name"))
    if isinstance(value, list):
        return next((_text(item) for item in value if _text(item)), None)
    return None


def _image(value: Any) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, list) and value:
        return _image(value[0])
    if isinstance(value, dict):
        return _text(value.get("url") or value.get("contentUrl"))
    return None


def _instructions(value: Any) -> list[str]:
    if isinstance(value, str):
        return [line.strip() for line in value.splitlines() if line.strip()]
    if not isinstance(value, list):
        return []
    steps: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            steps.append(item.strip())
        elif isinstance(item, dict):
            if isinstance(item.get("itemListElement"), list):
                steps.extend(_instructions(item["itemListElement"]))
            else:
                text = _text(item.get("text") or item.get("name"))
                if text:
                    steps.append(text)
    return steps


def _recipe_nodes(value: Any):
    if isinstance(value, list):
        for item in value:
            yield from _recipe_nodes(item)
    elif isinstance(value, dict):
        types = value.get("@type", [])
        if isinstance(types, str):
            types = [types]
        if "Recipe" in types:
            yield value
        if "@graph" in value:
            yield from _recipe_nodes(value["@graph"])


def parse_json_ld_recipe(html: str, source_url: str) -> ImportedRecipePreview:
    document = HTMLParser(html)
    for script in document.css('script[type="application/ld+json"]'):
        try:
            payload = json.loads(script.text())
        except (json.JSONDecodeError, TypeError):
            continue
        for recipe in _recipe_nodes(payload):
            name = _text(recipe.get("name"))
            if not name:
                continue
            ingredients = recipe.get("recipeIngredient") or recipe.get("ingredients") or []
            if isinstance(ingredients, str):
                ingredients = [ingredients]
            return ImportedRecipePreview(
                name=name,
                description=_text(recipe.get("description")),
                image_url=_image(recipe.get("image")),
                source_url=source_url,
                author=_text(recipe.get("author")),
                servings=_text(recipe.get("recipeYield")),
                preparation_time_minutes=_minutes(recipe.get("prepTime")),
                cooking_time_minutes=_minutes(recipe.get("cookTime")),
                total_time_minutes=_minutes(recipe.get("totalTime")),
                cuisine=_text(recipe.get("recipeCuisine")),
                category=_text(recipe.get("recipeCategory")),
                ingredients=[str(item).strip() for item in ingredients if str(item).strip()],
                instructions=_instructions(recipe.get("recipeInstructions")),
                nutrition=recipe.get("nutrition") if isinstance(recipe.get("nutrition"), dict) else None,
                parser="json-ld",
            )
    raise RecipeParseError("No structured recipe data was found on this page")
