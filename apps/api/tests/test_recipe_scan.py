from madplanner.services.recipe_scan import parse_scanned_recipe


def test_scanned_recipe_sections_are_detected() -> None:
    preview = parse_scanned_recipe("Pancakes\nIngredients\n2 eggs\n200 g flour\nInstructions\nWhisk everything\nCook in a pan")
    assert preview.name == "Pancakes"
    assert preview.ingredients == ["2 eggs", "200 g flour"]
    assert preview.instructions == ["Whisk everything", "Cook in a pan"]
    assert preview.warnings == []
