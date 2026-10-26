import csv
import io
import os
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
    if title:
        index = title_candidates.index(title)
        parts = []
        for line in title_candidates[index:]:
            if not line.isupper() or re.search(r"\b(?:pers|min|serves|kcal)\b", line, re.IGNORECASE):
                break
            parts.append(line)
        title = " ".join(parts)
    name = title or (title_candidates[0] if title_candidates else lines[0])
    title_index = next((i for i, line in enumerate(lines) if name.startswith(line)), 0)
    title_end = title_index + 1
    while title_end < first_heading and lines[title_end].isupper():
        title_end += 1
    description = " ".join(line for line in lines[title_end:first_heading] if not _METADATA.match(line) and not re.search(r"\b(?:pers|personer|min|servings)\b|\d\s*(?:min|pers)", line, re.IGNORECASE)) if first_heading < len(lines) else ""
    warnings: list[str] = []
    if ingredient_index is not None and instruction_index is None:
        ingredient_lines = []
        marked_items = any(line.startswith("[[ITEM]]") for line in lines[ingredient_index + 1:])
        for line in lines[ingredient_index + 1:]:
            if _METADATA.match(line) or _heading(line, {"serves", "total calories", "nutrition", "næringsindhold"}):
                break
            if marked_items:
                if line.startswith("[[ITEM]]"):
                    ingredient_lines.append(line.removeprefix("[[ITEM]]").strip())
                elif ingredient_lines:
                    ingredient_lines[-1] += " " + line
                continue
            if _QUANTITY.match(line) and not re.fullmatch(r"[\d\s¼½¾]+", line):
                ingredient_lines.append(_clean_ingredient(line))
            elif ingredient_lines:
                ingredient_lines[-1] += " " + line
            elif len(line) > 8:
                ingredient_lines.append(line)
        ingredients = ingredient_lines
        instructions = []
    elif ingredient_index is not None and instruction_index is not None:
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
    return RecipeScanPreview(name=name[:300], description=description or None, ingredients=ingredients, instructions=instructions, raw_text=text.replace("[[ITEM]] ", ""), warnings=warnings)


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


def _focused_text(image: bytes, tsv: str, command: list[str], deadline: float) -> str | None:
    """Read ingredient columns separately, keeping their commentary with the item."""
    groups: dict[tuple[str, ...], list[dict[str, str]]] = {}
    for word in csv.DictReader(io.StringIO(tsv), delimiter="\t", quoting=csv.QUOTE_NONE):
        if word.get("level") == "5" and word.get("text", "").strip():
            groups.setdefault(tuple(word[k] for k in ("block_num", "par_num", "line_num")), []).append(word)
    lines = []
    for words in groups.values():
        words.sort(key=lambda w: int(w["left"]))
        lines.append({"text": " ".join(w["text"] for w in words), "left": min(int(w["left"]) for w in words), "top": min(int(w["top"]) for w in words), "right": max(int(w["left"]) + int(w["width"]) for w in words), "bottom": max(int(w["top"]) + int(w["height"]) for w in words), "confidence": sum(max(0, float(w["conf"])) for w in words) / len(words), "height": median(int(w["height"]) for w in words)})
    ingredient = next((line for line in lines if _heading(line["text"], _INGREDIENT_HEADINGS)), None)
    if not ingredient or any(_heading(line["text"], _INSTRUCTION_HEADINGS) for line in lines):
        return None
    with Image.open(io.BytesIO(image)) as page:
        height = median(line["height"] for line in lines if len(line["text"]) > 8)
        first_body = [line["top"] for line in lines if line["top"] > ingredient["top"] + height * 1.3 and line["confidence"] >= 55 and len(line["text"]) > 8]
        top = min(first_body, default=ingredient["bottom"])
        footers = [line["top"] for line in lines if line["top"] > top and (_METADATA.match(line["text"]) or _heading(line["text"], {"serves", "total calories", "nutrition"}) or re.search(r"\b(?:servings|portioner|personer|humans)\b", line["text"], re.IGNORECASE))]
        bottom = min(footers, default=page.height)
        body = [line for line in lines if top <= line["top"] < bottom and len(line["text"]) > 8 and line["confidence"] >= 50]
        if len(body) < 2:
            return None
        starts = sorted(line["left"] for line in body)
        gaps = [(starts[i + 1] - starts[i], i) for i in range(1, len(starts) - 2)]
        gap, index = max(gaps, default=(0, 0))
        regions = [(max(0, min(starts) - round(height * 3)), page.width)]
        if gap > page.width * 0.18:
            split = (starts[index] + starts[index + 1]) / 2
            left_lines = [line for line in body if line["left"] < split]
            # Use the whitespace gutter, not the centre of the columns' starting positions.
            left_end = sorted(line["right"] for line in left_lines)[round((len(left_lines) - 1) * 0.8)]
            boundary = round((min(left_end, starts[index + 1] - height * 3) + starts[index + 1]) / 2)
            regions = [(max(0, min(starts) - round(height * 3)), boundary), (boundary, page.width)]

        def recognize(crop, mode):
            remaining = deadline - time.monotonic()
            if remaining < 1:
                return ""
            out = io.BytesIO()
            ImageOps.expand(crop, border=24, fill=255).save(out, format="PNG")
            args = list(command)
            args[args.index("--psm") + 1] = mode
            try:
                result = subprocess.run(args, input=out.getvalue(), capture_output=True, timeout=min(15, remaining), check=False)
                return result.stdout.decode("utf-8", errors="replace") if result.returncode == 0 else ""
            except (OSError, subprocess.TimeoutExpired):
                return ""

        quantity_x = sorted(int(w["left"]) for words in groups.values() for w in words if top <= int(w["top"]) < bottom and re.fullmatch(r"[1-9]\d?", w["text"]) and float(w["conf"]) >= 40)
        quantity_gaps = [(quantity_x[i + 1] - quantity_x[i], i) for i in range(0, len(quantity_x) - 2)]
        quantity_gap, quantity_index = max(quantity_gaps, default=(0, 0))
        if len(regions) == 1 and quantity_gap > page.width * 0.2:
            boundary = round(quantity_x[quantity_index + 1] - height * 0.5)
            regions = [(max(0, min(starts) - round(height * 3)), boundary), (boundary, page.width)]

        if len(regions) == 1 and len(quantity_x) >= 2 and min(quantity_x) > page.width * 0.4:
            boundary = round(min(quantity_x) - height * 0.5)
            regions = [(max(0, min(starts) - round(height * 3)), boundary), (boundary, page.width)]

        title_tsv = recognize(page.crop((0, 0, page.width, ingredient["top"])), "11")
        title_groups: dict[tuple[str, ...], list[dict[str, str]]] = {}
        for word in csv.DictReader(io.StringIO(title_tsv), delimiter="\t", quoting=csv.QUOTE_NONE):
            if word.get("level") == "5" and word.get("text", "").strip() and float(word.get("conf", 0)) >= 35:
                title_groups.setdefault(tuple(word[k] for k in ("block_num", "par_num", "line_num")), []).append(word)
        titles = []
        for words in title_groups.values():
            max_height = max(int(word["height"]) for word in words)
            words = [word for word in words if int(word["height"]) >= max_height * 0.5]
            text = " ".join(word["text"] for word in sorted(words, key=lambda w: int(w["left"])))
            if median(int(word["height"]) for word in words) >= height * 1.6 and sum(c.isalpha() for c in text) > 2:
                titles.append((min(int(word["top"]) for word in words), text))
        uppercase_titles = [(y, text) for y, text in titles if sum(c.isupper() for c in text) / max(1, sum(c.isalpha() for c in text)) >= 0.75]
        if uppercase_titles:
            titles = uppercase_titles
        title = " ".join(text.strip(' \"|.:;—') for _, text in sorted(titles)) or "Scanned recipe"
        columns = []
        for left, right in regions:
            data = recognize(page.crop((left, max(0, top - round(height / 3)), right, bottom)), "6")
            column_groups: dict[tuple[str, ...], list[dict[str, str]]] = {}
            for word in csv.DictReader(io.StringIO(data), delimiter="\t", quoting=csv.QUOTE_NONE):
                if word.get("level") == "5" and word.get("text", "").strip():
                    column_groups.setdefault(tuple(word[k] for k in ("block_num", "par_num", "line_num")), []).append(word)
            rows = []
            for words in column_groups.values():
                words.sort(key=lambda word: int(word["left"]))
                text = " ".join(w["text"] for w in words)
                if sum(c.isalpha() for c in text) >= 2 and sum(max(0, float(w["conf"])) for w in words) / len(words) >= 40:
                    rows.append((min(int(w["top"]) for w in words), max(int(w["top"]) + int(w["height"]) for w in words), text))
            rows.sort()
            text_lines = []
            previous_bottom = None
            for row_top, row_bottom, text in rows:
                if _METADATA.match(text) or _heading(text, {"serves", "total calories", "nutrition"}):
                    bottom = min(bottom, max(0, top - round(height / 3)) + row_top - 24)
                    break
                is_item = previous_bottom is None or row_top - previous_bottom > height * 0.65 or bool(re.match(r"^\d+\s+(?:[A-ZÀ-Þ][a-zà-ÿ]|(?:g|kg|ml|dl|l|tsk|spsk)\b)", text))
                text_lines.append(("[[ITEM]] " if is_item else "") + text)
                previous_bottom = row_bottom
            if text_lines:
                columns.append("\n".join(text_lines))
        if len(columns) != len(regions):
            return None  # Keep the original complete pass if a focused pass failed.
        return title + "\nIngredients\n" + "\n".join(columns)


class RecipeScanService:
    def preview(self, image: bytes, language: str = "auto") -> RecipeScanPreview:
        prepared = _prepared_pages(image)
        previews: list[tuple[RecipeScanPreview, float]] = []
        passes = [(page, "3", True) for page in prepared]
        # Keep the legacy passes only for test/fallback environments without preprocessing.
        if not prepared:
            passes = [(image, mode, False) for mode in ("3", "6")]
        deadline = time.monotonic() + 50
        for data, mode, enhanced in passes:
            remaining = deadline - time.monotonic()
            if remaining < 1:
                break
            languages = {"auto": "eng+dan+nld", "en": "eng", "da": "dan", "nl": "nld"}
            command = ["tesseract", "stdin", "stdout", "-l", languages.get(language, "eng+dan+nld"), "--psm", mode.split("-")[0]]
            if os.environ.get("MADPLANNER_TESSDATA_DIR"):
                command += ["--tessdata-dir", os.environ["MADPLANNER_TESSDATA_DIR"]]
            if mode.endswith("-adaptive"):
                command += ["-c", "thresholding_method=1", "-c", "thresholding_tile_size=0.2", "-c", "thresholding_smooth_kernel_size=0.1"]
            if enhanced:
                command += ["-c", "tessedit_create_tsv=1"]
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
                if enhanced:
                    if not mode.endswith("-adaptive") and not any(_heading(line, _INGREDIENT_HEADINGS) for line in _layout_text(text).splitlines()):
                        passes.append((data, "3-adaptive", True))
                    focused = _focused_text(data, text, command, deadline)
                    if focused:
                        text_for_parse = focused
                    else:
                        text_for_parse = _layout_text(text)
                else:
                    text_for_parse = text
                previews.append((parse_scanned_recipe(text_for_parse), confidence))
        if not previews:
            raise RuntimeError("Recipe scanning is temporarily unavailable")
        selected, confidence = max(previews, key=lambda item: (
            sum(any(_heading(line, headings) for line in item[0].raw_text.splitlines()) for headings in (_INGREDIENT_HEADINGS, _INSTRUCTION_HEADINGS)),
            item[1] >= 0.6,
            sum(len(line) for line in item[0].ingredients + item[0].instructions) * item[1] ** 4,
            -len(item[0].warnings),
        ))
        anchored = any(_heading(line, _INGREDIENT_HEADINGS | _INSTRUCTION_HEADINGS) for line in selected.raw_text.splitlines())
        if not anchored and (confidence < 0.7 or sum(len(line.split()) for line in selected.ingredients + selected.instructions) < 12):
            return RecipeScanPreview(name="Scanned recipe", raw_text=selected.raw_text, confidence=confidence, usable=False, warnings=["No reliable recipe text was found. Use this photo as the recipe image only, or add a clear photo of the text page."])
        return selected.model_copy(update={"confidence": confidence})
