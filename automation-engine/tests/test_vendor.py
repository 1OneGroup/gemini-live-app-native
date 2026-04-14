from datetime import date, timedelta
from automations.vendor import is_followup_due, render_template

def test_followup_due_today():
    past = (date.today() - timedelta(days=7)).strftime("%Y-%m-%d")
    assert is_followup_due(past, interval_days=7) is True

def test_followup_not_due_yet():
    recent = (date.today() - timedelta(days=3)).strftime("%Y-%m-%d")
    assert is_followup_due(recent, interval_days=7) is False

def test_followup_overdue():
    old = (date.today() - timedelta(days=14)).strftime("%Y-%m-%d")
    assert is_followup_due(old, interval_days=7) is True

def test_followup_empty_last_contact():
    assert is_followup_due("", interval_days=7) is True

def test_render_vendor_template():
    msg = render_template("Hi {vendor_name} from {company}", vendor_name="Ramesh", company="ABC")
    assert msg == "Hi Ramesh from ABC"
