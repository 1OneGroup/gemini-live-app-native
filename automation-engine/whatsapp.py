import os
import requests
from db import get_setting

def _evo_url():
    return os.getenv("EVOLUTION_API_URL") or get_setting("evolution_api_url") or "http://localhost:5000"

def _evo_key():
    return os.getenv("EVOLUTION_API_KEY") or get_setting("evolution_api_key", "")

_instance_token_cache: dict = {}

def _get_instance_token(instance: str) -> str:
    """Get per-instance token from Evolution GO using global API key."""
    if instance in _instance_token_cache:
        return _instance_token_cache[instance]
    base = _evo_url()
    key = _evo_key()
    try:
        r = requests.get(f"{base}/instance/all", headers={"apikey": key}, timeout=10)
        instances = r.json().get("data", [])
        for inst in instances:
            tok = inst.get("token", "")
            name = inst.get("name", "")
            if tok:
                _instance_token_cache[name] = tok
        return _instance_token_cache.get(instance, key)
    except Exception:
        return key

def normalize_phone(phone: str) -> str:
    number = "".join(c for c in str(phone) if c.isdigit())
    if number.startswith("0"):
        number = "91" + number[1:]
    if not number.startswith("91") and len(number) == 10:
        number = "91" + number
    return number

def send_text(instance: str, phone: str, message: str) -> dict:
    base = _evo_url()
    token = _get_instance_token(instance)
    url = f"{base}/send/text"
    headers = {"Content-Type": "application/json", "apikey": token}
    payload = {"id": instance, "number": normalize_phone(phone), "text": message}
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=20)
        r.raise_for_status()
        return {"ok": True, "data": r.json()}
    except requests.RequestException as exc:
        return {"ok": False, "error": str(exc)}

def send_media(instance: str, phone: str, caption: str, image_base64: str, mime: str = "image/png") -> dict:
    base = _evo_url()
    token = _get_instance_token(instance)
    url = f"{base}/send/media"
    headers = {"Content-Type": "application/json", "apikey": token}
    payload = {
        "id": instance,
        "number": normalize_phone(phone),
        "mediatype": "image",
        "mimetype": mime,
        "caption": caption,
        "media": image_base64,
        "fileName": "image.png",
    }
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=30)
        r.raise_for_status()
        return {"ok": True, "data": r.json()}
    except requests.RequestException as exc:
        return {"ok": False, "error": str(exc)}
