from engine.data_sources import load_data

def test_unknown_source_returns_empty():
    assert load_data("fake-id", {"type": "unknown"}) == []
