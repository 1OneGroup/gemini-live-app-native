from datetime import date, timedelta

DEFAULT_TEMPLATE = "Hi {vendor_name}, just checking in regarding our business with {company}. Please let us know if you need anything."

def is_followup_due(last_contact: str, interval_days: int) -> bool:
    """Return True if today >= last_contact + interval_days, or last_contact is empty."""
    if not last_contact:
        return True
    try:
        last = date.fromisoformat(last_contact)
        return date.today() >= last + timedelta(days=interval_days)
    except ValueError:
        return True

def render_template(template: str, _default: str = DEFAULT_TEMPLATE, **kwargs) -> str:
    tmpl = template.strip() or _default
    for key, val in kwargs.items():
        tmpl = tmpl.replace("{" + key + "}", str(val or ""))
    return tmpl
