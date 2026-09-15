import io
import zipfile

import pytest

from madplanner.importers.cookbook import parse_cookbook_archive


def archive_with(content: str) -> bytes:
    target = io.BytesIO()
    with zipfile.ZipFile(target, "w") as archive:
        archive.writestr("Example.yml", content)
    return target.getvalue()


def test_parses_cookbook_yaml_archive_and_detects_duplicates() -> None:
    content = archive_with("""
name: Pumpkin Soup
description: The perfect winter warmer
servings: 4 servings
image: https://media.cookbookmanager.com/example.jpg
prep_time: PT15M
cook_time: PT40M
tags: [Dinner, Vegetarian, Soup]
ingredients:
  - 750 g pumpkin
  - 1 onion
directions:
  - Dice the vegetables.
  - Simmer until tender.
""")
    recipes = parse_cookbook_archive(content, {"pumpkin soup"})
    assert len(recipes) == 1
    assert recipes[0].duplicate is True
    assert recipes[0].servings == "4 servings"
    assert recipes[0].total_time_minutes == 55
    assert recipes[0].suggested_recipe_types == ["Dinner"]
    assert recipes[0].ingredients == ["750 g pumpkin", "1 onion"]


def test_rejects_non_zip_content() -> None:
    with pytest.raises(ValueError, match="valid CookBook ZIP"):
        parse_cookbook_archive(b"not a zip", set())
