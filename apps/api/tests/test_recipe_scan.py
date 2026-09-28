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
