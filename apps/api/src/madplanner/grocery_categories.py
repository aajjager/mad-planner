import re


_CATEGORY_KEYWORDS = {
    "Household": ("soap", "sæbe", "toilet", "clean", "rengøring", "tablet", "detergent", "vaskemiddel"),
    "Produce": ("tomat", "tomato", "banana", "banan", "apple", "æble", "avocado", "agurk", "cucumber", "broccoli", "onion", "løg", "potato", "kartoffel", "salad", "salat", "lemon", "citron", "carrot", "gulerod"),
    "Meat & fish": ("chicken", "kylling", "beef", "oksekød", "pork", "svinekød", "fish", "fisk", "salmon", "laks", "ham", "skinke"),
    "Dairy & eggs": ("milk", "mælk", "cheese", "ost", "cream", "fløde", "butter", "smør", "egg", "æg", "yogurt", "yoghurt"),
    "Bakery": ("bread", "brød", "bun", "bolle", "tortilla"),
    "Pantry": ("pasta", "rice", "ris", "flour", "mel", "sugar", "sukker", "oil", "olie", "salt", "pepper", "peber", "can", "dåse"),
    "Frozen": ("frozen", "frossen", "ice cream"),
}


def categorize_grocery_item(name: str) -> str:
    normalized = " ".join(name.casefold().split())
    for category, keywords in _CATEGORY_KEYWORDS.items():
        if any(re.search(rf"(^|\W){re.escape(keyword)}", normalized) for keyword in keywords):
            return category
    return "Other"
