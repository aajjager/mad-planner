import pytest

from madplanner.recipe_text import instruction_text


@pytest.mark.parametrize(("raw", "expected"), [
    ("<p>Heat <strong>oil</strong>.</p><p>Cook.<br>Serve.</p>", "Heat oil.\nCook.\nServe."),
    ("&lt;p&gt;Salt &amp;amp; pepper&nbsp;to taste.&lt;/p&gt;", "Salt & pepper to taste."),
    ("<ol><li>Mix.</li><li>Bake.</li></ol>", "Mix.\nBake."),
    ("<p>Cook<script>alert(1)</script><style>p{}</style>.</p>", "Cook."),
    ("Cook <b>slow</b>ly at 180°C.", "Cook slowly at 180°C."),
    ("Use < 5 g salt & pepper.\nCook > 10 minutes.", "Use < 5 g salt & pepper.\nCook > 10 minutes."),
    ("<p></p>", ""),
    ("<p>Stir <strong>well", "Stir well"),
])
def test_instruction_plain_text(raw: str, expected: str) -> None:
    assert instruction_text(raw) == expected
