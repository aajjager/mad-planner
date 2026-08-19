from madplanner.importers.json_ld import parse_json_ld_recipe
from madplanner.importers.safe_http import SafeHttpClient
from madplanner.schemas.imported_recipe import ImportedRecipePreview


class RecipeImporter:
    def __init__(self, http_client: SafeHttpClient | None = None) -> None:
        self.http_client = http_client or SafeHttpClient()

    def preview(self, url: str) -> ImportedRecipePreview:
        html = self.http_client.fetch(url)
        return parse_json_ld_recipe(html, url)
