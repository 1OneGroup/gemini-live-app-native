import os
import uuid
import base64
import requests
from db import get_setting

_MEDIA_DIR = os.path.join(os.path.dirname(__file__), "tmp_media")
os.makedirs(_MEDIA_DIR, exist_ok=True)

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
    payload = {"number": normalize_phone(phone), "text": message}
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=20)
        r.raise_for_status()
        data = r.json()
        if data.get("message") != "success" and data.get("error"):
            return {"ok": False, "error": data.get("error")}
        return {"ok": True, "data": data}
    except requests.RequestException as exc:
        return {"ok": False, "error": str(exc)}

def configure_webhook(instance: str, webhook_url: str) -> dict:
    """Register a webhook URL with Evolution GO for incoming messages on this instance.
    Evolution GO uses /instance/connect with a webhookUrl body field."""
    base = _evo_url()
    token = _get_instance_token(instance)
    url = f"{base}/instance/connect"
    payload = {
        "webhookUrl": webhook_url,
        "subscribe": ["MESSAGE"],
        "rabbitmqEnable": "",
        "websocketEnable": "",
        "natsEnable": "",
    }
    try:
        r = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json", "apikey": token},
            timeout=10,
        )
        return {"ok": r.ok, "status": r.status_code, "body": r.text[:300]}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def send_media(instance: str, phone: str, caption: str, image_url: str, mime: str = "image/png") -> dict:
    """Send an image via URL. image_url must be publicly accessible by Evolution GO."""
    base = _evo_url()
    token = _get_instance_token(instance)
    url = f"{base}/send/media"
    headers = {"Content-Type": "application/json", "apikey": token}
    payload = {
        "number": normalize_phone(phone),
        "type": "image",
        "caption": caption,
        "url": image_url,
    }
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=30)
        r.raise_for_status()
        return {"ok": True, "data": r.json()}
    except requests.RequestException as exc:
        return {"ok": False, "error": str(exc)}


def send_media_b64(instance: str, phone: str, caption: str, image_b64: str, ext: str = "png") -> dict:
    """Save base64 image to tmp_media, serve via Python server, send to WhatsApp."""
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(_MEDIA_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(base64.b64decode(image_b64))
    # Python server is at port 5001; Evolution GO (Docker) reaches host via host.docker.internal
    server_url = f"http://host.docker.internal:5001/media/{filename}"
    result = send_media(instance, phone, caption, server_url)
    # Clean up after send
    try:
        os.remove(filepath)
    except Exception:
        pass
    return result
