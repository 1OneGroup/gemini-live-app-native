from datetime import date

DEFAULT_TEMPLATE = "Happy Birthday {name}! 🎂 Wishing you a wonderful day!"

def is_birthday_today(birthday_mmdd: str) -> bool:
    """Check if MM-DD matches today's date."""
    today = date.today()
    today_mmdd = today.strftime("%m-%d")
    return birthday_mmdd.strip() == today_mmdd

def render_template(template: str, _default: str = DEFAULT_TEMPLATE, **kwargs) -> str:
    """Replace {name}, {company} etc. in template. Falls back to default if blank."""
    tmpl = template.strip() or _default
    for key, val in kwargs.items():
        tmpl = tmpl.replace("{" + key + "}", str(val or ""))
    return tmpl
