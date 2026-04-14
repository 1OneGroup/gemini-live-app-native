from datetime import date, timedelta

def _today_str(fmt: str) -> str:
    today = date.today()
    if fmt == "MM-DD":
        return today.strftime("%m-%d")
    if fmt == "DD/MM":
        return today.strftime("%d/%m")
    if fmt == "DD-MM":
        return today.strftime("%d-%m")
    return today.isoformat()

def matches(rule: dict, row: dict) -> bool:
    rtype = rule.get("type")

    if rtype == "today_field":
        field = rule.get("field", "")
        fmt = rule.get("format", "MM-DD")
        val = str(row.get(field, "")).strip()
        today = _today_str(fmt)
        # Match start of field value — handles "14/04/1990" matching "14/04"
        return val[:len(today)] == today

    if rtype == "days_before":
        field = rule.get("field", "")
        days_list = rule.get("days", [])
        val = str(row.get(field, "")).strip()
        try:
            target = date.fromisoformat(val)
            days_left = (target - date.today()).days
            return days_left in days_list
        except ValueError:
            return False

    if rtype == "interval":
        field = rule.get("field", "")
        interval = int(rule.get("days", 0))
        val = str(row.get(field, "")).strip()
        if not val:
            return True
        try:
            last = date.fromisoformat(val)
            return date.today() >= last + timedelta(days=interval)
        except ValueError:
            return True

    return False
