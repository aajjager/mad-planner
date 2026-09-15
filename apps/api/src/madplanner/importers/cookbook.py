import io
import re
import zipfile

import yaml

from madplanner.schemas.imported_recipe import CookBookRecipePreview

MAX_ARCHIVE_BYTES = 25 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024
MAX_FILES = 1000


def _minutes(value: object) -> int | None:
    match = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?", str(value or "").strip(), re.IGNORECASE)
    return (int(match.group(1) or 0) * 60 + int(match.group(2) or 0)) if match else None


def _suggest_types(name: str, description: str, tags: list[str]) -> list[str]:
    text = " ".join([name, description, *tags]).casefold()
    aliases = {
        "Breakfast": ("breakfast", "morgenmad", "brunch"), "Lunch": ("lunch", "frokost"), "Dinner": ("dinner", "aftensmad", "hovedret"),
        "Bake-off": ("bake-off", "bagværk", "boller", "flutes", "pastry"), "Cake": ("cake", "kage", "tærte", "sandkage"),
        "Dessert": ("dessert", "tiramisu", "is ", "crumble"), "Bread": ("bread", "brød", "boller", "flutes"), "Snack": ("snack", "cookies", "småkager"),
    }
    return [kind for kind, words in aliases.items() if any(word in text for word in words)]


def parse_cookbook_archive(content: bytes, existing_names: set[str]) -> list[CookBookRecipePreview]:
    if not content or len(content) > MAX_ARCHIVE_BYTES or not zipfile.is_zipfile(io.BytesIO(content)):
        raise ValueError("Upload a valid CookBook ZIP file up to 25 MB")
    results: list[CookBookRecipePreview] = []
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            infos = [item for item in archive.infolist() if item.filename.casefold().endswith((".yml", ".yaml"))]
            if not infos or len(archive.infolist()) > MAX_FILES or sum(item.file_size for item in archive.infolist()) > MAX_UNCOMPRESSED_BYTES:
                raise ValueError("The CookBook archive is empty or too large to process safely")
            for info in infos:
                if info.file_size > 2 * 1024 * 1024:
                    raise ValueError("A recipe file in the archive is unexpectedly large")
                data = yaml.safe_load(archive.read(info))
                if not isinstance(data, dict) or not str(data.get("name") or "").strip():
                    continue
                name = str(data["name"]).strip(); description = str(data.get("description") or "").strip()
                tags = [str(value).strip() for value in (data.get("tags") or []) if str(value).strip()]
                ingredients = [str(value).strip() for value in (data.get("ingredients") or []) if str(value).strip()]
                instructions = [str(value).strip() for value in (data.get("directions") or []) if str(value).strip()]
                prep = _minutes(data.get("prep_time")); cook = _minutes(data.get("cook_time")); other = _minutes(data.get("other_time"))
                warnings = []
                if not ingredients: warnings.append("No ingredients were found")
                image = str(data.get("image") or "").strip() or next((str(value).strip() for value in (data.get("images") or []) if str(value).strip()), "")
                results.append(CookBookRecipePreview(name=name, description=description or None, image_url=image or None, servings=str(data.get("servings") or "").strip() or None, preparation_time_minutes=prep, cooking_time_minutes=cook, total_time_minutes=sum(value or 0 for value in (prep, cook, other)) or None, category=", ".join(tags) or None, tags=tags, ingredients=ingredients, instructions=instructions, suggested_recipe_types=_suggest_types(name, description, tags), duplicate=name.casefold() in existing_names, warnings=warnings))
    except (zipfile.BadZipFile, yaml.YAMLError) as error:
        raise ValueError("The CookBook archive contains an invalid recipe file") from error
    return results
