from engine.template import render

def test_render_simple():
    assert render("Hi {name}", {"name": "Rahul"}) == "Hi Rahul"

def test_render_multiple_vars():
    assert render("{name} from {company}", {"name": "Ramesh", "company": "ABC"}) == "Ramesh from ABC"

def test_render_missing_var_blank():
    assert render("Hi {name}, {extra}", {"name": "Priya"}) == "Hi Priya, "

def test_render_no_vars():
    assert render("Static text", {"name": "X"}) == "Static text"

def test_render_empty_template():
    assert render("", {"name": "X"}) == ""
