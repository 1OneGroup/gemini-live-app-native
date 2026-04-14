import re

def render(template: str, data: dict) -> str:
    """Replace {field} placeholders with values from data dict. Missing fields → empty string."""
    if not template:
        return ""
    def repl(match):
        key = match.group(1).strip()
        return str(data.get(key, ""))
    return re.sub(r"\{([^{}]+)\}", repl, template)
