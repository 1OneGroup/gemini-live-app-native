from automations.birthday import is_birthday_today, render_template

def test_birthday_today_match():
    assert is_birthday_today("04-14") is True   # run on 2026-04-14

def test_birthday_today_no_match():
    assert is_birthday_today("01-01") is False

def test_render_template_name():
    msg = render_template("Happy Birthday {name}!", name="Rahul")
    assert msg == "Happy Birthday Rahul!"

def test_render_template_default_when_empty():
    default = "Happy Birthday {name}! 🎂"
    msg = render_template("", name="Priya", _default=default)
    assert "Priya" in msg
