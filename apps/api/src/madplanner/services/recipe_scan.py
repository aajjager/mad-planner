import csv
import io
import re
import subprocess
import time
from statistics import median
import unicodedata
from difflib import SequenceMatcher

from PIL import Image, ImageFilter, ImageOps, UnidentifiedImageError

from madplanner.schemas.recipe_scan import RecipeScanPreview

_INGREDIENT_HEADINGS = {"ingredients", "ingredient", "ingredienser", "ingrediënten", "du skal bruge", "det skal du bruge", "benodigdheden"}
_INSTRUCTION_HEADINGS = {"instructions", "instruction", "method", "directions", "fremgangsmåde", "sådan gør du", "tilberedning", "bereiding", "bereidingswijze"}
_METADATA = re.compile(r"^(?:prep|preparation|forberedelse|tilberedningstid|cook|cooking|total|tid|time|serves|servings|portioner|personer)\b", re.IGNORECASE)
_QUANTITY = re.compile(r"^(?:[-•*]\s*)?(?:ca\.?\s*)?(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞])", re.IGNORECASE)
_STEP = re.compile(r"^(?:(?:step|trin)\s*\d+[.):\-]?|\d+[.):])\s+", re.IGNORECASE)


def _heading(line: str, headings: set[str]) -> bool:
    normalized = re.sub(r"\s*[(:].*$", "", line.casefold()).strip(" :-")
    plain = lambda value: "".join(c for c in unicodedata.normalize("NFKD", value) if not unicodedata.combining(c))
    return any(SequenceMatcher(None, plain(normalized), plain(heading)).ratio() >= 0.88 for heading in headings)


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
        elif instructions[-1].endswith("-"):
            instructions[-1] = instructions[-1][:-1] + cleaned
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
    title = next((line for line in title_candidates if len(re.sub(r"[^A-Za-zÀ-ÿ]", "", line)) >= 6 and line.isupper()), None)
    name = title or (title_candidates[0] if title_candidates else lines[0])
    title_index = lines.index(name)
    description = " ".join(line for line in lines[title_index + 1:first_heading] if not _METADATA.match(line) and not re.search(r"\b(?:pers|personer|min|servings)\b|\d\s*(?:min|pers)", line, re.IGNORECASE)) if first_heading < len(lines) else ""
    warnings: list[str] = []
    if ingredient_index is not None and instruction_index is not None:
        if ingredient_index < instruction_index:
            ingredient_lines = lines[ingredient_index + 1:instruction_index]
            instruction_lines = lines[instruction_index + 1:]
        else:
            instruction_lines = lines[instruction_index + 1:ingredient_index]
            ingredient_lines = lines[ingredient_index + 1:]
        ingredients = []
        for line in ingredient_lines:
            if _METADATA.match(line) or _heading(line, {"til servering", "servering", "hl servering", "for serving", "to serve"}):
                continue
            cleaned = _clean_ingredient(line)
            if ingredients and not _QUANTITY.match(cleaned) and (ingredients[-1].endswith((",", " og", "-")) or cleaned[:1].islower() and not cleaned.startswith(("salt", "peber", "pepper"))):
                ingredients[-1] += " " + cleaned
            else:
                ingredients.append(cleaned)
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
    return RecipeScanPreview(name=name[:300], description=description or None, ingredients=ingredients, instructions=instructions, raw_text=text, warnings=warnings)


def _layout_text(tsv: str) -> str:
    """Restore column order from OCR coordinates rather than its block order."""
    groups: dict[tuple[str, ...], list[dict[str, str]]] = {}
    for row in csv.DictReader(io.StringIO(tsv), delimiter="\t", quoting=csv.QUOTE_NONE):
        if row.get("level") == "5" and row.get("text", "").strip():
            key = tuple(row[field] for field in ("page_num", "block_num", "par_num", "line_num"))
            groups.setdefault(key, []).append(row)
    heights = [int(word["height"]) for words in groups.values() for word in words]
    tolerance = max(3, median(heights) * 0.7) if heights else 3

    def reading_order(items):
        rows = []
        for item in sorted(items, key=lambda line: (line[0], line[1])):
            if rows and abs(item[0] - rows[-1][0][0]) <= tolerance:
                rows[-1].append(item)
            else:
                rows.append([item])
        return [(row[0][0], min(item[1] for item in row), " ".join(item[2] for item in sorted(row, key=lambda item: item[1]))) for row in rows]

    lines = []
    for words in groups.values():
        words.sort(key=lambda word: int(word["left"]))
        lines.append((min(int(word["top"]) for word in words), min(int(word["left"]) for word in words), " ".join(word["text"] for word in words)))
    ingredient = next((line for line in lines if _heading(line[2], _INGREDIENT_HEADINGS)), None)
    instruction = next((line for line in lines if _heading(line[2], _INSTRUCTION_HEADINGS)), None)
    if ingredient and instruction and abs(ingredient[1] - instruction[1]) > 80 and abs(ingredient[0] - instruction[0]) < 150:
        top = min(ingredient[0], instruction[0])
        boundary = (ingredient[1] + instruction[1]) / 2
        intro = sorted((line for line in lines if line[0] < top), key=lambda line: (line[0], line[1]))
        body = [line for line in lines if line[0] >= top and line not in (ingredient, instruction)]
        ingredient_left = ingredient[1] < instruction[1]
        ingredients = sorted((line for line in body if (line[1] < boundary) == ingredient_left), key=lambda line: (line[0], line[1]))
        instructions = sorted((line for line in body if (line[1] < boundary) != ingredient_left), key=lambda line: (line[0], line[1]))
        lines = reading_order(intro) + [ingredient] + reading_order(ingredients) + [instruction] + reading_order(instructions)
    return "\n".join(line[2] for line in lines)


def _prepared_pages(image: bytes) -> list[bytes]:
    try:
        with Image.open(io.BytesIO(image)) as opened:
            if opened.width * opened.height > 24_000_000:
                raise ValueError("Scanned images must contain at most 24 megapixels")
            original = ImageOps.exif_transpose(opened).convert("L")
            original.thumbnail((2400, 2400))
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise ValueError("The image could not be decoded. Use a valid JPEG, PNG, or WebP photo") from error
    pages = [original]
    if original.width > original.height * 1.45:
        # A spread often has a large photograph that confuses page segmentation.
        pages.extend([original.crop((0, 0, original.width // 2, original.height)), original.crop((original.width // 2, 0, original.width, original.height))])
    prepared = []
    for page in pages:
        factor = min(3, 4800 / max(page.size))
        page = ImageOps.autocontrast(page).resize((round(page.width * factor), round(page.height * factor)), Image.Resampling.LANCZOS)
        page = page.filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=3))
        output = io.BytesIO()
        page.save(output, format="PNG")
        prepared.append(output.getvalue())
    return prepared


class RecipeScanService:
    def preview(self, image: bytes) -> RecipeScanPreview:
        prepared = _prepared_pages(image)
        previews: list[tuple[RecipeScanPreview, float]] = []
        passes = [(image, mode, False) for mode in ("3", "6")]
        passes.extend((page, "3", True) for page in prepared)
        deadline = time.monotonic() + 45
        for data, mode, enhanced in passes:
            remaining = deadline - time.monotonic()
            if remaining < 1:
                break
            command = ["tesseract", "stdin", "stdout", "-l", "dan+eng+nld", "--psm", mode]
            if enhanced:
                command += ["-c", "thresholding_method=1", "-c", "thresholding_tile_size=0.2", "-c", "thresholding_smooth_kernel_size=0.1", "tsv"]
            try:
                result = subprocess.run(command, input=data, capture_output=True, timeout=min(20, remaining), check=False)
            except (OSError, subprocess.TimeoutExpired):
                continue
            if result.returncode == 0:
                text = result.stdout.decode("utf-8", errors="replace")
                confidence = 0.7
                if enhanced:
                    words = [row for row in csv.DictReader(io.StringIO(text), delimiter="\t", quoting=csv.QUOTE_NONE) if row.get("level") == "5" and row.get("text", "").strip()]
                    confidence = sum(max(0, float(row["conf"])) for row in words) / (100 * max(1, len(words)))
                previews.append((parse_scanned_recipe(_layout_text(text) if enhanced else text), confidence))
        if not previews:
            raise RuntimeError("Recipe scanning is temporarily unavailable")
        return max(previews, key=lambda item: (
            bool(item[0].ingredients) + bool(item[0].instructions),
            sum(_heading(line, _INGREDIENT_HEADINGS | _INSTRUCTION_HEADINGS) for line in item[0].raw_text.splitlines()),
            sum(len(line) for line in item[0].ingredients + item[0].instructions) * item[1] ** 4,
            -len(item[0].warnings),
        ))[0]
