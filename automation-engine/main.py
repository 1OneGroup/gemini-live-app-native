import os
import io
import json
import uuid as _uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

_MEDIA_DIR = os.path.join(os.path.dirname(__file__), "tmp_media")
os.makedirs(_MEDIA_DIR, exist_ok=True)
from datetime import date, timedelta
import pandas as pd

import db
from scheduler import start_scheduler, reload_jobs
from engine.runner import run_automation
from vendor_gemini import generate_vendor_messages

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield

app = FastAPI(title="WhatsApp Automation Platform", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8100", "http://127.0.0.1:8100"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Automation Models ─────────────────────────────────────────────────────────
class AutomationIn(BaseModel):
    name: str
    description: str = ""
    enabled: bool = False
    data_source: dict = {}
    match_rule: dict = {}
    use_image: bool = False
    image_template_url: str = ""
    image_prompt: str = ""
    message_template: str = ""
    whatsapp_instance: str = ""
    schedule: dict = {"type": "daily", "time": "09:00"}
    code: str = ""
    schedule_cron: str = "0 9 * * *"
    gemini_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    form_schema: Optional[str] = None

# ── Automation CRUD ───────────────────────────────────────────────────────────
@app.get("/api/automations")
def list_all():
    return db.list_automations()

@app.get("/api/automations/{aid}")
def get_one(aid: str):
    auto = db.get_automation(aid)
    if not auto:
        raise HTTPException(404, "Not found")
    return auto

@app.post("/api/automations", status_code=201)
def create(body: AutomationIn):
    auto = db.create_automation(body.model_dump())
    reload_jobs()
    return auto

@app.put("/api/automations/{aid}")
def update(aid: str, body: AutomationIn):
    auto = db.update_automation(aid, body.model_dump())
    reload_jobs()
    return auto

@app.delete("/api/automations/{aid}")
def remove(aid: str):
    db.delete_automation(aid)
    reload_jobs()
    return {"ok": True}

@app.post("/api/automations/{aid}/run")
def run_now(aid: str):
    return run_automation(aid)

@app.post("/api/automations/{aid}/submit-form")
def submit_form(aid: str, body: dict = Body(...)):
    """Add a form submission and run automation ONLY for this new row."""
    row = db.add_data(aid, body)
    auto = db.get_automation(aid)
    result = {"ok": True, "row": row}
    if auto and auto.get("enabled"):
        from engine.runner import run_code_automation_for_rows, _enrich_row
        # Re-fetch the full DB row so tracking fields (id, status, history) are present
        with db._conn() as _c:
            _c.row_factory = __import__("sqlite3").Row
            full_row = _c.execute(
                "SELECT * FROM automation_data WHERE id=?", (row["id"],)
            ).fetchone()
        enriched = _enrich_row(db._row_to_dict(full_row))
        run_result = run_code_automation_for_rows(auto, [enriched])
        result["run"] = run_result
    return result

@app.get("/api/automations/{aid}/logs")
def get_logs(aid: str):
    return db.list_activity_for_automation(aid, limit=50)

def _send_instant_ack(row, auto, phone: str, vendor_reply: str, verdict: str, deadline_iso):
    """Send an instant Gemini-generated acknowledgment back to the vendor."""
    try:
        from whatsapp import send_text as _send_text
        from engine.runner import make_gemini_fn

        instance = (auto or {}).get("whatsapp_instance", "")
        if not instance or not phone:
            return

        row_data = row.get("data") or {}
        vendor_name = (row_data.get("vendor_name") or row_data.get("Vendor Name") or "there")
        reason = (row_data.get("follow-up_reason") or row_data.get("Follow-up Reason")
                  or row_data.get("reason") or "the pending task")
        gemini_key = db.get_setting("gemini_api_key", "")
        gemini_model = (auto or {}).get("gemini_model") or "gemini-2.5-flash"

        if verdict == "opted_out":
            ack_msg = "Understood. We have removed you from our follow-up list. No further messages will be sent. Thank you."

        elif verdict == "replied_ok":
            prompt = (
                "You are replying on behalf of a business to a vendor who just confirmed completing a task.\n\n"
                f"Vendor name: {vendor_name}\n"
                f"Follow-up topic: {reason}\n"
                f"Vendor's message: \"{vendor_reply}\"\n\n"
                "Write a SHORT warm thank-you reply (2-3 sentences). "
                "Reference exactly what they said — be specific, not generic. "
                "Confirm it's noted and no more reminders will come. "
                "Match their language (Hinglish if they wrote Hinglish, English if English). "
                "Plain text only. No 'Hi/Dear' prefix."
            )
            try:
                ack_msg = make_gemini_fn(gemini_key, gemini_model)(prompt).strip() or None
            except Exception:
                ack_msg = None
            if not ack_msg:
                ack_msg = f"Thank you {vendor_name}! Your confirmation has been noted. No further follow-ups will be sent. ✅"

        elif verdict == "replied_deferred":
            from datetime import datetime as _dt2
            try:
                dl = _dt2.fromisoformat(deadline_iso).strftime("%d %b %Y, %I:%M %p") if deadline_iso else "your committed time"
            except Exception:
                dl = deadline_iso or "your committed time"
            prompt = (
                "You are replying on behalf of a business to a vendor who just promised to complete a task by a specific time.\n\n"
                f"Vendor name: {vendor_name}\n"
                f"Follow-up topic: {reason}\n"
                f"Vendor's message: \"{vendor_reply}\"\n"
                f"Their committed deadline: {dl}\n\n"
                "Write a SHORT reply (2 sentences). Acknowledge their commitment by referencing their exact words. "
                "Confirm you'll follow up at that time if not heard from them. "
                "Match their language (Hinglish/English). Plain text only. No 'Hi/Dear' prefix."
            )
            try:
                ack_msg = make_gemini_fn(gemini_key, gemini_model)(prompt).strip() or None
            except Exception:
                ack_msg = None
            if not ack_msg:
                ack_msg = f"Got it {vendor_name}! We've noted your commitment. We'll follow up by {dl} if we don't hear from you. 🙏"

        else:  # replied_insufficient
            prompt = (
                "You are replying on behalf of a business to a vendor who replied to a follow-up but didn't give a clear commitment.\n\n"
                f"Vendor name: {vendor_name}\n"
                f"Follow-up topic: {reason}\n"
                f"Vendor's message: \"{vendor_reply}\"\n\n"
                "Write a SHORT reply (2-3 sentences). "
                "Acknowledge what they said. Politely ask for a specific update or confirmation — "
                "when exactly will it be done? Keep it friendly but firm. "
                "Match their language (Hinglish/English). Plain text only. No 'Hi/Dear' prefix."
            )
            try:
                ack_msg = make_gemini_fn(gemini_key, gemini_model)(prompt).strip() or None
            except Exception:
                ack_msg = None
            if not ack_msg:
                ack_msg = f"Thanks for the update {vendor_name}! Could you please share a specific timeline for when this will be done? 🙏"

        result = _send_text(instance, phone, ack_msg)
        # Log the ack to activity log so it appears in dashboard
        auto_id = (auto or {}).get("id", "")
        auto_name = (auto or {}).get("name", "")
        row_data = row.get("data") or {}
        vendor_name = row_data.get("vendor_name") or row_data.get("Vendor Name") or ""
        db.log_activity(
            automation_id=auto_id,
            automation_name=auto_name,
            recipient_name=vendor_name,
            recipient_phone=phone,
            message_sent=f"[AUTO-REPLY] {ack_msg}",
            status="sent" if result.get("ok") else "failed",
            error=result.get("error", ""),
        )
    except Exception as _e:
        # Log the failure so we can debug
        try:
            db.log_activity(
                automation_id=(auto or {}).get("id", ""),
                automation_name=(auto or {}).get("name", ""),
                recipient_name="",
                recipient_phone=phone,
                message_sent="[AUTO-REPLY FAILED]",
                status="error",
                error=str(_e),
            )
        except Exception:
            pass


# ── Incoming WhatsApp reply webhook (Evolution GO → us) ──────────────────────
@app.post("/api/wa-webhook")
async def wa_webhook(req: Request):
    """Receive incoming WhatsApp messages from Evolution GO, match to a
    tracked follow-up row, and update its conversation state."""
    try:
        payload = await req.json()
    except Exception:
        return {"ok": False, "reason": "invalid_json"}

    # Log the raw payload so we can debug shape variations
    try:
        import json as _json
        with open("/tmp/wa_webhook_debug.log", "a") as _f:
            _f.write(_json.dumps(payload)[:2000] + "\n---\n")
    except Exception:
        try:
            with open("wa_webhook_debug.log", "a") as _f:
                import json as _json2
                _f.write(_json2.dumps(payload)[:2000] + "\n---\n")
        except Exception:
            pass

    # Evolution GO wraps the Baileys payload under various keys depending on version.
    # Support both {data: {...}} and top-level shapes.
    data = payload.get("data") or payload
    if isinstance(data, list):
        data = data[0] if data else {}

    # Evolution GO payload uses Info/Message keys (capitalized, from Go structs)
    info = data.get("Info") or data.get("info") or {}
    message_obj = data.get("Message") or data.get("message") or {}
    key = data.get("key") or {}

    # fromMe check from both shapes
    is_from_me = info.get("IsFromMe") if "IsFromMe" in info else key.get("fromMe", False)
    if is_from_me:
        return {"ok": True, "ignored": "fromMe"}

    # Sender JID: try Info.Sender, Info.Chat, key.remoteJid
    raw_jid = (info.get("Sender") or info.get("Chat")
               or key.get("remoteJid") or "")
    phone = db.normalize_phone(raw_jid)

    # Message text: Baileys has multiple shapes
    text = ""
    if isinstance(message_obj, dict):
        # Baileys: conversation / extendedTextMessage.text
        text = (message_obj.get("conversation")
                or (message_obj.get("extendedTextMessage") or {}).get("text")
                or "")
    if not text and isinstance(data.get("message"), dict):
        m2 = data["message"]
        text = (m2.get("conversation")
                or (m2.get("extendedTextMessage") or {}).get("text") or "")
    text = (text or "").strip()

    if not phone or not text:
        return {"ok": True, "ignored": "empty", "phone": phone, "text_len": len(text)}

    row = db.find_awaiting_row_by_phone(phone)
    if not row:
        return {"ok": True, "ignored": "no_match", "phone": phone}

    from engine.reply_classifier import is_optout, classify_reply, extract_deadline
    from datetime import datetime as _dt, timezone as _tz, timedelta as _td

    # 1. Opt-out takes absolute priority
    if is_optout(text):
        db.mark_reply_received(row["id"], text, "opted_out")
        _send_instant_ack(row, auto, phone, text, "opted_out", None)
        return {"ok": True, "status": "opted_out"}

    auto = db.get_automation(row["automation_id"])

    # 2. Deadline extraction — if vendor promised a specific time, save it
    now_ist = (_dt.now(_tz.utc) + _td(hours=5, minutes=30)).strftime("%Y-%m-%dT%H:%M:%S")
    deadline_info = extract_deadline(auto, text, now_ist)

    if deadline_info.get("has_deadline"):
        db.mark_reply_received(
            row["id"], text, "replied_deferred",
            promised_deadline=deadline_info["deadline_iso"],
            promised_text=deadline_info["raw_text"],
        )
        _send_instant_ack(row, auto, phone, text, "replied_deferred", deadline_info["deadline_iso"])
        return {"ok": True, "status": "replied_deferred",
                "deadline": deadline_info["deadline_iso"]}

    # 3. Short-reply guard (≤3 words → always insufficient)
    if len(text.split()) <= 3:
        db.mark_reply_received(row["id"], text, "replied_insufficient")
        _send_instant_ack(row, auto, phone, text, "replied_insufficient", None)
        return {"ok": True, "status": "replied_insufficient", "reason": "short_reply"}

    # 4. Full sufficiency classifier
    verdict = classify_reply(auto, row.get("last_sent_message", "") or "", text)
    db.mark_reply_received(row["id"], text, verdict)
    _send_instant_ack(row, auto, phone, text, verdict, None)
    return {"ok": True, "status": verdict}

BIRTHDAY_CODE = '''from datetime import date

today_mmdd = date.today().strftime("%m-%d")

for row in data:
    phone = row.get('phone') or row.get('mobile') or row.get('whatsapp') or ''
    name  = row.get('name') or row.get('employee_name') or 'there'
    bday  = (row.get('birthday') or row.get('dob') or '').strip()

    if not phone:
        log(f"Skipping {name} — no phone number")
        continue

    if bday != today_mmdd:
        continue

    message = f"Happy Birthday {name}! 🎂 Wishing you a wonderful day filled with joy and happiness!"
    send_whatsapp(phone, message)
    log(f"Birthday wish sent to {name} ({phone})")
'''

VENDOR_CODE = '''from datetime import date, timedelta

today = date.today()

for row in data:
    phone       = row.get('phone') or row.get('mobile') or ''
    vendor_name = row.get('vendor_name') or row.get('name') or 'Vendor'
    company     = row.get('company') or ''
    last_contact = row.get('last_contact') or row.get('last_followup') or ''
    interval    = int(row.get('interval_days') or 7)

    if not phone:
        log(f"Skipping {vendor_name} — no phone")
        continue

    # Check if follow-up is due
    if last_contact:
        try:
            last = date.fromisoformat(last_contact)
            if today < last + timedelta(days=interval):
                continue
        except Exception:
            pass

    msg = f"Hi {vendor_name}, just following up regarding our business"
    if company:
        msg += f" with {company}"
    msg += ". Please let us know if you need anything. Thank you!"

    send_whatsapp(phone, msg)
    log(f"Vendor follow-up sent to {vendor_name} ({phone})")
'''

@app.post("/api/automations/seed")
def seed_automations():
    """Create Birthday Wish and Vendor Follow-up automations if they don't exist."""
    existing = db.list_automations()
    existing_names = [a["name"] for a in existing]
    created = []

    if "Birthday Wish" not in existing_names:
        a = db.create_automation({
            "name": "Birthday Wish",
            "description": "Automatically sends birthday wishes to employees/contacts on their birthday",
            "enabled": False,
            "data_source": {"type": "manual"},
            "match_rule": {"type": "today_field", "field": "birthday", "format": "MM-DD"},
            "message_template": "",
            "whatsapp_instance": "",
            "schedule": {"type": "daily", "time": "09:00"},
            "schedule_cron": "0 9 * * *",
            "code": BIRTHDAY_CODE.strip(),
        })
        created.append(a["id"])

    if "Vendor Follow-up" not in existing_names:
        a = db.create_automation({
            "name": "Vendor Follow-up",
            "description": "Sends periodic follow-up messages to vendors based on interval days",
            "enabled": False,
            "data_source": {"type": "manual"},
            "match_rule": {"type": "interval", "field": "last_contact", "days": 7},
            "message_template": "",
            "whatsapp_instance": "",
            "schedule": {"type": "daily", "time": "10:00"},
            "schedule_cron": "0 10 * * *",
            "code": VENDOR_CODE.strip(),
        })
        created.append(a["id"])

    return {"ok": True, "created": len(created), "ids": created}

# ── Automation Data CRUD ──────────────────────────────────────────────────────
@app.get("/api/automations/{aid}/data")
def list_rows(aid: str):
    return db.list_data(aid)

class DataIn(BaseModel):
    data: dict

@app.post("/api/automations/{aid}/data", status_code=201)
def add_row(aid: str, body: DataIn):
    return db.add_data(aid, body.data)

@app.put("/api/data/{did}")
def update_row(did: str, body: DataIn):
    return db.update_data(did, {"data": body.data})

@app.delete("/api/data/{did}")
def delete_row(did: str):
    db.delete_data(did)
    return {"ok": True}

# ── CSV Upload ────────────────────────────────────────────────────────────────
@app.post("/api/automations/{aid}/upload")
def upload_csv(aid: str, file: UploadFile = File(...)):
    content = file.file.read()
    name = (file.filename or "").lower()
    if name.endswith(".xlsx") or name.endswith(".xls"):
        df = pd.read_excel(io.BytesIO(content), dtype=str).fillna("")
    else:
        text = content.decode("utf-8-sig")
        df = pd.read_csv(io.StringIO(text), dtype=str).fillna("")
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    imported = 0
    for _, row in df.iterrows():
        db.add_data(aid, row.to_dict())
        imported += 1
    return {"imported": imported}

# ── Settings ──────────────────────────────────────────────────────────────────
@app.get("/api/settings")
def get_all_settings():
    return {
        "evolution_api_url": db.get_setting("evolution_api_url"),
        "evolution_api_key": db.get_setting("evolution_api_key"),
        "gemini_api_key":       db.get_setting("gemini_api_key"),
        "openai_api_key":       db.get_setting("openai_api_key"),
        "openrouter_api_key":   db.get_setting("openrouter_api_key"),
        "n8n_webhook_url":   db.get_setting("n8n_webhook_url"),
        "whatsapp_api_url":  db.get_setting("whatsapp_api_url", "http://72.61.170.222:3008/send"),
    }

class SettingsIn(BaseModel):
    evolution_api_url: Optional[str] = None
    evolution_api_key: Optional[str] = None
    gemini_api_key:       Optional[str] = None
    openai_api_key:       Optional[str] = None
    openrouter_api_key:   Optional[str] = None
    n8n_webhook_url:   Optional[str] = None
    whatsapp_api_url:  Optional[str] = None

@app.put("/api/settings")
def update_settings(body: SettingsIn):
    if body.evolution_api_url is not None:
        db.set_setting("evolution_api_url", body.evolution_api_url)
    if body.evolution_api_key is not None:
        db.set_setting("evolution_api_key", body.evolution_api_key)
    if body.gemini_api_key is not None:
        db.set_setting("gemini_api_key", body.gemini_api_key)
    if body.openai_api_key is not None:
        db.set_setting("openai_api_key", body.openai_api_key)
    if body.openrouter_api_key is not None:
        db.set_setting("openrouter_api_key", body.openrouter_api_key)
    if body.n8n_webhook_url is not None:
        db.set_setting("n8n_webhook_url", body.n8n_webhook_url)
    if body.whatsapp_api_url is not None:
        db.set_setting("whatsapp_api_url", body.whatsapp_api_url)
    return {"ok": True}

# ── N8N Proxy: submit vendor follow-up form to n8n ────────────────────────────
class N8nVendorIn(BaseModel):
    vendor_name: str
    email: str
    phone: str
    reason: str
    urgency: str = "Medium"
    notes: str = ""

@app.post("/api/vendor-followups/submit-n8n")
def submit_to_n8n(body: N8nVendorIn):
    """Proxy: POST vendor form data to n8n webhook, then save locally."""
    import requests as req_lib
    n8n_url = db.get_setting("n8n_webhook_url", "")
    payload = {
        "Vendor Name": body.vendor_name,
        "Email": body.email,
        "Phone Number": body.phone,
        "Follow-up Reason": body.reason,
        "Urgency": body.urgency.capitalize(),
    }
    n8n_ok = False
    n8n_error = ""
    if n8n_url:
        try:
            r = req_lib.post(n8n_url, json=payload, timeout=15)
            n8n_ok = r.status_code < 300
            if not n8n_ok:
                n8n_error = r.text[:200]
        except Exception as e:
            n8n_error = str(e)
    # Save locally regardless
    local = db.create_vendor_followup({
        "vendor_name": body.vendor_name,
        "phone": body.phone,
        "email": body.email,
        "company": "",
        "reason": body.reason,
        "urgency": body.urgency.lower(),
        "notes": body.notes,
        "status": "awaiting_reply" if n8n_ok else "draft",
    })
    return {"ok": True, "n8n_triggered": n8n_ok, "n8n_error": n8n_error, "local": local}

# ── AI Code Generator ─────────────────────────────────────────────────────────
class CodeGenIn(BaseModel):
    description: str
    gemini_key: str = ""
    openai_key: str = ""
    openrouter_key: str = ""
    model: str = "gemini-2.5-flash"

GEMINI_MODELS = [
    "gemini-2.5-flash", "gemini-2.5-pro",
    "gemini-2.0-flash-lite", "gemini-2.0-flash-lite-001",
]
GPT_MODELS = [
    "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo",
]

@app.post("/api/automations/generate-code")
def generate_code(body: CodeGenIn):
    import requests as req_lib
    model = body.model.strip()

    system_context = """You are a Python automation code generator for a WhatsApp automation platform.

You can receive either:
1. A plain text description of what to automate
2. An n8n workflow JSON — in this case, analyze the nodes and connections and convert the entire workflow logic into equivalent Python code

When given an n8n JSON workflow:
- Read each node type and understand what it does
- formTrigger / webhook nodes → the trigger is already handled; data rows come from `data`
- googleSheets append nodes → log the data using log() instead (no direct Sheets access)
- AI Agent / LLM nodes → use gemini(prompt) to replicate the AI call
- Gmail / email nodes → log the email content using log() (no direct email access)
- HTTP Request nodes that send WhatsApp → use send_whatsapp(phone, message) instead
- Code nodes (jsCode) → convert the JavaScript logic to Python
- Preserve the full workflow logic: data preparation, AI generation, message formatting, sending

Available variables in the execution context:
- data: list of dicts (each row = one vendor/contact record with fields from your data table)
- send_whatsapp(phone, message): sends a WhatsApp message, returns {"ok": True/False}
- log(message): logs info, results, or data to the activity log
- gemini(prompt): calls AI (Gemini/GPT/DeepSeek depending on config) and returns generated text
- requests: Python requests library for HTTP calls
- datetime: Python datetime module
- json: Python json module

Rules:
- Always check if phone exists before sending
- Use row.get("field", "") to safely access columns
- Keep code clean and readable with comments explaining each step
- Only output the Python code, no markdown, no explanation, no code blocks
- If the workflow has a trigger (form, webhook) treat `data` as the input rows
"""
    # Detect if input is an n8n JSON workflow
    desc = body.description.strip()
    is_json = desc.startswith("{") or desc.startswith("[")
    if is_json:
        prompt = f"{system_context}\n\nThe user has provided an n8n workflow JSON. Convert it to Python automation code:\n\n{desc}\n\nGenerate the equivalent Python automation code:"
    else:
        prompt = f"{system_context}\n\nUser requirement: {desc}\n\nGenerate the Python automation code:"

    # Detect formTrigger node and extract form_schema
    detected_form_schema = None
    if is_json:
        try:
            workflow = json.loads(desc)
            nodes = workflow.get("nodes", []) if isinstance(workflow, dict) else []
            for node in nodes:
                node_type = node.get("type", "")
                if "formTrigger" in node_type:
                    form_fields = (
                        node.get("parameters", {})
                            .get("formFields", {})
                            .get("values", [])
                    )
                    detected_form_schema = {
                        "fields": [
                            {
                                "label": field.get("fieldLabel", ""),
                                "id": field.get("fieldLabel", "").lower().replace(" ", "_"),
                                "type": field.get("fieldType", "text"),
                                "placeholder": field.get("placeholder", ""),
                                "required": field.get("requiredField", False),
                                "options": [
                                    o["option"]
                                    for o in field.get("fieldOptions", {}).get("values", [])
                                ],
                            }
                            for field in form_fields
                        ]
                    }
                    break
        except Exception:
            pass

    def _strip_code_block(code: str) -> str:
        if code.startswith("```python"):
            code = code[9:]
        if code.startswith("```"):
            code = code[3:]
        if code.endswith("```"):
            code = code[:-3]
        return code.strip()

    # ── OpenRouter path ───────────────────────────────────────────────────────
    if body.openrouter_key.strip() or (not body.openai_key.strip() and not body.gemini_key.strip() and "/" in model):
        api_key = body.openrouter_key.strip() or db.get_setting("openrouter_api_key", "")
        if api_key:
            try:
                resp = req_lib.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.2,
                    },
                    timeout=60,
                )
                resp.raise_for_status()
                data = resp.json()
                code = data["choices"][0]["message"]["content"].strip()
                return {"ok": True, "code": _strip_code_block(code), "form_schema": detected_form_schema}
            except Exception as e:
                raise HTTPException(500, str(e))

    # ── OpenAI / GPT path ─────────────────────────────────────────────────────
    if model in GPT_MODELS:
        api_key = body.openai_key.strip() or db.get_setting("openai_api_key", "")
        if not api_key:
            raise HTTPException(400, "No OpenAI API key configured. Set it in Settings.")
        try:
            resp = req_lib.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            code = data["choices"][0]["message"]["content"].strip()
            return {"ok": True, "code": _strip_code_block(code), "form_schema": detected_form_schema}
        except Exception as e:
            raise HTTPException(500, str(e))

    # ── Gemini path ───────────────────────────────────────────────────────────
    api_key = body.gemini_key.strip() or db.get_setting("gemini_api_key", "")
    if not api_key:
        raise HTTPException(400, "No Gemini API key configured. Set it in Settings.")
    if model not in GEMINI_MODELS:
        model = "gemini-2.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    try:
        resp = req_lib.post(url, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        code = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        return {"ok": True, "code": _strip_code_block(code), "form_schema": detected_form_schema}
    except Exception as e:
        raise HTTPException(500, str(e))

# ── Activity Log ──────────────────────────────────────────────────────────────
@app.get("/api/activity-log")
def get_activity():
    return db.list_activity(limit=200)

@app.get("/media/{filename}")
def serve_media(filename: str):
    """Serve temp media files (e.g. generated birthday images) for Evolution GO."""
    path = os.path.join(_MEDIA_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)

# ── Vendor Follow-ups ─────────────────────────────────────────────────────────
class VendorFollowupIn(BaseModel):
    vendor_name: str
    phone: str = ""
    email: str = ""
    company: str = ""
    reason: str = ""
    urgency: str = "medium"
    notes: str = ""
    whatsapp_message: str = ""
    email_message: str = ""
    status: str = "draft"
    next_followup_date: str = ""
    whatsapp_instance: str = ""

@app.get("/api/vendor-followups")
def list_vf():
    return db.list_vendor_followups()

@app.post("/api/vendor-followups", status_code=201)
def create_vf(body: VendorFollowupIn):
    return db.create_vendor_followup(body.model_dump())

@app.put("/api/vendor-followups/{fid}")
def update_vf(fid: str, body: VendorFollowupIn):
    return db.update_vendor_followup(fid, body.model_dump())

@app.delete("/api/vendor-followups/{fid}")
def delete_vf(fid: str):
    db.delete_vendor_followup(fid)
    return {"ok": True}

class GenerateIn(BaseModel):
    vendor_name: str
    company: str = ""
    reason: str = ""
    urgency: str = "medium"
    notes: str = ""

@app.post("/api/vendor-followups/generate-messages")
def generate_messages(body: GenerateIn):
    result = generate_vendor_messages(
        body.vendor_name, body.company, body.reason, body.urgency, body.notes
    )
    return result

class SendIn(BaseModel):
    instance: str
    phone: str
    message: str

@app.post("/api/vendor-followups/{fid}/send")
def send_vf(fid: str, body: SendIn):
    from whatsapp import send_text
    result = send_text(body.instance, body.phone, body.message)
    if result.get("ok"):
        # Calculate next follow-up date based on urgency
        vf = db.get_vendor_followup(fid)
        urgency = vf.get("urgency", "medium") if vf else "medium"
        days = {"high": 1, "medium": 2, "low": 3}.get(urgency, 2)
        next_date = (date.today() + timedelta(days=days)).isoformat()
        db.update_vendor_followup(fid, {**vf, "status": "awaiting_reply", "next_followup_date": next_date})
    return result

class DirectSendIn(BaseModel):
    vendor_name: str
    phone: str
    reason: str = ""
    urgency: str = "Medium"
    notes: str = ""
    whatsapp_instance: str
    message: str = ""

@app.post("/api/vendor-followups/send-direct", status_code=200)
def send_direct(body: DirectSendIn):
    from whatsapp import send_text
    message = body.message.strip()
    if not message:
        emoji = {"High": "🔴", "Medium": "🟡", "Low": "🟢"}.get(body.urgency, "🟡")
        message = (
            f"Hello {body.vendor_name},\n\n"
            f"{body.reason}\n\n"
            f"Urgency: {emoji} {body.urgency}\n\n"
            f"Please respond at your earliest convenience.\n\nRegards"
        )
    result = send_text(body.whatsapp_instance, body.phone, message)
    days = {"High": 1, "Medium": 2, "Low": 3}.get(body.urgency, 2)
    next_date = (date.today() + timedelta(days=days)).isoformat()
    local = db.create_vendor_followup({
        "vendor_name": body.vendor_name,
        "phone": body.phone,
        "email": "",
        "company": "",
        "reason": body.reason,
        "urgency": body.urgency.lower(),
        "notes": body.notes,
        "whatsapp_message": message,
        "whatsapp_instance": body.whatsapp_instance,
        "status": "awaiting_reply" if result.get("ok") else "draft",
        "next_followup_date": next_date if result.get("ok") else "",
    })
    return {"ok": result.get("ok", False), "error": result.get("error", ""), "local": local}

class StatusIn(BaseModel):
    status: str  # done, rescheduled, awaiting_reply
    next_followup_date: str = ""

@app.put("/api/vendor-followups/{fid}/status")
def update_vf_status(fid: str, body: StatusIn):
    vf = db.get_vendor_followup(fid)
    if not vf:
        raise HTTPException(404, "Not found")
    vf["status"] = body.status
    if body.next_followup_date:
        vf["next_followup_date"] = body.next_followup_date
    elif body.status == "rescheduled":
        urgency = vf.get("urgency", "medium")
        days = {"high": 1, "medium": 2, "low": 3}.get(urgency, 2)
        vf["next_followup_date"] = (date.today() + timedelta(days=days)).isoformat()
    return db.update_vendor_followup(fid, vf)
