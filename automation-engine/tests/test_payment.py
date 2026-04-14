from datetime import date, timedelta
from automations.payment import should_send_reminder, get_status

def test_reminder_7_days_before():
    due = (date.today() + timedelta(days=7)).strftime("%Y-%m-%d")
    assert should_send_reminder(due, remind_days=[7, 3, 1]) is True

def test_reminder_not_due():
    due = (date.today() + timedelta(days=10)).strftime("%Y-%m-%d")
    assert should_send_reminder(due, remind_days=[7, 3, 1]) is False

def test_status_overdue():
    past = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
    assert get_status(past) == "Overdue"

def test_status_pending():
    future = (date.today() + timedelta(days=5)).strftime("%Y-%m-%d")
    assert get_status(future) == "Pending"
