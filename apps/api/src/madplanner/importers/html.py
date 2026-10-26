import re

from selectolax.parser import HTMLParser, Node

from madplanner.importers.json_ld import RecipeParseError
from madplanner.schemas.imported_recipe import ImportedRecipePreview


def _clean(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = " ".join(value.split())
    return cleaned or None


def _content(document: HTMLParser, *selectors: str) -> str | None:
    for selector in selectors:
        node = document.css_first(selector)
        if node:
            value = node.attributes.get("content") or node.attributes.get("value") or node.text()
            if cleaned := _clean(value):
                return cleaned
    return None


def _recipe_name(document: HTMLParser) -> str | None:
    recipe_names: list[str] = []
    unscoped_names: list[str] = []
    for node in document.css('[itemprop~="name"]'):
        owner = node.parent
        while owner is not None and "itemscope" not in owner.attributes:
            owner = owner.parent
        value = _node_text(node)
        if not value:
            continue
        if owner is None:
            unscoped_names.append(value)
        elif any(kind.rstrip("/").rsplit("/", 1)[-1] == "Recipe"
                 for kind in owner.attributes.get("itemtype", "").split()):
            recipe_names.append(value)
    if recipe_names:
        return recipe_names[0]
    return _content(document, 'meta[property="og:title"]', 'meta[name="twitter:title"]', "h1") or (
        unscoped_names[0] if unscoped_names else _content(document, "title")
    )


def _texts(document: HTMLParser, selectors: tuple[str, ...]) -> list[str]:
    values: list[str] = []
    seen: set[str] = set()
    for selector in selectors:
        for node in document.css(selector):
            value = _node_text(node)
            if value and value.casefold() not in seen:
                seen.add(value.casefold())
                values.append(value)
    return values


def _node_text(node: Node) -> str | None:
    value = node.attributes.get("content") or node.text(separator=" ")
    return _clean(value)


def _instruction_texts(document: HTMLParser, selectors: tuple[str, ...]) -> list[str]:
    # Use one representation of the instructions, preserving repeated steps.
    for selector in selectors:
        values = [value for node in document.css(selector) if (value := _node_text(node))]
        if values:
            return values
    return []


def _minutes(value: str | None) -> int | None:
    if not value:
        return None
    iso = re.fullmatch(r"P(?:T)?(?:(\d+)H)?(?:(\d+)M)?", value, re.IGNORECASE)
    if iso:
        hours, minutes = (int(part or 0) for part in iso.groups())
        return hours * 60 + minutes
    hours = re.search(r"(\d+)\s*(?:h|hr|hour|time|timer)", value, re.IGNORECASE)
    minutes = re.search(r"(\d+)\s*(?:m|min|minute|minutter)", value, re.IGNORECASE)
    if hours or minutes:
        hour_count = int(hours.group(1)) if hours else 0
        minute_count = int(minutes.group(1)) if minutes else 0
        return hour_count * 60 + minute_count
    numeric = re.fullmatch(r"\s*(\d+)\s*", value)
    return int(numeric.group(1)) if numeric else None


def parse_html_recipe(html: str, source_url: str) -> ImportedRecipePreview:
    document = HTMLParser(html)
    ingredients = _texts(document, (
        '[itemprop="recipeIngredient"]', '[itemprop="ingredients"]',
        '.recipe-ingredient', '.recipe-ingredients li', '.ingredients li',
    ))
    instructions = _instruction_texts(document, (
        '[itemprop="recipeInstructions"] li', '.recipe-instruction',
        '.recipe-instructions li', '.instructions li',
    ))
    if not instructions:
        instructions = _instruction_texts(document, (
            '[itemprop="recipeInstructions"] p', '.recipe-instructions p', '.instructions p',
        ))
    if not instructions:
        instructions = _instruction_texts(document, ('[itemprop="recipeInstructions"]',))
    if not ingredients and not instructions:
        raise RecipeParseError("No recipe data was found on this page")

    name = _recipe_name(document)
    if not name:
        raise RecipeParseError("The recipe name could not be found on this page")

    return ImportedRecipePreview(
        name=name,
        description=_content(document, '[itemprop="description"]', 'meta[property="og:description"]', 'meta[name="description"]'),
        image_url=_content(document, '[itemprop="image"]', 'meta[property="og:image"]', 'meta[name="twitter:image"]'),
        source_url=source_url,
        author=_content(document, '[itemprop="author"]', 'meta[name="author"]'),
        servings=_content(document, '[itemprop="recipeYield"]'),
        preparation_time_minutes=_minutes(_content(document, '[itemprop="prepTime"]')),
        cooking_time_minutes=_minutes(_content(document, '[itemprop="cookTime"]')),
        total_time_minutes=_minutes(_content(document, '[itemprop="totalTime"]')),
        cuisine=_content(document, '[itemprop="recipeCuisine"]'),
        category=_content(document, '[itemprop="recipeCategory"]'),
        ingredients=ingredients,
        instructions=instructions,
        nutrition=None,
        parser="html",
    )
