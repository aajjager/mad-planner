import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from madplanner.api.routes.recipe_imports import get_recipe_importer
from madplanner.importers.json_ld import RecipeParseError, parse_json_ld_recipe
from madplanner.importers.html import parse_html_recipe
from madplanner.importers.service import RecipeImporter
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
FIXTURES = Path(__file__).parent / "fixtures"


def test_json_ld_recipe_is_normalized_to_preview() -> None:
    preview = parse_json_ld_recipe(SAMPLE_HTML, "https://example.com/pancakes")

    assert preview.name == "Danish pancakes"
    assert preview.total_time_minutes == 30
    assert preview.ingredients == ["200 g flour", "3 eggs"]
    assert preview.instructions == ["Whisk the batter.", "Cook until golden."]
    assert preview.parser == "json-ld"


@pytest.mark.parametrize(
    ("fixture", "source_url", "name", "ingredient_count", "instruction_count"),
    [
        ("mummum_recipe.html", "https://mummum.dk/example/", "Mummum fixture recipe", 2, 1),
        ("arla_recipe.html", "https://www.arla.dk/opskrifter/example/", "Arla fixture recipe", 2, 2),
    ],
)
def test_supported_site_json_ld_fixtures(
    fixture: str,
    source_url: str,
    name: str,
    ingredient_count: int,
    instruction_count: int,
) -> None:
    html = (FIXTURES / fixture).read_text(encoding="utf-8")

    preview = parse_json_ld_recipe(html, source_url)

    assert preview.name == name
    assert preview.image_url is not None
    assert preview.servings == "4 personer"
    assert len(preview.ingredients) == ingredient_count
    assert len(preview.instructions) == instruction_count
    assert preview.parser == "json-ld"


def test_parser_rejects_pages_without_recipe_data() -> None:
    with pytest.raises(RecipeParseError):
        parse_json_ld_recipe("<html><body>No recipe</body></html>", "https://example.com")


def test_html_microdata_is_normalized_to_preview() -> None:
    html = """
    <html><head>
      <meta property="og:title" content="Simple soup">
      <meta property="og:image" content="https://example.com/soup.jpg">
    </head><body>
      <span itemprop="recipeYield">4 personer</span>
      <meta itemprop="prepTime" content="PT15M">
      <ul><li itemprop="recipeIngredient">2 stk. løg</li></ul>
      <ol itemprop="recipeInstructions"><li>Hak løgene.</li><li>Kog suppen.</li></ol>
    </body></html>
    """

    preview = parse_html_recipe(html, "https://example.com/soup")

    assert preview.name == "Simple soup"
    assert preview.image_url == "https://example.com/soup.jpg"
    assert preview.servings == "4 personer"
    assert preview.preparation_time_minutes == 15
    assert preview.ingredients == ["2 stk. løg"]
    assert preview.instructions == ["Hak løgene.", "Kog suppen."]
    assert preview.parser == "html"


def test_importer_falls_back_to_html_when_json_ld_is_missing() -> None:
    class StubHttpClient:
        def fetch(self, url: str) -> str:
            return '<h1>Toast</h1><ul class="ingredients"><li>2 slices bread</li></ul>'

    preview = RecipeImporter(http_client=StubHttpClient()).preview("https://example.com/toast")

    assert preview.name == "Toast"
    assert preview.ingredients == ["2 slices bread"]
    assert preview.parser == "html"


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
