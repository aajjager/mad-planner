from madplanner.services.recipe_scan import parse_scanned_recipe
from madplanner.services.recipe_scan import RecipeScanService


def test_scanned_recipe_sections_are_detected() -> None:
    preview = parse_scanned_recipe("Pancakes\nIngredients\n2 eggs\n200 g flour\nInstructions\nWhisk everything\nCook in a pan")
    assert preview.name == "Pancakes"
    assert preview.ingredients == ["2 eggs", "200 g flour"]
    assert preview.instructions == ["Whisk everything", "Cook in a pan"]
    assert preview.warnings == []


def test_scanned_danish_recipe_handles_decorated_headings_and_metadata() -> None:
    preview = parse_scanned_recipe(
        "Kylling med pesto\n4 personer\nIngredienser (4 pers.)\n• 500 g kyllingebryst\n- 300 g pasta\nSådan gør du:\n1. Kog pastaen.\n2) Steg kyllingen\nog tilsæt pesto."
    )

    assert preview.name == "Kylling med pesto"
    assert preview.ingredients == ["500 g kyllingebryst", "300 g pasta"]
    assert preview.instructions == ["Kog pastaen.", "Steg kyllingen og tilsæt pesto."]
    assert preview.warnings == []


def test_scanned_recipe_falls_back_to_quantities_without_headings() -> None:
    preview = parse_scanned_recipe("Tomato soup\n2 cans tomatoes\n1 onion\nChop the onion.\nSimmer everything.")

    assert preview.ingredients == ["2 cans tomatoes", "1 onion"]
    assert preview.instructions == ["Chop the onion.", "Simmer everything."]
    assert len(preview.warnings) == 1


def test_scanner_chooses_the_more_complete_layout_pass(monkeypatch) -> None:
    class Result:
        returncode = 0

        def __init__(self, text: str):
            self.stdout = text.encode()

    monkeypatch.setattr("madplanner.services.recipe_scan._prepared_pages", lambda _: [])
    results = iter([
        Result("Pancakes\nUnreadable body"),
        Result("Pancakes\nIngredients\n2 eggs\nInstructions\nWhisk eggs."),
    ])
    calls: list[list[str]] = []

    def fake_run(command, **_kwargs):
        calls.append(command)
        return next(results)

    monkeypatch.setattr("madplanner.services.recipe_scan.subprocess.run", fake_run)

    preview = RecipeScanService().preview(b"image")

    assert preview.ingredients == ["2 eggs"]
    assert preview.instructions == ["Whisk eggs."]
    assert [command[-1] for command in calls] == ["3", "6"]


def test_wrapped_ingredients_and_intro_are_preserved():
    preview = parse_scanned_recipe("CHILI CON CARNE\n4 pers. 50 min\nA family favourite.\nIngredienser\n3 spsk soltørrede tomater,\nfinthakkede\n500 g kidneybønner, iblødsat og\nkogt (svarende til 2 dåser)\nsalt og friskkværnet peber\nTil servering\n1 pose nachos\nFremgangsmade\nVarm olien.\nTilsæt bønner og varm igennem i\n5 minutter.")
    assert preview.name == "CHILI CON CARNE"
    assert preview.description == "A family favourite."
    assert preview.ingredients == ["3 spsk soltørrede tomater, finthakkede", "500 g kidneybønner, iblødsat og kogt (svarende til 2 dåser)", "salt og friskkværnet peber", "1 pose nachos"]
    assert "5 minutter." in " ".join(preview.instructions)
    assert not preview.warnings


def test_layout_reads_columns_and_orders_split_line_fragments():
    from madplanner.services.recipe_scan import _layout_text
    header = "level\tpage_num\tblock_num\tpar_num\tline_num\tleft\ttop\twidth\theight\tconf\ttext\n"
    # Block order deliberately puts ingredients before the title and interleaves method fragments.
    rows = [(100, 200, "Ingredienser"), (500, 200, "Fremgangsmåde"), (100, 250, "2 eggs"), (700, 252, "the eggs."), (500, 250, "Whisk"), (300, 30, "PANCAKES")]
    tsv = header + "".join(f"5\t1\t{i}\t1\t1\t{x}\t{y}\t100\t20\t90\t{text}\n" for i, (x, y, text) in enumerate(rows))
    preview = parse_scanned_recipe(_layout_text(tsv))
    assert preview.name == "PANCAKES"
    assert preview.ingredients == ["2 eggs"]
    assert preview.instructions == ["Whisk the eggs."]


def test_preparation_handles_spreads_and_rejects_invalid_images():
    import io
    import pytest
    from PIL import Image
    from madplanner.services.recipe_scan import _prepared_pages
    output = io.BytesIO()
    Image.new("RGB", (160, 90), "white").save(output, format="JPEG")
    pages = _prepared_pages(output.getvalue())
    assert len(pages) == 3
    assert Image.open(io.BytesIO(pages[0])).mode == "L"
    with pytest.raises(ValueError, match="decoded"):
        _prepared_pages(b"not an image")


def test_one_timed_out_pass_does_not_discard_success(monkeypatch):
    import subprocess
    from types import SimpleNamespace
    monkeypatch.setattr("madplanner.services.recipe_scan._prepared_pages", lambda _: [])
    results = iter([subprocess.TimeoutExpired("tesseract", 30), SimpleNamespace(returncode=0, stdout=b"Pancakes\nIngredients\n2 eggs\nInstructions\nWhisk eggs.")])
    def run(*_args, **_kwargs):
        result = next(results)
        if isinstance(result, Exception):
            raise result
        return result
    monkeypatch.setattr("madplanner.services.recipe_scan.subprocess.run", run)
    assert RecipeScanService().preview(b"image").ingredients == ["2 eggs"]


def test_pass_selection_prefers_text_coverage_over_number_of_lines(monkeypatch):
    from types import SimpleNamespace
    monkeypatch.setattr("madplanner.services.recipe_scan._prepared_pages", lambda _: [])
    texts = iter(["Soup\nIngredients\n2 tomatoes\nInstructions\nMix.\nBoil.\nEat.", "Soup\nIngredients\n2 tomatoes\nInstructions\nMix all ingredients and simmer gently for twenty minutes before serving with bread."])
    monkeypatch.setattr("madplanner.services.recipe_scan.subprocess.run", lambda *_args, **_kwargs: SimpleNamespace(returncode=0, stdout=next(texts).encode()))
    assert "twenty minutes" in RecipeScanService().preview(b"image").instructions[0]
