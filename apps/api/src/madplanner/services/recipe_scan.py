import re
import subprocess

from madplanner.schemas.recipe_scan import RecipeScanPreview

_INGREDIENT_HEADINGS = {"ingredients", "ingredient", "ingredienser", "ingrediënten", "du skal bruge", "det skal du bruge", "benodigdheden"}
_INSTRUCTION_HEADINGS = {"instructions", "instruction", "method", "directions", "fremgangsmåde", "sådan gør du", "tilberedning", "bereiding", "bereidingswijze"}
_METADATA = re.compile(r"^(?:prep|preparation|forberedelse|tilberedningstid|cook|cooking|total|tid|time|serves|servings|portioner|personer)\b", re.IGNORECASE)
_QUANTITY = re.compile(r"^(?:[-•*]\s*)?(?:ca\.?\s*)?(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞])", re.IGNORECASE)
_STEP = re.compile(r"^(?:(?:step|trin)\s*\d+[.):\-]?|\d+[.):])\s+", re.IGNORECASE)


def _heading(line: str, headings: set[str]) -> bool:
    normalized = re.sub(r"\s*[(:].*$", "", line.casefold()).strip(" :-")
    return normalized in headings


def _clean_ingredient(line: str) -> str:
    return re.sub(r"^[-•*]\s*", "", line).strip()


def _clean_step(line: str) -> str:
    return re.sub(r"^(?:[-•*]\s*|(?:(?:step|trin)\s*\d+[.):\-]?|\d+[.):])\s+)", "", line, flags=re.IGNORECASE).strip()


def _join_instruction_lines(lines: list[str]) -> list[str]:
    instructions: list[str] = []
    for line in lines:
        cleaned = _clean_step(line)
        if not cleaned:
            continue
        if _STEP.match(line) or not instructions or cleaned[:1].isupper() or instructions[-1].endswith((".", "!", "?", ":")):
            instructions.append(cleaned)
        else:
            instructions[-1] = f"{instructions[-1]} {cleaned}"
    return instructions


def parse_scanned_recipe(text: str) -> RecipeScanPreview:
    lines = [" ".join(line.split()) for line in text.splitlines() if line.strip()]
    if not lines:
        return RecipeScanPreview(name="Scanned recipe", raw_text=text, warnings=["No readable text was detected. Try a clearer, well-lit photo."])
    ingredient_index = next((index for index, line in enumerate(lines) if _heading(line, _INGREDIENT_HEADINGS)), None)
    instruction_index = next((index for index, line in enumerate(lines) if _heading(line, _INSTRUCTION_HEADINGS)), None)
    first_heading = min((index for index in (ingredient_index, instruction_index) if index is not None), default=len(lines))
    title_candidates = [line for line in lines[:first_heading] if not _METADATA.match(line)]
    name = title_candidates[0] if title_candidates else lines[0]
    warnings: list[str] = []
    if ingredient_index is not None and instruction_index is not None:
        if ingredient_index < instruction_index:
            ingredient_lines = lines[ingredient_index + 1:instruction_index]
            instruction_lines = lines[instruction_index + 1:]
        else:
            instruction_lines = lines[instruction_index + 1:ingredient_index]
            ingredient_lines = lines[ingredient_index + 1:]
        ingredients = [_clean_ingredient(line) for line in ingredient_lines if not _METADATA.match(line)]
        instructions = _join_instruction_lines(instruction_lines)
    else:
        body = [line for line in lines if line != name and not _METADATA.match(line) and not _heading(line, _INGREDIENT_HEADINGS | _INSTRUCTION_HEADINGS)]
        ingredient_lines = [line for line in body if _QUANTITY.match(line) and not _STEP.match(line)]
        instruction_lines = [line for line in body if line not in ingredient_lines]
        ingredients = [_clean_ingredient(line) for line in ingredient_lines]
        instructions = _join_instruction_lines(instruction_lines)
        warnings.append("Section headings were unclear. Please review the detected ingredients and instructions.")
    ingredients = [line for line in ingredients if line]
    if not ingredients:
        warnings.append("No ingredient list was detected. Add ingredients manually or try a straighter photo.")
    if not instructions:
        warnings.append("No instruction steps were detected. Add the steps manually or try a clearer photo.")
    return RecipeScanPreview(name=name[:300], ingredients=ingredients, instructions=instructions, raw_text=text, warnings=warnings)


class RecipeScanService:
    def preview(self, image: bytes) -> RecipeScanPreview:
        previews: list[RecipeScanPreview] = []
        try:
            for page_segmentation in ("3", "6"):
                result = subprocess.run(["tesseract", "stdin", "stdout", "-l", "eng+dan+nld", "--psm", page_segmentation], input=image, capture_output=True, timeout=45, check=False)
                if result.returncode == 0:
                    previews.append(parse_scanned_recipe(result.stdout.decode("utf-8", errors="replace")))
        except (OSError, subprocess.TimeoutExpired) as error:
            raise RuntimeError("Recipe scanning is temporarily unavailable") from error
        if not previews:
            raise ValueError("The recipe text could not be read from this image")
        return max(previews, key=lambda preview: (bool(preview.ingredients) + bool(preview.instructions), len(preview.ingredients) + len(preview.instructions), -len(preview.warnings)))
