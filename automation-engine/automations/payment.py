from datetime import date

DEFAULT_TEMPLATE = "Hi {client_name}, this is a reminder that ₹{amount} (Invoice #{invoice}) is due on {due_date}. Please arrange payment. Thank you."
OVERDUE_TEMPLATE = "Hi {client_name}, your payment of ₹{amount} (Invoice #{invoice}) was due on {due_date} and is now overdue. Please contact us immediately."

def should_send_reminder(due_date: str, remind_days: list[int]) -> bool:
    """Return True if today is exactly X days before the due date, for any X in remind_days."""
    try:
        due = date.fromisoformat(due_date)
        days_left = (due - date.today()).days
        return days_left in remind_days
    except ValueError:
        return False

def get_status(due_date: str) -> str:
    """Return 'Overdue' if due date has passed, else 'Pending'."""
    try:
        due = date.fromisoformat(due_date)
        return "Overdue" if date.today() > due else "Pending"
    except ValueError:
        return "Pending"

def render_template(template: str, overdue: bool = False, **kwargs) -> str:
    default = OVERDUE_TEMPLATE if overdue else DEFAULT_TEMPLATE
    tmpl = template.strip() or default
    for key, val in kwargs.items():
        tmpl = tmpl.replace("{" + key + "}", str(val or ""))
    return tmpl
