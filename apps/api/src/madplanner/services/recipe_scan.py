import re
import subprocess

from madplanner.schemas.recipe_scan import RecipeScanPreview

_INGREDIENT_HEADINGS = {"ingredients", "ingredient", "ingredienser", "ingrediënten"}
_INSTRUCTION_HEADINGS = {"instructions", "method", "directions", "fremgangsmåde", "tilberedning", "bereiding"}


def parse_scanned_recipe(text: str) -> RecipeScanPreview:
    lines = [" ".join(line.split()) for line in text.splitlines() if line.strip()]
    if not lines:
        return RecipeScanPreview(name="Scanned recipe", raw_text=text, warnings=["No readable text was detected. Try a clearer, well-lit photo."])
    ingredient_index = next((index for index, line in enumerate(lines) if line.casefold().rstrip(":") in _INGREDIENT_HEADINGS), None)
    instruction_index = next((index for index, line in enumerate(lines) if line.casefold().rstrip(":") in _INSTRUCTION_HEADINGS), None)
    name = lines[0]
    warnings: list[str] = []
    if ingredient_index is not None and instruction_index is not None and ingredient_index < instruction_index:
        ingredients = lines[ingredient_index + 1:instruction_index]
        instructions = lines[instruction_index + 1:]
    else:
        body = lines[1:]
        ingredients = [line for line in body if re.match(r"^(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞])", line)]
        instructions = [line for line in body if line not in ingredients]
        warnings.append("Section headings were unclear. Please review the detected ingredients and instructions.")
    return RecipeScanPreview(name=name[:300], ingredients=ingredients, instructions=instructions, raw_text=text, warnings=warnings)


class RecipeScanService:
    def preview(self, image: bytes) -> RecipeScanPreview:
        try:
            result = subprocess.run(["tesseract", "stdin", "stdout", "-l", "eng+dan+nld"], input=image, capture_output=True, timeout=45, check=False)
        except (OSError, subprocess.TimeoutExpired) as error:
            raise RuntimeError("Recipe scanning is temporarily unavailable") from error
        if result.returncode != 0:
            raise ValueError("The recipe text could not be read from this image")
        return parse_scanned_recipe(result.stdout.decode("utf-8", errors="replace"))
