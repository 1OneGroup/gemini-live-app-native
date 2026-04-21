# WhatsApp Automation Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a no-code WhatsApp automation platform where users create, configure, and run automations entirely from the frontend dashboard — without writing code or restarting servers. Each automation is a database record describing data source, match rules, message template, optional AI image personalization, and schedule.

**Architecture:** A generic Python FastAPI engine runs all automations from configs stored in Supabase. The existing Node.js dashboard (port 8100) is extended with an "Automation Builder" form. The engine supports multiple data sources (manual entry, Google Sheets, Supabase tables), pluggable match rules (today's birthday, X days before due date, interval followup), optional Gemini image personalization, and Evolution GO WhatsApp delivery (text + media). New automation types require zero code changes — just fill the builder form.

**Tech Stack:** Python 3.11+, FastAPI, uvicorn, Supabase (PostgreSQL hosted), supabase-py, APScheduler, requests, pandas, openpyxl, pytest, Node.js (existing frontend extended)

---

## Core Concept

Instead of hardcoding birthday/vendor/payment automations, every automation is a row in the `automations` table:

```
{
  "name": "Employee Birthday Wish",
  "data_source": { "type": "supabase_table", "table": "employees" },
  "match_rule": { "type": "today_field", "field": "birthday", "format": "MM-DD" },
  "use_image": true,
  "image_template_url": "https://...",
  "image_prompt": "Replace name at bottom with: {name}",
  "message_template": "Happy Birthday {name}!",
  "schedule": { "type": "daily", "time": "09:00" },
  "whatsapp_instance": "onegroup",
  "enabled": true
}
```

Engine reads this row → loads data → applies match rule → optionally generates image → sends via Evolution GO → logs result.

User adds a 4th automation (e.g., "Anniversary Wish") by filling the same form — no code, no restart.

---

## File Map

### New files
```
gemini-live-app-native/
└── automation-engine/
    ├── main.py                  ← FastAPI app, all REST routes
    ├── db.py                    ← Supabase client wrapper
    ├── whatsapp.py              ← Evolution GO (sendText + sendMedia)
    ├── gemini_image.py          ← Gemini 2.5 Flash Image personalization
    ├── scheduler.py             ← APScheduler dynamic job loader
    ├── engine/
    │   ├── __init__.py
    │   ├── runner.py            ← Main automation execution loop
    │   ├── data_sources.py      ← manual / google_sheets / supabase_table
    │   ├── match_rules.py       ← today_field / days_before / interval
    │   └── template.py          ← Template render with {placeholders}
    ├── requirements.txt
    ├── .env
    ├── start.sh
    └── tests/
        ├── conftest.py
        ├── test_match_rules.py
        ├── test_template.py
        ├── test_data_sources.py
        └── test_runner.py
```

### Modified files
```
gemini-live-app-native/
├── dashboard.js          ← Add Automation Builder UI + list page
├── server.js             ← Proxy /automation/* requests to Python engine
└── ecosystem.config.js   ← Add automation-engine to PM2
```

### Supabase tables to create
```
automations             ← master config for each automation
automation_data         ← rows of data (employees, vendors, payments, etc.)
activity_log            ← every send attempt
settings                ← global API keys (evolution, gemini)
```

---

## Task 1: Supabase Project Setup

**Files:** None (manual setup in Supabase dashboard)

- [ ] **Step 1: Create Supabase project**

Go to https://supabase.com → New Project → name: `whatsapp-automation`

Note down:
- Project URL: `https://xxxxx.supabase.co`
- Anon key: `eyJ...`
- Service role key: `eyJ...` (for backend)

- [ ] **Step 2: Create tables via SQL Editor**

Run this SQL in Supabase SQL Editor:

```sql
-- automations: each row is one configurable automation
create table automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  enabled boolean default false,
  data_source jsonb not null default '{}'::jsonb,
  match_rule jsonb not null default '{}'::jsonb,
  use_image boolean default false,
  image_template_url text default '',
  image_prompt text default '',
  message_template text not null default '',
  whatsapp_instance text default '',
  schedule jsonb not null default '{"type":"daily","time":"09:00"}'::jsonb,
  created_at timestamp with time zone default now()
);

-- automation_data: rows of data for each automation (flexible JSONB)
create table automation_data (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  last_processed text default '',
  created_at timestamp with time zone default now()
);
create index automation_data_automation_id_idx on automation_data(automation_id);

-- activity_log: every send attempt
create table activity_log (
  id bigserial primary key,
  automation_id uuid references automations(id) on delete set null,
  automation_name text,
  recipient_name text,
  recipient_phone text,
  message_sent text,
  image_sent boolean default false,
  status text,
  error text default '',
  sent_at timestamp with time zone default now()
);
create index activity_log_sent_at_idx on activity_log(sent_at desc);

-- settings: global API keys and config
create table settings (
  key text primary key,
  value text not null default ''
);

insert into settings (key, value) values
  ('evolution_api_url', 'http://localhost:4000'),
  ('evolution_api_key', ''),
  ('gemini_api_key', '')
on conflict (key) do nothing;
```

- [ ] **Step 3: Verify tables exist**

In Supabase dashboard → Table Editor → confirm 4 tables visible.

- [ ] **Step 4: Commit (note credentials, no code yet)**

```bash
git commit --allow-empty -m "chore: Supabase project provisioned with 4 tables"
```

---

## Task 2: Python Project Scaffold

**Files:**
- Create: `automation-engine/requirements.txt`
- Create: `automation-engine/.env`
- Create: `automation-engine/start.sh`

- [ ] **Step 1: Write `requirements.txt`**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
supabase==2.5.0
apscheduler==3.10.4
requests==2.31.0
pandas==2.2.2
openpyxl==3.1.2
python-multipart==0.0.9
python-dotenv==1.0.1
pytest==8.2.0
httpx==0.27.0
gspread==6.1.0
google-auth==2.29.0
```

- [ ] **Step 2: Write `.env`**

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=eyJ...service-role-key...
PORT=5001
```

- [ ] **Step 3: Write `start.sh`**

```bash
#!/bin/bash
cd "$(dirname "$0")"
uvicorn main:app --host 0.0.0.0 --port 5001 --reload
```

- [ ] **Step 4: Install dependencies**

```bash
cd automation-engine
pip install -r requirements.txt
```

- [ ] **Step 5: Commit**

```bash
git add automation-engine/requirements.txt automation-engine/start.sh
git commit -m "feat: scaffold Python automation-engine"
```

---

## Task 3: Supabase Client Wrapper

**Files:**
- Create: `automation-engine/db.py`

- [ ] **Step 1: Write `db.py`**

```python
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Settings ──────────────────────────────────────────────────────────────────
def get_setting(key: str, default: str = "") -> str:
    res = supabase.table("settings").select("value").eq("key", key).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]["value"] or default
    return default

def set_setting(key: str, value: str):
    supabase.table("settings").upsert({"key": key, "value": value}).execute()

# ── Automations ───────────────────────────────────────────────────────────────
def list_automations():
    return supabase.table("automations").select("*").order("created_at").execute().data

def get_automation(automation_id: str):
    res = supabase.table("automations").select("*").eq("id", automation_id).execute()
    return res.data[0] if res.data else None

def create_automation(payload: dict):
    return supabase.table("automations").insert(payload).execute().data[0]

def update_automation(automation_id: str, payload: dict):
    return supabase.table("automations").update(payload).eq("id", automation_id).execute().data[0]

def delete_automation(automation_id: str):
    supabase.table("automations").delete().eq("id", automation_id).execute()

# ── Automation Data ───────────────────────────────────────────────────────────
def list_data(automation_id: str):
    return supabase.table("automation_data").select("*").eq("automation_id", automation_id).execute().data

def add_data(automation_id: str, data: dict):
    return supabase.table("automation_data").insert({"automation_id": automation_id, "data": data}).execute().data[0]

def update_data(data_id: str, payload: dict):
    return supabase.table("automation_data").update(payload).eq("id", data_id).execute().data[0]

def delete_data(data_id: str):
    supabase.table("automation_data").delete().eq("id", data_id).execute()

def mark_data_processed(data_id: str, marker: str):
    supabase.table("automation_data").update({"last_processed": marker}).eq("id", data_id).execute()

# ── Activity Log ──────────────────────────────────────────────────────────────
def log_activity(automation_id: str, automation_name: str, recipient_name: str,
                 recipient_phone: str, message: str, image_sent: bool, status: str, error: str = ""):
    supabase.table("activity_log").insert({
        "automation_id": automation_id,
        "automation_name": automation_name,
        "recipient_name": recipient_name,
        "recipient_phone": recipient_phone,
        "message_sent": message,
        "image_sent": image_sent,
        "status": status,
        "error": error,
    }).execute()

def list_activity(limit: int = 200):
    return supabase.table("activity_log").select("*").order("sent_at", desc=True).limit(limit).execute().data
```

- [ ] **Step 2: Sanity check**

```bash
cd automation-engine
python -c "from db import list_automations; print(list_automations())"
```

Expected: `[]` (empty list, not an error)

- [ ] **Step 3: Commit**

```bash
git add automation-engine/db.py
git commit -m "feat: Supabase client wrapper with CRUD helpers"
```

---

## Task 4: Match Rules (TDD)

**Files:**
- Create: `automation-engine/engine/__init__.py` (empty)
- Create: `automation-engine/engine/match_rules.py`
- Create: `automation-engine/tests/conftest.py`
- Create: `automation-engine/tests/test_match_rules.py`

- [ ] **Step 1: Write `tests/conftest.py`**

```python
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
```

- [ ] **Step 2: Write failing tests — `tests/test_match_rules.py`**

```python
from datetime import date, timedelta
from engine.match_rules import matches

def test_today_field_birthday_match():
    today_mmdd = date.today().strftime("%m-%d")
    rule = {"type": "today_field", "field": "birthday", "format": "MM-DD"}
    assert matches(rule, {"birthday": today_mmdd}) is True

def test_today_field_birthday_no_match():
    rule = {"type": "today_field", "field": "birthday", "format": "MM-DD"}
    assert matches(rule, {"birthday": "01-01"}) is False

def test_today_field_dd_mm_format():
    today = date.today().strftime("%d/%m")
    rule = {"type": "today_field", "field": "dob", "format": "DD/MM"}
    assert matches(rule, {"dob": today}) is True

def test_days_before_due_match():
    due = (date.today() + timedelta(days=7)).strftime("%Y-%m-%d")
    rule = {"type": "days_before", "field": "due_date", "days": [7, 3, 1]}
    assert matches(rule, {"due_date": due}) is True

def test_days_before_due_no_match():
    due = (date.today() + timedelta(days=10)).strftime("%Y-%m-%d")
    rule = {"type": "days_before", "field": "due_date", "days": [7, 3, 1]}
    assert matches(rule, {"due_date": due}) is False

def test_interval_followup_due():
    past = (date.today() - timedelta(days=10)).strftime("%Y-%m-%d")
    rule = {"type": "interval", "field": "last_contact", "days": 7}
    assert matches(rule, {"last_contact": past}) is True

def test_interval_followup_not_due():
    recent = (date.today() - timedelta(days=3)).strftime("%Y-%m-%d")
    rule = {"type": "interval", "field": "last_contact", "days": 7}
    assert matches(rule, {"last_contact": recent}) is False

def test_interval_empty_field():
    rule = {"type": "interval", "field": "last_contact", "days": 7}
    assert matches(rule, {"last_contact": ""}) is True
```

- [ ] **Step 3: Run — expect FAIL**

```bash
cd automation-engine
pytest tests/test_match_rules.py -v
```

- [ ] **Step 4: Write `engine/match_rules.py`**

```python
from datetime import date, timedelta

def _today_str(fmt: str) -> str:
    today = date.today()
    if fmt == "MM-DD":
        return today.strftime("%m-%d")
    if fmt == "DD/MM":
        return today.strftime("%d/%m")
    if fmt == "DD-MM":
        return today.strftime("%d-%m")
    return today.isoformat()

def matches(rule: dict, row: dict) -> bool:
    rtype = rule.get("type")

    if rtype == "today_field":
        field = rule.get("field", "")
        fmt = rule.get("format", "MM-DD")
        val = str(row.get(field, "")).strip()
        return val == _today_str(fmt)

    if rtype == "days_before":
        field = rule.get("field", "")
        days_list = rule.get("days", [])
        val = str(row.get(field, "")).strip()
        try:
            target = date.fromisoformat(val)
            days_left = (target - date.today()).days
            return days_left in days_list
        except ValueError:
            return False

    if rtype == "interval":
        field = rule.get("field", "")
        interval = int(rule.get("days", 0))
        val = str(row.get(field, "")).strip()
        if not val:
            return True
        try:
            last = date.fromisoformat(val)
            return date.today() >= last + timedelta(days=interval)
        except ValueError:
            return True

    return False
```

- [ ] **Step 5: Run — expect PASS**

```bash
pytest tests/test_match_rules.py -v
```

Expected: 8 passed.

- [ ] **Step 6: Commit**

```bash
git add automation-engine/engine/ automation-engine/tests/
git commit -m "feat: pluggable match rules — today_field, days_before, interval (TDD)"
```

---

## Task 5: Template Renderer (TDD)

**Files:**
- Create: `automation-engine/engine/template.py`
- Create: `automation-engine/tests/test_template.py`

- [ ] **Step 1: Write failing tests**

```python
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
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pytest tests/test_template.py -v
```

- [ ] **Step 3: Write `engine/template.py`**

```python
import re

def render(template: str, data: dict) -> str:
    """Replace {field} placeholders with values from data dict. Missing fields → empty string."""
    if not template:
        return ""
    def repl(match):
        key = match.group(1).strip()
        return str(data.get(key, ""))
    return re.sub(r"\{([^{}]+)\}", repl, template)
```

- [ ] **Step 4: Run — expect PASS**

```bash
pytest tests/test_template.py -v
```

- [ ] **Step 5: Commit**

```bash
git add automation-engine/engine/template.py automation-engine/tests/test_template.py
git commit -m "feat: template renderer with {placeholder} substitution (TDD)"
```

---

## Task 6: Data Sources (Manual + Google Sheets)

**Files:**
- Create: `automation-engine/engine/data_sources.py`
- Create: `automation-engine/tests/test_data_sources.py`

- [ ] **Step 1: Write `engine/data_sources.py`**

```python
import gspread
from google.oauth2.service_account import Credentials
from db import list_data

GSHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

def load_data(automation_id: str, data_source: dict) -> list[dict]:
    """Return a list of row dicts based on data source type."""
    src_type = data_source.get("type", "manual")

    if src_type == "manual" or src_type == "supabase_table":
        rows = list_data(automation_id)
        return [r["data"] | {"_id": r["id"], "_last_processed": r.get("last_processed", "")} for r in rows]

    if src_type == "google_sheets":
        sheet_id = data_source.get("sheet_id", "")
        sheet_name = data_source.get("sheet_name", "Sheet1")
        creds_path = data_source.get("creds_path", "")
        creds = Credentials.from_service_account_file(creds_path, scopes=GSHEETS_SCOPES)
        gc = gspread.authorize(creds)
        sh = gc.open_by_key(sheet_id)
        ws = sh.worksheet(sheet_name) if sheet_name else sh.sheet1
        records = ws.get_all_records()
        return [{k.lower().strip().replace(" ", "_"): str(v).strip() for k, v in r.items()} for r in records]

    return []
```

- [ ] **Step 2: Write basic test (no actual gsheets call)**

```python
# tests/test_data_sources.py
from engine.data_sources import load_data

def test_unknown_source_returns_empty():
    assert load_data("fake-id", {"type": "unknown"}) == []
```

- [ ] **Step 3: Run**

```bash
pytest tests/test_data_sources.py -v
```

Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add automation-engine/engine/data_sources.py automation-engine/tests/test_data_sources.py
git commit -m "feat: data source loaders — manual, supabase_table, google_sheets"
```

---

## Task 7: WhatsApp Service (Text + Media)

**Files:**
- Create: `automation-engine/whatsapp.py`

- [ ] **Step 1: Write `whatsapp.py`**

```python
import requests
from db import get_setting

def normalize_phone(phone: str) -> str:
    number = "".join(c for c in str(phone) if c.isdigit())
    if number.startswith("0"):
        number = "91" + number[1:]
    if not number.startswith("91") and len(number) == 10:
        number = "91" + number
    return number

def send_text(instance: str, phone: str, message: str) -> dict:
    base = get_setting("evolution_api_url", "http://localhost:4000")
    key = get_setting("evolution_api_key", "")
    url = f"{base}/message/sendText/{instance}"
    headers = {"Content-Type": "application/json", "apikey": key}
    payload = {"number": normalize_phone(phone), "text": message}
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=20)
        r.raise_for_status()
        return {"ok": True, "data": r.json()}
    except requests.RequestException as exc:
        return {"ok": False, "error": str(exc)}

def send_media(instance: str, phone: str, caption: str, image_base64: str, mime: str = "image/png") -> dict:
    base = get_setting("evolution_api_url", "http://localhost:4000")
    key = get_setting("evolution_api_key", "")
    url = f"{base}/message/sendMedia/{instance}"
    headers = {"Content-Type": "application/json", "apikey": key}
    payload = {
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
```

- [ ] **Step 2: Commit**

```bash
git add automation-engine/whatsapp.py
git commit -m "feat: Evolution GO WhatsApp wrapper — sendText + sendMedia"
```

---

## Task 8: Gemini Image Personalization

**Files:**
- Create: `automation-engine/gemini_image.py`

- [ ] **Step 1: Write `gemini_image.py`**

```python
import base64
import requests
from db import get_setting

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"

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
```

- [ ] **Step 2: Commit**

```bash
git add automation-engine/gemini_image.py
git commit -m "feat: Gemini 2.5 Flash Image personalization wrapper"
```

---

## Task 9: Automation Runner (Core Engine)

**Files:**
- Create: `automation-engine/engine/runner.py`
- Create: `automation-engine/tests/test_runner.py`

- [ ] **Step 1: Write `engine/runner.py`**

```python
from datetime import date
from db import (get_automation, log_activity, mark_data_processed)
from engine.data_sources import load_data
from engine.match_rules import matches
from engine.template import render
from whatsapp import send_text, send_media
from gemini_image import personalize_image

def run_automation(automation_id: str) -> dict:
    """Execute an automation. Returns summary dict."""
    auto = get_automation(automation_id)
    if not auto or not auto.get("enabled"):
        return {"ok": False, "reason": "disabled or not found"}

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
        phone = row.get("phone") or row.get("mobile") or row.get("whatsapp") or ""
        name = row.get("name") or row.get("client_name") or row.get("vendor_name") or ""

        if use_image and img_url:
            img_prompt = render(img_prompt_tmpl, row)
            result = personalize_image(img_url, img_prompt)
            if result:
                b64, mime = result
                send_result = send_media(instance, phone, message, b64, mime)
            else:
                send_result = send_text(instance, phone, message)
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
```

- [ ] **Step 2: Write a smoke test**

```python
# tests/test_runner.py
from engine.runner import run_automation

def test_run_nonexistent_automation():
    result = run_automation("00000000-0000-0000-0000-000000000000")
    assert result["ok"] is False
```

- [ ] **Step 3: Run**

```bash
pytest tests/test_runner.py -v
```

- [ ] **Step 4: Commit**

```bash
git add automation-engine/engine/runner.py automation-engine/tests/test_runner.py
git commit -m "feat: generic automation runner — load → match → render → send → log"
```

---

## Task 10: Dynamic Scheduler

**Files:**
- Create: `automation-engine/scheduler.py`

- [ ] **Step 1: Write `scheduler.py`**

```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from db import list_automations
from engine.runner import run_automation

scheduler = BackgroundScheduler()

def _job(automation_id: str):
    print(f"[scheduler] running {automation_id}")
    result = run_automation(automation_id)
    print(f"[scheduler] result: {result}")

def reload_jobs():
    """Clear and reload all jobs from current automation configs in Supabase."""
    for job in scheduler.get_jobs():
        scheduler.remove_job(job.id)
    for auto in list_automations():
        if not auto.get("enabled"):
            continue
        sched = auto.get("schedule") or {}
        if sched.get("type") != "daily":
            continue
        time_str = sched.get("time", "09:00")
        try:
            hour, minute = map(int, time_str.split(":"))
        except Exception:
            hour, minute = 9, 0
        scheduler.add_job(
            _job,
            CronTrigger(hour=hour, minute=minute),
            args=[auto["id"]],
            id=auto["id"],
            replace_existing=True,
        )
        print(f"[scheduler] registered {auto['name']} @ {time_str}")

def start_scheduler():
    reload_jobs()
    scheduler.start()
```

- [ ] **Step 2: Commit**

```bash
git add automation-engine/scheduler.py
git commit -m "feat: dynamic scheduler — auto-loads jobs from Supabase configs"
```

---

## Task 11: FastAPI Routes — Automations CRUD

**Files:**
- Create: `automation-engine/main.py`

- [ ] **Step 1: Write `main.py`**

```python
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import io
import pandas as pd

import db
from scheduler import start_scheduler, reload_jobs
from engine.runner import run_automation

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

# ── Automation Data CRUD (rows for an automation) ─────────────────────────────
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
    }

class SettingsIn(BaseModel):
    evolution_api_url: Optional[str] = None
    evolution_api_key: Optional[str] = None
    gemini_api_key:    Optional[str] = None

@app.put("/api/settings")
def update_settings(body: SettingsIn):
    if body.evolution_api_url is not None:
        db.set_setting("evolution_api_url", body.evolution_api_url)
    if body.evolution_api_key is not None:
        db.set_setting("evolution_api_key", body.evolution_api_key)
    if body.gemini_api_key is not None:
        db.set_setting("gemini_api_key", body.gemini_api_key)
    return {"ok": True}

# ── Activity Log ──────────────────────────────────────────────────────────────
@app.get("/api/activity-log")
def get_activity():
    return db.list_activity(limit=200)
```

- [ ] **Step 2: Start server**

```bash
cd automation-engine
uvicorn main:app --port 5001 --reload
```

Open: `http://localhost:5001/docs`
Verify all endpoints visible in Swagger UI.

- [ ] **Step 3: Smoke test — create one automation via curl**

```bash
curl -s -X POST http://localhost:5001/api/automations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Birthday",
    "match_rule": {"type": "today_field", "field": "birthday", "format": "MM-DD"},
    "message_template": "Happy Birthday {name}!",
    "whatsapp_instance": "onegroup",
    "data_source": {"type": "manual"},
    "schedule": {"type": "daily", "time": "09:00"},
    "enabled": true
  }' | python -m json.tool
```

Expected: JSON with `id`, `name`, etc.

- [ ] **Step 4: Commit**

```bash
git add automation-engine/main.py
git commit -m "feat: FastAPI routes — automations CRUD, data, upload, settings, run-now, activity"
```

---

## Task 12: Frontend — Automation List Page

**Files:**
- Modify: `gemini-live-app-native/dashboard.js`

- [ ] **Step 1: Add API base URL constant near the automation section**

Find around line 2324 in `dashboard.js`:

```js
var AUTOMATION_API = 'http://localhost:5001';
```

- [ ] **Step 2: Replace the static `automationItems` list with a dynamic list loaded from Supabase**

Find:

```js
var automationItems = [
  { id: 'birthday',  label: 'Employee Birthday Wish' },
  { id: 'vendor',    label: 'Vendor Followup' },
  { id: 'payment',   label: 'Payment Reminder' },
];
```

Replace with a function that loads from API:

```js
var automationItems = [];

function loadAutomationsList() {
  return fetch(AUTOMATION_API + '/api/automations')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      automationItems = data.map(function(a) {
        return { id: a.id, label: a.name, raw: a };
      });
      return automationItems;
    });
}
```

- [ ] **Step 3: Add a "+ New Automation" button at the top of the sidebar AUTOMATION section**

In the sidebar render, add a button that triggers `automationBuilderOpen()`.

- [ ] **Step 4: Commit**

```bash
git add dashboard.js
git commit -m "feat(frontend): dynamic automation list from API + new automation button"
```

---

## Task 13: Frontend — Automation Builder Form

**Files:**
- Modify: `gemini-live-app-native/dashboard.js`

- [ ] **Step 1: Add the builder modal HTML**

A form modal with these fields:

```
Name                [text]
Description         [textarea]
Enabled             [toggle]

DATA SOURCE
  Type              [dropdown: Manual / Supabase Table / Google Sheets]
  (conditional fields based on type)

MATCH RULE
  Type              [dropdown: Today's Date Match / Days Before Date / Interval]
  Field             [text]
  Format / Days     [text/number]

MESSAGE
  Template          [textarea] {variables}
  Use Image         [toggle]
  Image URL         [text]                    ← if image enabled
  Image Prompt      [textarea]                ← if image enabled

DELIVERY
  WhatsApp Instance [dropdown from /api/evolution/instances]

SCHEDULE
  Type              [dropdown: Daily / Manual Only]
  Time              [time picker]             ← if daily

[Save] [Cancel]
```

- [ ] **Step 2: Add `automationBuilderOpen()` and `automationBuilderSave()` functions**

```js
function automationBuilderOpen(existing) {
  // populate form fields if `existing` provided (edit mode), else blank (create mode)
  // toggle visibility of conditional fields based on dropdowns
}

function automationBuilderSave() {
  var payload = {
    name: document.getElementById('ab-name').value,
    description: document.getElementById('ab-desc').value,
    enabled: document.getElementById('ab-enabled').checked,
    data_source: {
      type: document.getElementById('ab-source-type').value,
      // ...other fields
    },
    match_rule: {
      type: document.getElementById('ab-rule-type').value,
      field: document.getElementById('ab-rule-field').value,
      format: document.getElementById('ab-rule-format').value,
    },
    message_template: document.getElementById('ab-template').value,
    use_image: document.getElementById('ab-use-image').checked,
    image_template_url: document.getElementById('ab-image-url').value,
    image_prompt: document.getElementById('ab-image-prompt').value,
    whatsapp_instance: document.getElementById('ab-instance').value,
    schedule: {
      type: document.getElementById('ab-sched-type').value,
      time: document.getElementById('ab-sched-time').value,
    },
  };
  var id = document.getElementById('ab-edit-id').value;
  var url = id ? AUTOMATION_API + '/api/automations/' + id : AUTOMATION_API + '/api/automations';
  var method = id ? 'PUT' : 'POST';
  fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    .then(function(r) { return r.json(); })
    .then(function() { loadAutomationsList(); automationBuilderClose(); });
}
```

- [ ] **Step 3: Test in browser**

Open dashboard → click "+ New Automation" → fill form → save → see it appear in sidebar.

- [ ] **Step 4: Commit**

```bash
git add dashboard.js
git commit -m "feat(frontend): automation builder form — create/edit any automation type"
```

---

## Task 14: Frontend — Automation Detail Page (Data + Logs)

**Files:**
- Modify: `gemini-live-app-native/dashboard.js`

- [ ] **Step 1: When an automation is clicked in the sidebar, render a detail page**

The detail page shows:
- Header: name, ON/OFF toggle, Edit button, Delete button, "Run Now" button
- Stats: total rows, sent today, failed today
- Data table: lists all rows from `/api/automations/{id}/data` — columns auto-detected from JSONB keys
- "Add Row" button → form with same fields as data
- "Upload CSV/Excel" button → calls `/api/automations/{id}/upload`
- "Recent Activity" section → last 20 entries from `/api/activity-log` filtered by this automation

- [ ] **Step 2: Test full flow**

1. Create a new automation via builder
2. Add 2-3 rows of data manually
3. Upload a CSV
4. Click "Run Now"
5. Check activity log shows attempts

- [ ] **Step 3: Commit**

```bash
git add dashboard.js
git commit -m "feat(frontend): automation detail page — data CRUD, run-now, activity"
```

---

## Task 15: Frontend — Settings Page (API Keys)

**Files:**
- Modify: `gemini-live-app-native/dashboard.js`

- [ ] **Step 1: Add a "Platform Settings" page**

Form with three fields:
- Evolution API URL
- Evolution API Key
- Gemini API Key

Save button calls `PUT /api/settings`.

- [ ] **Step 2: Commit**

```bash
git add dashboard.js
git commit -m "feat(frontend): platform settings page for API keys"
```

---

## Task 16: PM2 Integration

**Files:**
- Modify: `gemini-live-app-native/ecosystem.config.js`

- [ ] **Step 1: Add automation-engine to PM2 apps array**

```js
{
  name: 'automation-engine',
  script: 'uvicorn',
  args: 'main:app --host 0.0.0.0 --port 5001',
  cwd: './automation-engine',
  interpreter: 'python',
  env: { PYTHONUNBUFFERED: '1' }
}
```

- [ ] **Step 2: Restart PM2**

```bash
pm2 restart ecosystem.config.js
pm2 status
```

Expected: `automation-engine` shows `online`.

- [ ] **Step 3: Commit**

```bash
git add ecosystem.config.js
git commit -m "feat: add automation-engine to PM2 process list"
```

---

## Task 17: End-to-End Test — Birthday Automation

- [ ] **Step 1: Via frontend builder, create an automation:**

```
Name:               Employee Birthday Wish
Data Source Type:   Manual
Match Rule Type:    Today's Date Match
Match Field:        birthday
Match Format:       MM-DD
Use Image:          Yes
Image URL:          https://drive.google.com/.../birthday.jpeg
Image Prompt:       Replace name at bottom with: {name}
Message Template:   Happy Birthday {name}! 🎂 Wishing you a wonderful day!
Instance:           onegroup
Schedule:           Daily @ 09:00
Enabled:            ON
```

- [ ] **Step 2: Add one employee row with today's date as birthday**

Use the manual "Add Row" button:

```
name:     Test User
phone:    YOUR_TEST_NUMBER
birthday: <today in MM-DD>
```

- [ ] **Step 3: Click "Run Now" button**

Expected:
- WhatsApp received with personalized image + message
- Activity log shows `sent`

- [ ] **Step 4: Run all unit tests**

```bash
cd automation-engine
pytest tests/ -v
```

Expected: All tests pass.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: end-to-end birthday automation working through builder UI"
```

---

## Success Checklist

- [ ] Supabase project provisioned with 4 tables
- [ ] Python engine running on port 5001 (Swagger at `/docs`)
- [ ] Frontend "+ New Automation" button creates automations via form
- [ ] Created automations appear in sidebar dynamically
- [ ] Each automation has: data CRUD, CSV upload, ON/OFF toggle, Run Now, Edit, Delete
- [ ] Match rules work: today_field, days_before, interval
- [ ] Image personalization works for image-enabled automations
- [ ] Daily scheduler picks up new automations automatically (no restart)
- [ ] Activity log captures every send attempt
- [ ] Settings page allows updating Evolution + Gemini API keys
- [ ] Birthday end-to-end flow works on a test number
- [ ] Adding a brand-new automation type (e.g., Anniversary) requires zero code — only the builder form

---

## Key Design Notes

**Why generic schema?**
Adding a new automation type (Anniversary, Festival Wish, Event Reminder, etc.) requires zero code changes. User just fills the builder form. Match rules cover ~90% of common cases. Adding new match rule types (e.g., "weekday match") is one function in `match_rules.py`.

**Why Supabase?**
Hosted PostgreSQL with built-in REST API, free tier sufficient for small business use, no DB ops needed, JSONB perfect for flexible data and config.

**Why image is optional per automation?**
Birthday wants AI image personalization, but vendor followup may just want text. The `use_image` flag on each automation controls this. Future automations can selectively enable.

**Why dynamic scheduler reload?**
On every automation create/update/delete, scheduler reloads jobs from Supabase. No server restart needed when user adds a new automation.

**Future expansion**
- New data source types (webhook, REST API): add to `data_sources.py`
- New match rules (weekday, business hours): add to `match_rules.py`
- New send types (PDF, voice): add new module + flag in automation config
- All require **one file edit + restart** — no schema changes
