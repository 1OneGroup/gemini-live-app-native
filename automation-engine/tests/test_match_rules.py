from datetime import date, timedelta
from engine.match_rules import matches

def test_today_field_birthday_match():
    today_mmdd = date.today().strftime("%m-%d")
    rule = {"type": "today_field", "field": "birthday", "format": "MM-DD"}
    assert matches(rule, {"birthday": today_mmdd}) is True

def test_today_field_birthday_no_match():
    rule = {"type": "today_field", "field": "birthday", "format": "MM-DD"}
    assert matches(rule, {"birthday": "01-01"}) is False

def test_today_field_dd_mm_format():
    today = date.today().strftime("%d/%m")
    rule = {"type": "today_field", "field": "dob", "format": "DD/MM"}
    assert matches(rule, {"dob": today}) is True

def test_days_before_due_match():
    due = (date.today() + timedelta(days=7)).strftime("%Y-%m-%d")
    rule = {"type": "days_before", "field": "due_date", "days": [7, 3, 1]}
    assert matches(rule, {"due_date": due}) is True

def test_days_before_due_no_match():
    due = (date.today() + timedelta(days=10)).strftime("%Y-%m-%d")
    rule = {"type": "days_before", "field": "due_date", "days": [7, 3, 1]}
    assert matches(rule, {"due_date": due}) is False

def test_interval_followup_due():
    past = (date.today() - timedelta(days=10)).strftime("%Y-%m-%d")
    rule = {"type": "interval", "field": "last_contact", "days": 7}
    assert matches(rule, {"last_contact": past}) is True

def test_interval_followup_not_due():
    recent = (date.today() - timedelta(days=3)).strftime("%Y-%m-%d")
    rule = {"type": "interval", "field": "last_contact", "days": 7}
    assert matches(rule, {"last_contact": recent}) is False

def test_interval_empty_field():
    rule = {"type": "interval", "field": "last_contact", "days": 7}
    assert matches(rule, {"last_contact": ""}) is True
