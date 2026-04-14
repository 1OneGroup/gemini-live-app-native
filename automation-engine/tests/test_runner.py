from engine.runner import run_automation

def test_run_nonexistent_automation():
    result = run_automation("00000000-0000-0000-0000-000000000000")
    assert result["ok"] is False
