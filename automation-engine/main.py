import os
import io
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
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
        "gemini_api_key":    db.get_setting("gemini_api_key"),
        "n8n_webhook_url":   db.get_setting("n8n_webhook_url"),
        "whatsapp_api_url":  db.get_setting("whatsapp_api_url", "http://72.61.170.222:3008/send"),
    }

class SettingsIn(BaseModel):
    evolution_api_url: Optional[str] = None
    evolution_api_key: Optional[str] = None
    gemini_api_key:    Optional[str] = None
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

# ── Activity Log ──────────────────────────────────────────────────────────────
@app.get("/api/activity-log")
def get_activity():
    return db.list_activity(limit=200)

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
