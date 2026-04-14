import base64
import requests
from db import get_setting

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent"

def fetch_template_image(url: str) -> tuple[str, str]:
    """Download image from URL, return (base64, mime)."""
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    mime = r.headers.get("Content-Type", "image/jpeg")
    return base64.b64encode(r.content).decode("ascii"), mime

def personalize_image(template_url: str, prompt: str) -> tuple[str, str] | None:
    """Send template image + prompt to Gemini, return (base64, mime) of personalized image."""
    api_key = get_setting("gemini_api_key", "")
    if not api_key:
        return None
    try:
        b64, mime = fetch_template_image(template_url)
    except Exception:
        return None

    payload = {
        "contents": [{
            "parts": [
                {"inlineData": {"mimeType": mime, "data": b64}},
                {"text": prompt},
            ]
        }],
        "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]}
    }
    try:
        r = requests.post(f"{GEMINI_URL}?key={api_key}", json=payload, timeout=60)
        r.raise_for_status()
        data = r.json()
        for cand in data.get("candidates", []):
            for part in cand.get("content", {}).get("parts", []):
                if "inlineData" in part:
                    return part["inlineData"]["data"], part["inlineData"].get("mimeType", "image/png")
    except Exception:
        return None
    return None
