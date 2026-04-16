import io
import re
import traceback
import json
import requests
from datetime import date, datetime
from db import get_automation, log_activity, mark_data_processed
from engine.data_sources import load_data
from engine.match_rules import matches
from engine.template import render
from whatsapp import send_text, send_media
from gemini_image import personalize_image

_GPT_MODELS = {"gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"}

_BIRTHDAY_IMAGE_PROMPT = (
    "Create a professional corporate birthday greeting card image. "
    "Portrait/vertical orientation (mobile screen size). "
    "Color scheme: dark maroon/red background with gold accents. "
    "Layout top to bottom: "
    "1) 'ONE GROUP' in white bold text at top, below it 'THE ONE YOU CAN TRUST' in small white text "
    "2) Thin gold horizontal divider line "
    "3) 'WISHES A VERY' in white small caps "
    "4) 'HAPPY' in large white bold text "
    "5) 'Birthday' in large cursive gold script font "
    "6) Gold ribbon/banner with the name '{name}' prominently in center "
    "7) Beautiful red birthday cake with lit golden candles "
    "8) 'Wishing you ONE more year of success and growth' in white italic text at bottom. "
    "Elegant, professional corporate birthday card style."
)


def _send_static_birthday_card(instance: str, phone: str, caption: str, name: str) -> dict:
    """Add employee name to static birthday template using Pillow and send via WhatsApp."""
    import uuid as _uuid
    import base64 as _b64
    import os as _os
    import io as _io
    from PIL import Image, ImageDraw, ImageFont
    from whatsapp import send_media as _send_media

    try:
        template_path = _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), "birthday_template.png")
        img = Image.open(template_path).convert("RGBA")
        draw = ImageDraw.Draw(img)
        w, h = img.size

        # Ribbon exact bounds (detected from template scan)
        RIBBON_CY = 535   # center Y of ribbon
        MAX_W     = 480   # max text width — stays inside ribbon sides
        MAX_H     = 44    # max text height — stays inside ribbon height

        # Bundled font (works on Windows, Linux, Docker)
        _base = _os.path.dirname(_os.path.dirname(__file__))
        font_path = _os.path.join(_base, "fonts", "Calistoga-Regular.ttf")
        if not _os.path.exists(font_path):
            # Windows fallback
            for _wf in ["C:/Windows/Fonts/CALISTB.TTF", "C:/Windows/Fonts/calibrib.ttf"]:
                if _os.path.exists(_wf):
                    font_path = _wf
                    break

        font_size = 52
        font = ImageFont.truetype(font_path, font_size)
        while font_size > 16:
            bbox = draw.textbbox((0, 0), name, font=font)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
            if tw <= MAX_W and th <= MAX_H:
                break
            font_size -= 2
            font = ImageFont.truetype(font_path, font_size)

        bbox = draw.textbbox((0, 0), name, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x = (w - tw) // 2
        y = RIBBON_CY - th // 2 - bbox[1]
        draw.text((x + 2, y + 2), name, font=font, fill=(60, 20, 5, 160))
        draw.text((x, y), name, font=font, fill=(80, 18, 8, 255))

        out = _io.BytesIO()
        img.convert("RGB").save(out, format="PNG")
        img_b64 = _b64.b64encode(out.getvalue()).decode("utf-8")

        # Save to tmp_media and serve
        _media_dir = _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), "tmp_media")
        _os.makedirs(_media_dir, exist_ok=True)
        filename = f"{_uuid.uuid4().hex}.png"
        filepath = _os.path.join(_media_dir, filename)
        with open(filepath, "wb") as f:
            f.write(_b64.b64decode(img_b64))

        image_url = f"http://host.docker.internal:5001/media/{filename}"
        result = _send_media(instance, phone, caption, image_url)
        try:
            _os.remove(filepath)
        except Exception:
            pass
        return result

    except Exception as exc:
        from whatsapp import send_text as _send_text
        return _send_text(instance, phone, caption)


def _send_gemini_image(auto: dict, instance: str, phone: str, caption: str, row: dict, name_or_prompt: str) -> dict:
    """Generate an image with Gemini and send it via WhatsApp.
    name_or_prompt: if it looks like a full prompt (>80 chars), use as-is; else treat as a name for the birthday card prompt.
    """
    import uuid as _uuid
    import base64 as _b64
    import os as _os
    from whatsapp import send_media as _send_media

    try:
        import db as _db
        api_key = (auto.get("gemini_key") or "").strip() or _db.get_setting("gemini_api_key", "")
        if not api_key:
            raise ValueError("No Gemini API key")

        if len(name_or_prompt) > 80:
            prompt = name_or_prompt   # full custom prompt passed by user code
        else:
            prompt = _BIRTHDAY_IMAGE_PROMPT.replace("{name}", name_or_prompt or "")
        gemini_url = (
            f"https://generativelanguage.googleapis.com/v1beta/"
            f"models/gemini-2.5-flash-image:generateContent?key={api_key}"
        )
        resp = requests.post(
            gemini_url,
            json={"contents": [{"parts": [{"text": prompt}]}],
                  "generationConfig": {"responseModalities": ["IMAGE"]}},
            timeout=90,
        )
        resp.raise_for_status()
        parts = resp.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])
        img_b64 = next((p["inlineData"]["data"] for p in parts if "inlineData" in p), None)
        if not img_b64:
            raise ValueError("Gemini returned no image")

        # Save image to tmp_media so Python server can serve it
        _media_dir = _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), "tmp_media")
        _os.makedirs(_media_dir, exist_ok=True)
        filename = f"{_uuid.uuid4().hex}.png"
        filepath = _os.path.join(_media_dir, filename)
        with open(filepath, "wb") as f:
            f.write(_b64.b64decode(img_b64))

        # Evolution GO (Docker) reaches host Python server via host.docker.internal
        image_url = f"http://host.docker.internal:5001/media/{filename}"
        result = _send_media(instance, phone, caption, image_url)

        try:
            _os.remove(filepath)
        except Exception:
            pass
        return result

    except Exception as exc:
        # Fallback: send text only
        from whatsapp import send_text as _send_text
        return _send_text(instance, phone, caption)

_GEMINI_SYSTEM_INSTRUCTION = (
    "You are a messaging assistant. Always output ONLY the final message text "
    "\u2014 no options, no alternatives, no labels, no explanations, no markdown. "
    "Just the raw message."
)


def make_gemini_fn(api_key: str, default_model: str):
    """Module-level factory so reply_classifier and message_builder can reuse."""
    import db as _db

    def _gemini(prompt: str, model: str = None) -> str:
        use_model = model or default_model
        if use_model in _GPT_MODELS:
            oai_key = _db.get_setting("openai_api_key", "")
            if not oai_key:
                raise ValueError("No OpenAI API key configured. Set it in Settings.")
            resp = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {oai_key}",
                         "Content-Type": "application/json"},
                json={"model": use_model,
                      "messages": [{"role": "user", "content": prompt}],
                      "temperature": 0.2},
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
        if not api_key:
            raise ValueError("No Gemini API key configured. Set it in Settings.")
        url = (f"https://generativelanguage.googleapis.com/v1beta/"
               f"models/{use_model}:generateContent?key={api_key}")
        payload = {
            "system_instruction": {"parts": [{"text": _GEMINI_SYSTEM_INSTRUCTION}]},
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.4},
        }
        resp = requests.post(url, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()

    return _gemini


def _strip_ai_artifacts(text: str) -> str:
    """Remove markdown bold/italic, accidental greetings, trailing whitespace."""
    if not text:
        return ""
    text = text.replace("**", "").replace("__", "").replace("##", "").strip()
    # Strip accidental "Hi Name," / "Dear Name," / "Hello Name," openers
    text = re.sub(r"^(Hi|Hello|Dear)\s+\S+[,.]?\s*", "", text, flags=re.IGNORECASE).strip()
    return text


def _make_build_followup_fn(auto: dict, gemini_fn):
    """Returns a helper user code can call: build_followup_message(row) -> str."""
    from engine.message_builder import build_prompt
    from datetime import date as _date

    def _build(row: dict) -> str:
        vendor_name = (row.get("vendor_name") or row.get("name")
                       or row.get("Vendor Name") or "Vendor")
        reason = (row.get("follow-up_reason") or row.get("reason")
                  or row.get("Follow-up Reason") or "")
        urgency = (row.get("urgency") or row.get("Urgency") or "Medium")
        reminder_count = int(row.get("_reminder_count", 0) or 0)
        sent_history = row.get("_sent_history") or []
        reply_history = row.get("_reply_history") or []
        promise_history = row.get("_promise_history") or []

        prompt, tier_label = build_prompt(
            vendor_name, reason, urgency, reminder_count,
            sent_history, reply_history, promise_history,
        )

        ai_body = gemini_fn(prompt)
        ai_body = _strip_ai_artifacts(ai_body)

        today = _date.today().strftime("%d %b %Y")
        wa_message = (
            f"{tier_label}  |  _{today}_\n"
            f"\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n"
            f"Dear *{vendor_name}*,\n\n"
            f"{ai_body}\n\n"
            f"\U0001F4CB *Details*\n"
            f"\u2022 *Subject:* {reason}\n"
            f"\u2022 *Priority:* {urgency}\n"
            f"\u2022 *Date:* {today}\n\n"
            f"Please acknowledge this message at your earliest convenience.\n\n"
            f"Thank you for your cooperation.\n\n"
            f"_Best Regards,_\n"
            f"*Team ONE Group*"
        )
        return wa_message

    return _build


def _enrich_row(row_dict: dict) -> dict:
    """Merge automation_data row with reply-tracking state fields accessible via row['_xxx']."""
    if not row_dict:
        return row_dict
    data = row_dict.get("data") or {}
    enriched = dict(data)
    enriched["_id"] = row_dict.get("id")
    enriched["_status"] = row_dict.get("status", "pending")
    enriched["_reminder_count"] = row_dict.get("reminder_count", 0) or 0
    enriched["_reply_text"] = row_dict.get("reply_text", "") or ""
    enriched["_sent_history"] = row_dict.get("sent_message_history") or []
    enriched["_reply_history"] = row_dict.get("reply_history") or []
    enriched["_promise_history"] = row_dict.get("promise_history") or []
    enriched["_last_processed"] = row_dict.get("last_processed", "") or ""
    return enriched


def run_code_automation_for_rows(auto: dict, rows: list) -> dict:
    """Execute code automation on a specific list of rows (not all DB rows)."""
    return _exec_code_with_rows(auto, rows)


def run_code_automation(auto: dict) -> dict:
    """Execute a code-based automation. Loads all unprocessed rows from DB."""
    automation_id = auto["id"]
    code = auto.get("code", "").strip()
    if not code:
        return {"ok": False, "reason": "no code defined"}

    from engine.data_sources import load_data as _load_data
    today_marker = date.today().isoformat()
    all_rows = _load_data(automation_id, auto.get("data_source", {}))
    # Skip rows already processed TODAY — not rows processed ever (so yearly repeats work)
    rows = [r for r in all_rows if r.get("_last_processed") != today_marker]
    if not rows:
        return {"ok": True, "stdout": "", "skipped": len(all_rows)}
    result = _exec_code_with_rows(auto, rows)
    # Mark rows with today's date so same-day duplicate sends are prevented.
    # Using today's ISO date (not "sent") so the row re-enters next time the date changes.
    if result.get("ok"):
        import db as _db
        for r in rows:
            rid = r.get("_id")
            if not rid:
                continue
            row_check = None
            with _db._conn() as _c:
                row_check = _c.execute(
                    "SELECT status FROM automation_data WHERE id=?", (rid,)
                ).fetchone()
            if row_check and row_check["status"] == "pending":
                _db.mark_data_processed(rid, today_marker)
    return result


def _exec_code_with_rows(auto: dict, rows: list) -> dict:
    automation_id = auto["id"]
    code = auto.get("code", "").strip()
    if not code:
        return {"ok": False, "reason": "no code defined"}

    captured = io.StringIO()
    import db as _db

    # Resolve Gemini creds
    global_gemini_key = _db.get_setting("gemini_api_key", "")
    automation_gemini_key = (auto.get("gemini_key") or "").strip()
    active_gemini_key = automation_gemini_key or global_gemini_key
    active_gemini_model = (auto.get("gemini_model") or "").strip() or "gemini-2.5-flash"
    gemini_fn = make_gemini_fn(active_gemini_key, active_gemini_model)

    # Enrich rows so user code and helpers see _status / _reminder_count / history
    enriched_rows = []
    for r in rows:
        # Two possible shapes: (a) already-enriched row dict from runner callers,
        # (b) raw automation_data row with 'data' + tracking fields.
        if "_id" in r and "_status" in r:
            enriched_rows.append(r)
        elif "data" in r and isinstance(r["data"], dict):
            enriched_rows.append(_enrich_row(r))
        else:
            # Plain dict from submit-form path: wrap minimally
            enriched_rows.append(dict(r))

    def _send_whatsapp(phone, message):
        """Legacy untracked send — backwards compatible with existing automations."""
        instance = auto.get("whatsapp_instance", "")
        result = send_text(instance, phone, message)
        status = "sent" if result.get("ok") else "failed"
        log_activity(automation_id, auto["name"], "", phone, message, False, status,
                     error=result.get("error", ""))
        return result

    def _send_followup(row, message):
        """Tracked send — updates row status, reminder_count, next_reminder_at."""
        instance = auto.get("whatsapp_instance", "")
        phone_raw = (row.get("phone") or row.get("mobile") or row.get("whatsapp")
                     or row.get("phone_number") or row.get("Phone Number") or "")
        phone = str(phone_raw)
        result = send_text(instance, phone, message)
        status = "sent" if result.get("ok") else "failed"
        log_activity(automation_id, auto["name"],
                     row.get("vendor_name", ""), phone, message,
                     False, status, error=result.get("error", ""))
        if result.get("ok") and row.get("_id"):
            urgency = (row.get("urgency") or row.get("Urgency") or "medium")
            _db.mark_sent(row["_id"], message, urgency, phone)
        return result

    def _log(message):
        log_activity(automation_id, auto["name"], "", "", str(message), False, "info")

    def _generate_and_send_image(phone, caption, name):
        """Add name to static birthday card template and send via WhatsApp."""
        return _send_static_birthday_card(
            auto.get("whatsapp_instance", ""), phone, caption, name
        )

    context = {
        "data": enriched_rows,
        "send_whatsapp": _send_whatsapp,
        "send_followup": _send_followup,
        "build_followup_message": _make_build_followup_fn(auto, gemini_fn),
        "generate_and_send_image": _generate_and_send_image,
        "log": _log,
        "requests": requests,
        "datetime": datetime,
        "re": re,
        "json": json,
        "gemini_key": active_gemini_key,
        "gemini_model": active_gemini_model,
        "gemini": gemini_fn,
        "print": lambda *a, **kw: print(*a, **kw, file=captured),
    }

    try:
        exec(code, context)
        stdout_val = captured.getvalue()
        if stdout_val:
            log_activity(automation_id, auto["name"], "", "", "[stdout]", False,
                         "info", stdout=stdout_val)
        return {"ok": True, "stdout": stdout_val}
    except Exception:
        tb = traceback.format_exc()
        stdout_val = captured.getvalue()
        log_activity(automation_id, auto["name"], "", "", "[error]", False,
                     "error", error=tb, stdout=stdout_val)
        return {"ok": False, "reason": tb, "stdout": stdout_val}


def run_automation(automation_id: str) -> dict:
    """Execute an automation. Routes to code-based or config-based runner."""
    try:
        auto = get_automation(automation_id)
    except Exception as exc:
        return {"ok": False, "reason": str(exc)}

    if not auto or not auto.get("enabled"):
        return {"ok": False, "reason": "disabled or not found"}

    if auto.get("code", "").strip():
        return run_code_automation(auto)

    rows = load_data(automation_id, auto.get("data_source", {}))
    rule = auto.get("match_rule", {})
    template = auto.get("message_template", "")
    instance = auto.get("whatsapp_instance", "")
    use_image = auto.get("use_image", False)
    img_url = auto.get("image_template_url", "")
    img_prompt_tmpl = auto.get("image_prompt", "")
    today_marker = date.today().isoformat()

    sent, failed, skipped = 0, 0, 0
    for row in rows:
        if row.get("_last_processed") == today_marker:
            skipped += 1
            continue
        if not matches(rule, row):
            continue

        message = render(template, row)
        phone = (row.get("phone") or row.get("mobile") or row.get("whatsapp")
                 or row.get("mobile_no.") or row.get("mobile_no") or row.get("contact") or "")
        name = (row.get("name") or row.get("employee_name") or row.get("client_name")
                or row.get("vendor_name") or row.get("customer_name") or "")

        if use_image:
            send_result = _send_static_birthday_card(instance, phone, message, name)
        else:
            send_result = send_text(instance, phone, message)

        status = "sent" if send_result.get("ok") else "failed"
        error = send_result.get("error", "")
        log_activity(automation_id, auto["name"], name, phone, message,
                     image_sent=use_image, status=status, error=error)

        if send_result.get("ok"):
            sent += 1
            if row.get("_id"):
                mark_data_processed(row["_id"], today_marker)
        else:
            failed += 1

    return {"ok": True, "sent": sent, "failed": failed, "skipped": skipped}
