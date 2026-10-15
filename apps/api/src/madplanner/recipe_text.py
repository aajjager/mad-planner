"""Convert publisher-provided instruction markup to readable plain text."""

import re
from html import unescape

from selectolax.parser import HTMLParser


def instruction_text(value: str) -> str:
    text = unescape(value)
    if re.search(r"</?[a-zA-Z][^>]*>", text):
        # Keep block boundaries without inserting spaces inside inline words.
        text = re.sub(r"</?(?:p|div|li|ul|ol|h[1-6]|blockquote)\b[^>]*>|<br\b[^>]*>", "\n", text, flags=re.I)
        document = HTMLParser(text)
        for node in document.css("script, style, iframe, object, template"):
            node.decompose()
        text = document.body.text() if document.body else document.text()
    return "\n".join(line for part in text.splitlines() if (line := " ".join(part.split())))
