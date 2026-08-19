import pytest
from fastapi.testclient import TestClient

from madplanner.api.routes.recipe_imports import get_recipe_importer
from madplanner.importers.json_ld import RecipeParseError, parse_json_ld_recipe
from madplanner.importers.safe_http import SafeHttpClient, UnsafeUrlError
from madplanner.main import app
from madplanner.schemas.imported_recipe import ImportedRecipePreview


SAMPLE_HTML = """
<html><head><script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Danish pancakes",
  "description": "Thin and golden.",
  "author": {"@type": "Person", "name": "Mad Planner"},
  "recipeYield": "4 servings",
  "prepTime": "PT10M",
  "cookTime": "PT20M",
  "totalTime": "PT30M",
  "recipeCuisine": "Danish",
  "recipeCategory": "Dessert",
  "recipeIngredient": ["200 g flour", "3 eggs"],
  "recipeInstructions": [
    {"@type": "HowToStep", "text": "Whisk the batter."},
    {"@type": "HowToStep", "text": "Cook until golden."}
  ]
}
</script></head></html>
"""


def test_json_ld_recipe_is_normalized_to_preview() -> None:
    preview = parse_json_ld_recipe(SAMPLE_HTML, "https://example.com/pancakes")

    assert preview.name == "Danish pancakes"
    assert preview.total_time_minutes == 30
    assert preview.ingredients == ["200 g flour", "3 eggs"]
    assert preview.instructions == ["Whisk the batter.", "Cook until golden."]
    assert preview.parser == "json-ld"


def test_parser_rejects_pages_without_recipe_data() -> None:
    with pytest.raises(RecipeParseError):
        parse_json_ld_recipe("<html><body>No recipe</body></html>", "https://example.com")


@pytest.mark.parametrize("url", ["file:///etc/passwd", "http://127.0.0.1/", "http://localhost/"])
def test_safe_client_blocks_non_web_and_local_urls(url: str) -> None:
    with pytest.raises(UnsafeUrlError):
        SafeHttpClient().validate_url(url)


def test_preview_endpoint_returns_imported_recipe() -> None:
    class StubImporter:
        def preview(self, url: str) -> ImportedRecipePreview:
            return parse_json_ld_recipe(SAMPLE_HTML, url)

    app.dependency_overrides[get_recipe_importer] = StubImporter
    try:
        response = TestClient(app).post(
            "/api/v1/recipe-imports/preview",
            json={"url": "https://example.com/pancakes"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["name"] == "Danish pancakes"
