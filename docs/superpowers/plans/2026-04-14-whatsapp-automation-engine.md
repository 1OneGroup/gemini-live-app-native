# WhatsApp Automation Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python FastAPI automation engine that manages Employee Birthday Wish, Vendor Followup, and Payment Reminder automations — with data stored in SQLite, scheduling via APScheduler, WhatsApp delivery via Evolution GO, and UI controls from the existing Node.js dashboard (port 8100).

**Architecture:** The existing Node.js frontend (port 8100) calls the new Python FastAPI service (port 5001) for all automation data. Python owns the database (SQLite via SQLAlchemy), the scheduler (APScheduler), and the WhatsApp send logic (Evolution GO REST calls). The frontend only handles UI — no automation logic stays in Node.js.

**Tech Stack:** Python 3.11+, FastAPI, uvicorn, SQLAlchemy, SQLite, APScheduler, pandas, openpyxl, requests, pytest, Node.js (existing frontend unchanged except API base URL)

---

## File Map

### New files to create
```
gemini-live-app-native/
└── automation-engine/
    ├── main.py                  ← FastAPI app, all API routes
    ├── db.py                    ← SQLAlchemy models + DB session factory
    ├── whatsapp.py              ← Evolution GO HTTP wrapper
    ├── scheduler.py             ← APScheduler setup + 3 job functions
    ├── automations/
    │   ├── __init__.py
    │   ├── birthday.py          ← Birthday match logic + template render
    │   ├── vendor.py            ← Vendor due-date logic
    │   └── payment.py          ← Payment reminder window logic
    ├── requirements.txt
    ├── .env                     ← EVOLUTION_API_URL, EVOLUTION_API_KEY, PORT
    ├── start.sh                 ← uvicorn startup script
    └── tests/
        ├── conftest.py          ← shared pytest fixtures (in-memory SQLite DB)
        ├── test_birthday.py
        ├── test_vendor.py
        └── test_payment.py
```

### Existing files to modify
```
gemini-live-app-native/
├── dashboard.js        ← Change automation API base URL to http://localhost:5001
└── ecosystem.config.js ← Add automation-engine process
```

---

## Task 1: Project Setup

**Files:**
- Create: `automation-engine/requirements.txt`
- Create: `automation-engine/.env`
- Create: `automation-engine/start.sh`

- [ ] **Step 1: Create requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
pandas==2.2.2
openpyxl==3.1.2
requests==2.31.0
apscheduler==3.10.4
python-multipart==0.0.9
python-dotenv==1.0.1
pytest==8.2.0
httpx==0.27.0
```

- [ ] **Step 2: Create `.env` file**

```env
EVOLUTION_API_URL=http://localhost:4000
EVOLUTION_API_KEY=sua-chave-api-segura-aqui
PORT=5001
DATABASE_URL=sqlite:///./automation.db
```

- [ ] **Step 3: Create `start.sh`**

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

Expected: All packages install without error.

- [ ] **Step 5: Commit**

```bash
git add automation-engine/
git commit -m "feat: scaffold Python automation-engine project"
```

---

## Task 2: Database Models

**Files:**
- Create: `automation-engine/db.py`
- Create: `automation-engine/tests/conftest.py`

- [ ] **Step 1: Write `db.py`**

```python
import os
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Boolean, Integer, DateTime, Text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./automation.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)

class Base(DeclarativeBase):
    pass

class Employee(Base):
    __tablename__ = "employees"
    id       = Column(String, primary_key=True)
    name     = Column(String, nullable=False)
    phone    = Column(String, nullable=False)
    birthday = Column(String, nullable=False)   # MM-DD
    instance = Column(String, default="")
    message  = Column(Text, default="")         # custom per-employee message
    enabled  = Column(Boolean, default=True)
    last_wished = Column(String, default="")    # YYYY-MM-DD

class Vendor(Base):
    __tablename__ = "vendors"
    id            = Column(String, primary_key=True)
    vendor_name   = Column(String, nullable=False)
    company       = Column(String, default="")
    phone         = Column(String, nullable=False)
    last_contact  = Column(String, default="")  # YYYY-MM-DD
    interval_days = Column(Integer, default=7)
    instance      = Column(String, default="")
    status        = Column(String, default="Active")  # Active / Paused / Done
    notes         = Column(Text, default="")

class Payment(Base):
    __tablename__ = "payments"
    id          = Column(String, primary_key=True)
    client_name = Column(String, nullable=False)
    phone       = Column(String, nullable=False)
    invoice     = Column(String, default="")
    amount      = Column(String, nullable=False)
    due_date    = Column(String, nullable=False)  # YYYY-MM-DD
    instance    = Column(String, default="")
    status      = Column(String, default="Pending")  # Pending / Paid / Overdue
    notes       = Column(Text, default="")

class ActivityLog(Base):
    __tablename__ = "activity_log"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    automation = Column(String)       # birthday / vendor / payment
    phone      = Column(String)
    name       = Column(String)
    message    = Column(Text)
    status     = Column(String)       # sent / failed
    sent_at    = Column(DateTime, default=datetime.utcnow)

class Setting(Base):
    __tablename__ = "settings"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    automation = Column(String, nullable=False)  # birthday / vendor / payment
    key        = Column(String, nullable=False)  # enabled, template, instance, time
    value      = Column(Text, default="")

def init_db():
    Base.metadata.create_all(engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 2: Write `tests/conftest.py`**

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db import Base

@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(engine)
```

- [ ] **Step 3: Run a quick sanity check**

```bash
cd automation-engine
python -c "from db import init_db; init_db(); print('DB OK')"
```

Expected: `DB OK` — SQLite file `automation.db` created.

- [ ] **Step 4: Commit**

```bash
git add automation-engine/db.py automation-engine/tests/conftest.py
git commit -m "feat: database models for employees, vendors, payments, logs, settings"
```

---

## Task 3: WhatsApp Service

**Files:**
- Create: `automation-engine/whatsapp.py`

- [ ] **Step 1: Write `whatsapp.py`**

```python
import os
import requests
from dotenv import load_dotenv

load_dotenv()
EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "http://localhost:4000")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "")

def normalize_phone(phone: str) -> str:
    """Strip non-digits, add 91 country code if missing."""
    number = "".join(c for c in phone if c.isdigit())
    if number.startswith("0"):
        number = "91" + number[1:]
    if not number.startswith("91") and len(number) == 10:
        number = "91" + number
    return number

def send_whatsapp(instance: str, phone: str, message: str) -> dict:
    """Send a WhatsApp text message via Evolution GO. Returns API response dict."""
    number = normalize_phone(phone)
    url = f"{EVOLUTION_API_URL}/message/sendText/{instance}"
    headers = {"Content-Type": "application/json", "apikey": EVOLUTION_API_KEY}
    payload = {"number": number, "text": message}
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=15)
        r.raise_for_status()
        return {"ok": True, "data": r.json()}
    except requests.RequestException as exc:
        return {"ok": False, "error": str(exc)}
```

- [ ] **Step 2: Commit**

```bash
git add automation-engine/whatsapp.py
git commit -m "feat: Evolution GO WhatsApp send wrapper with phone normalization"
```

---

## Task 4: Birthday Automation Logic

**Files:**
- Create: `automation-engine/automations/__init__.py` (empty)
- Create: `automation-engine/automations/birthday.py`
- Create: `automation-engine/tests/test_birthday.py`

- [ ] **Step 1: Write failing tests first — `tests/test_birthday.py`**

```python
from automations.birthday import is_birthday_today, render_template

def test_birthday_today_match():
    assert is_birthday_today("04-14") is True   # run on 2026-04-14

def test_birthday_today_no_match():
    assert is_birthday_today("01-01") is False

def test_render_template_name():
    msg = render_template("Happy Birthday {name}!", name="Rahul")
    assert msg == "Happy Birthday Rahul!"

def test_render_template_default_when_empty():
    default = "Happy Birthday {name}! 🎂"
    msg = render_template("", name="Priya", _default=default)
    assert "Priya" in msg
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd automation-engine
pytest tests/test_birthday.py -v
```

Expected: `ModuleNotFoundError: No module named 'automations'`

- [ ] **Step 3: Write `automations/birthday.py`**

```python
from datetime import date

DEFAULT_TEMPLATE = "Happy Birthday {name}! 🎂 Wishing you a wonderful day!"

def is_birthday_today(birthday_mmdd: str) -> bool:
    """Check if MM-DD matches today's date."""
    today = date.today()
    today_mmdd = today.strftime("%m-%d")
    return birthday_mmdd.strip() == today_mmdd

def render_template(template: str, _default: str = DEFAULT_TEMPLATE, **kwargs) -> str:
    """Replace {name}, {company} etc. in template. Falls back to default if blank."""
    tmpl = template.strip() or _default
    for key, val in kwargs.items():
        tmpl = tmpl.replace("{" + key + "}", str(val or ""))
    return tmpl
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pytest tests/test_birthday.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add automation-engine/automations/ automation-engine/tests/test_birthday.py
git commit -m "feat: birthday match + template render logic (TDD)"
```

---

## Task 5: Vendor Followup Logic

**Files:**
- Create: `automation-engine/automations/vendor.py`
- Create: `automation-engine/tests/test_vendor.py`

- [ ] **Step 1: Write failing tests — `tests/test_vendor.py`**

```python
from datetime import date, timedelta
from automations.vendor import is_followup_due, render_template

def test_followup_due_today():
    past = (date.today() - timedelta(days=7)).strftime("%Y-%m-%d")
    assert is_followup_due(past, interval_days=7) is True

def test_followup_not_due_yet():
    recent = (date.today() - timedelta(days=3)).strftime("%Y-%m-%d")
    assert is_followup_due(recent, interval_days=7) is False

def test_followup_overdue():
    old = (date.today() - timedelta(days=14)).strftime("%Y-%m-%d")
    assert is_followup_due(old, interval_days=7) is True

def test_followup_empty_last_contact():
    assert is_followup_due("", interval_days=7) is True

def test_render_vendor_template():
    msg = render_template("Hi {vendor_name} from {company}", vendor_name="Ramesh", company="ABC")
    assert msg == "Hi Ramesh from ABC"
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pytest tests/test_vendor.py -v
```

- [ ] **Step 3: Write `automations/vendor.py`**

```python
from datetime import date, timedelta

DEFAULT_TEMPLATE = "Hi {vendor_name}, just checking in regarding our business with {company}. Please let us know if you need anything."

def is_followup_due(last_contact: str, interval_days: int) -> bool:
    """Return True if today >= last_contact + interval_days, or last_contact is empty."""
    if not last_contact:
        return True
    try:
        last = date.fromisoformat(last_contact)
        return date.today() >= last + timedelta(days=interval_days)
    except ValueError:
        return True

def render_template(template: str, _default: str = DEFAULT_TEMPLATE, **kwargs) -> str:
    tmpl = template.strip() or _default
    for key, val in kwargs.items():
        tmpl = tmpl.replace("{" + key + "}", str(val or ""))
    return tmpl
```

- [ ] **Step 4: Run — expect PASS**

```bash
pytest tests/test_vendor.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add automation-engine/automations/vendor.py automation-engine/tests/test_vendor.py
git commit -m "feat: vendor followup due-date logic (TDD)"
```

---

## Task 6: Payment Reminder Logic

**Files:**
- Create: `automation-engine/automations/payment.py`
- Create: `automation-engine/tests/test_payment.py`

- [ ] **Step 1: Write failing tests — `tests/test_payment.py`**

```python
from datetime import date, timedelta
from automations.payment import should_send_reminder, get_status

def test_reminder_7_days_before():
    due = (date.today() + timedelta(days=7)).strftime("%Y-%m-%d")
    assert should_send_reminder(due, remind_days=[7, 3, 1]) is True

def test_reminder_not_due():
    due = (date.today() + timedelta(days=10)).strftime("%Y-%m-%d")
    assert should_send_reminder(due, remind_days=[7, 3, 1]) is False

def test_status_overdue():
    past = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
    assert get_status(past) == "Overdue"

def test_status_pending():
    future = (date.today() + timedelta(days=5)).strftime("%Y-%m-%d")
    assert get_status(future) == "Pending"
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pytest tests/test_payment.py -v
```

- [ ] **Step 3: Write `automations/payment.py`**

```python
from datetime import date

DEFAULT_TEMPLATE = "Hi {client_name}, this is a reminder that ₹{amount} (Invoice #{invoice}) is due on {due_date}. Please arrange payment. Thank you."
OVERDUE_TEMPLATE = "Hi {client_name}, your payment of ₹{amount} (Invoice #{invoice}) was due on {due_date} and is now overdue. Please contact us immediately."

def should_send_reminder(due_date: str, remind_days: list[int]) -> bool:
    """Return True if today is exactly X days before the due date, for any X in remind_days."""
    try:
        due = date.fromisoformat(due_date)
        days_left = (due - date.today()).days
        return days_left in remind_days
    except ValueError:
        return False

def get_status(due_date: str) -> str:
    """Return 'Overdue' if due date has passed, else 'Pending'."""
    try:
        due = date.fromisoformat(due_date)
        return "Overdue" if date.today() > due else "Pending"
    except ValueError:
        return "Pending"

def render_template(template: str, overdue: bool = False, **kwargs) -> str:
    default = OVERDUE_TEMPLATE if overdue else DEFAULT_TEMPLATE
    tmpl = template.strip() or default
    for key, val in kwargs.items():
        tmpl = tmpl.replace("{" + key + "}", str(val or ""))
    return tmpl
```

- [ ] **Step 4: Run — expect PASS**

```bash
pytest tests/test_payment.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add automation-engine/automations/payment.py automation-engine/tests/test_payment.py
git commit -m "feat: payment reminder window + overdue logic (TDD)"
```

---

## Task 7: FastAPI Server — Core + Settings

**Files:**
- Create: `automation-engine/main.py`

- [ ] **Step 1: Write `main.py` — base app + settings endpoints**

```python
import os, uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

from db import init_db, get_db, Employee, Vendor, Payment, ActivityLog, Setting
from whatsapp import send_whatsapp
from automations.birthday import is_birthday_today, render_template as bday_render
from automations.vendor import is_followup_due, render_template as vendor_render
from automations.payment import should_send_reminder, get_status, render_template as pay_render
from scheduler import start_scheduler

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_scheduler()
    yield

app = FastAPI(title="WhatsApp Automation Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8100", "http://127.0.0.1:8100"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helpers ────────────────────────────────────────────────────────────────────
def get_setting(db: Session, automation: str, key: str, default: str = "") -> str:
    row = db.query(Setting).filter_by(automation=automation, key=key).first()
    return row.value if row else default

def set_setting(db: Session, automation: str, key: str, value: str):
    row = db.query(Setting).filter_by(automation=automation, key=key).first()
    if row:
        row.value = value
    else:
        db.add(Setting(automation=automation, key=key, value=value))
    db.commit()

def log_activity(db: Session, automation: str, name: str, phone: str, message: str, status: str):
    db.add(ActivityLog(automation=automation, name=name, phone=phone, message=message, status=status))
    db.commit()

# ── Settings endpoints ─────────────────────────────────────────────────────────
@app.get("/api/settings/{automation}")
def get_automation_settings(automation: str, db: Session = Depends(get_db)):
    return {
        "enabled":  get_setting(db, automation, "enabled", "false") == "true",
        "template": get_setting(db, automation, "template"),
        "instance": get_setting(db, automation, "instance"),
        "time":     get_setting(db, automation, "time", "09:00"),
        "remind_days": get_setting(db, automation, "remind_days", "7,3,1"),
        "interval_days": get_setting(db, automation, "interval_days", "7"),
    }

class SettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    template: Optional[str] = None
    instance: Optional[str] = None
    time: Optional[str] = None
    remind_days: Optional[str] = None
    interval_days: Optional[str] = None

@app.put("/api/settings/{automation}")
def update_automation_settings(automation: str, body: SettingsUpdate, db: Session = Depends(get_db)):
    if body.enabled is not None:
        set_setting(db, automation, "enabled", "true" if body.enabled else "false")
    if body.template is not None:
        set_setting(db, automation, "template", body.template)
    if body.instance is not None:
        set_setting(db, automation, "instance", body.instance)
    if body.time is not None:
        set_setting(db, automation, "time", body.time)
    if body.remind_days is not None:
        set_setting(db, automation, "remind_days", body.remind_days)
    if body.interval_days is not None:
        set_setting(db, automation, "interval_days", body.interval_days)
    return {"ok": True}

# ── Activity Log ───────────────────────────────────────────────────────────────
@app.get("/api/activity-log")
def get_activity_log(db: Session = Depends(get_db)):
    rows = db.query(ActivityLog).order_by(ActivityLog.sent_at.desc()).limit(500).all()
    return [{"id": r.id, "automation": r.automation, "name": r.name,
             "phone": r.phone, "message": r.message, "status": r.status,
             "sent_at": r.sent_at.isoformat()} for r in rows]
```

- [ ] **Step 2: Start server and verify it runs**

```bash
cd automation-engine
uvicorn main:app --port 5001 --reload
```

Open: `http://localhost:5001/docs`
Expected: FastAPI Swagger UI loads with settings and activity-log endpoints.

- [ ] **Step 3: Commit**

```bash
git add automation-engine/main.py
git commit -m "feat: FastAPI server with CORS, settings endpoints, activity log"
```

---

## Task 8: Birthday CRUD Endpoints

**Files:**
- Modify: `automation-engine/main.py` (append birthday routes)

- [ ] **Step 1: Add birthday CRUD routes to `main.py`**

Append after the activity log section:

```python
# ── Birthday CRUD ──────────────────────────────────────────────────────────────
class EmployeeIn(BaseModel):
    name: str
    phone: str
    birthday: str       # MM-DD
    instance: str = ""
    message: str = ""
    enabled: bool = True

@app.get("/api/automation/birthday")
def list_employees(db: Session = Depends(get_db)):
    rows = db.query(Employee).order_by(Employee.name).all()
    return [{"id": r.id, "name": r.name, "phone": r.phone, "birthday": r.birthday,
             "instance": r.instance, "message": r.message, "enabled": r.enabled,
             "last_wished": r.last_wished} for r in rows]

@app.post("/api/automation/birthday", status_code=201)
def create_employee(body: EmployeeIn, db: Session = Depends(get_db)):
    emp = Employee(id=str(uuid.uuid4()), **body.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp

@app.put("/api/automation/birthday/{emp_id}")
def update_employee(emp_id: str, body: EmployeeIn, db: Session = Depends(get_db)):
    emp = db.query(Employee).get(emp_id)
    if not emp:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump().items():
        setattr(emp, k, v)
    db.commit()
    return emp

@app.delete("/api/automation/birthday/{emp_id}")
def delete_employee(emp_id: str, db: Session = Depends(get_db)):
    emp = db.query(Employee).get(emp_id)
    if emp:
        db.delete(emp)
        db.commit()
    return {"ok": True}

@app.post("/api/automation/birthday/test/{emp_id}")
def test_birthday(emp_id: str, db: Session = Depends(get_db)):
    emp = db.query(Employee).get(emp_id)
    if not emp:
        raise HTTPException(404, "Not found")
    instance = emp.instance or get_setting(db, "birthday", "instance", "")
    template = get_setting(db, "birthday", "template")
    msg = bday_render(emp.message or template, name=emp.name)
    result = send_whatsapp(instance, emp.phone, msg)
    log_activity(db, "birthday", emp.name, emp.phone, msg, "sent" if result["ok"] else "failed")
    return result
```

- [ ] **Step 2: Test birthday POST via curl**

```bash
curl -s -X POST http://localhost:5001/api/automation/birthday \
  -H "Content-Type: application/json" \
  -d '{"name":"Rahul","phone":"9876543210","birthday":"04-14","instance":"onegroup"}' | python -m json.tool
```

Expected: JSON with `id`, `name`, `phone`, `birthday`.

- [ ] **Step 3: Test birthday GET**

```bash
curl -s http://localhost:5001/api/automation/birthday | python -m json.tool
```

Expected: Array with the employee just added.

- [ ] **Step 4: Commit**

```bash
git add automation-engine/main.py
git commit -m "feat: birthday CRUD endpoints (GET, POST, PUT, DELETE, test)"
```

---

## Task 9: Vendor & Payment CRUD Endpoints

**Files:**
- Modify: `automation-engine/main.py` (append vendor + payment routes)

- [ ] **Step 1: Add vendor CRUD routes to `main.py`**

```python
# ── Vendor CRUD ────────────────────────────────────────────────────────────────
class VendorIn(BaseModel):
    vendor_name: str
    company: str = ""
    phone: str
    last_contact: str = ""
    interval_days: int = 7
    instance: str = ""
    status: str = "Active"
    notes: str = ""

@app.get("/api/automation/vendor")
def list_vendors(db: Session = Depends(get_db)):
    rows = db.query(Vendor).order_by(Vendor.vendor_name).all()
    return [r.__dict__ for r in rows]

@app.post("/api/automation/vendor", status_code=201)
def create_vendor(body: VendorIn, db: Session = Depends(get_db)):
    v = Vendor(id=str(uuid.uuid4()), **body.model_dump())
    db.add(v)
    db.commit()
    db.refresh(v)
    return v

@app.put("/api/automation/vendor/{vid}")
def update_vendor(vid: str, body: VendorIn, db: Session = Depends(get_db)):
    v = db.query(Vendor).get(vid)
    if not v:
        raise HTTPException(404, "Not found")
    for k, val in body.model_dump().items():
        setattr(v, k, val)
    db.commit()
    return v

@app.delete("/api/automation/vendor/{vid}")
def delete_vendor(vid: str, db: Session = Depends(get_db)):
    v = db.query(Vendor).get(vid)
    if v:
        db.delete(v)
        db.commit()
    return {"ok": True}

@app.post("/api/automation/vendor/send/{vid}")
def send_vendor_now(vid: str, db: Session = Depends(get_db)):
    v = db.query(Vendor).get(vid)
    if not v:
        raise HTTPException(404, "Not found")
    instance = v.instance or get_setting(db, "vendor", "instance", "")
    template = get_setting(db, "vendor", "template")
    msg = vendor_render(template, vendor_name=v.vendor_name, company=v.company)
    result = send_whatsapp(instance, v.phone, msg)
    if result["ok"]:
        from datetime import date
        v.last_contact = date.today().isoformat()
        db.commit()
    log_activity(db, "vendor", v.vendor_name, v.phone, msg, "sent" if result["ok"] else "failed")
    return result
```

- [ ] **Step 2: Add payment CRUD routes to `main.py`**

```python
# ── Payment CRUD ───────────────────────────────────────────────────────────────
class PaymentIn(BaseModel):
    client_name: str
    phone: str
    invoice: str = ""
    amount: str
    due_date: str       # YYYY-MM-DD
    instance: str = ""
    status: str = "Pending"
    notes: str = ""

@app.get("/api/automation/payment")
def list_payments(db: Session = Depends(get_db)):
    from datetime import date
    rows = db.query(Payment).order_by(Payment.due_date).all()
    result = []
    for r in rows:
        days_left = None
        if r.due_date:
            try:
                days_left = (date.fromisoformat(r.due_date) - date.today()).days
            except Exception:
                pass
        result.append({**{k: v for k, v in r.__dict__.items() if not k.startswith("_")},
                        "days_left": days_left})
    return result

@app.post("/api/automation/payment", status_code=201)
def create_payment(body: PaymentIn, db: Session = Depends(get_db)):
    p = Payment(id=str(uuid.uuid4()), **body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p

@app.put("/api/automation/payment/{pid}")
def update_payment(pid: str, body: PaymentIn, db: Session = Depends(get_db)):
    p = db.query(Payment).get(pid)
    if not p:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    db.commit()
    return p

@app.delete("/api/automation/payment/{pid}")
def delete_payment(pid: str, db: Session = Depends(get_db)):
    p = db.query(Payment).get(pid)
    if p:
        db.delete(p)
        db.commit()
    return {"ok": True}

@app.post("/api/automation/payment/mark-paid/{pid}")
def mark_paid(pid: str, db: Session = Depends(get_db)):
    p = db.query(Payment).get(pid)
    if not p:
        raise HTTPException(404, "Not found")
    p.status = "Paid"
    db.commit()
    return {"ok": True}

@app.post("/api/automation/payment/send/{pid}")
def send_payment_now(pid: str, db: Session = Depends(get_db)):
    p = db.query(Payment).get(pid)
    if not p:
        raise HTTPException(404, "Not found")
    instance = p.instance or get_setting(db, "payment", "instance", "")
    template = get_setting(db, "payment", "template")
    overdue = get_status(p.due_date) == "Overdue"
    msg = pay_render(template, overdue=overdue, client_name=p.client_name,
                     amount=p.amount, invoice=p.invoice, due_date=p.due_date)
    result = send_whatsapp(instance, p.phone, msg)
    log_activity(db, "payment", p.client_name, p.phone, msg, "sent" if result["ok"] else "failed")
    return result
```

- [ ] **Step 3: Restart server and verify via Swagger**

Open: `http://localhost:5001/docs`
Verify all vendor and payment endpoints appear.

- [ ] **Step 4: Commit**

```bash
git add automation-engine/main.py
git commit -m "feat: vendor and payment CRUD endpoints with send-now and mark-paid"
```

---

## Task 10: CSV / Excel Upload Endpoints

**Files:**
- Modify: `automation-engine/main.py` (append upload routes)

- [ ] **Step 1: Add CSV/Excel upload endpoints**

```python
# ── CSV / Excel Upload ────────────────────────────────────────────────────────
import io
import pandas as pd

def read_upload(file: UploadFile) -> pd.DataFrame:
    content = file.file.read()
    name = (file.filename or "").lower()
    if name.endswith(".xlsx") or name.endswith(".xls"):
        return pd.read_excel(io.BytesIO(content), dtype=str).fillna("")
    text = content.decode("utf-8-sig")
    return pd.read_csv(io.StringIO(text), dtype=str).fillna("")

@app.post("/api/automation/birthday/upload")
def upload_birthday_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    df = read_upload(file)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    imported, errors = 0, []
    for _, row in df.iterrows():
        name     = str(row.get("name", "")).strip()
        phone    = str(row.get("phone", row.get("mobile", ""))).strip()
        birthday = str(row.get("birthday", row.get("dob", ""))).strip().replace("/", "-")
        if not name or not phone or not birthday:
            errors.append(f"Skipped: {dict(row)}")
            continue
        emp = Employee(id=str(uuid.uuid4()), name=name, phone=phone, birthday=birthday, enabled=True)
        db.add(emp)
        imported += 1
    db.commit()
    return {"imported": imported, "errors": errors}

@app.post("/api/automation/vendor/upload")
def upload_vendor_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    df = read_upload(file)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    imported, errors = 0, []
    for _, row in df.iterrows():
        vendor_name = str(row.get("vendor_name", row.get("name", ""))).strip()
        phone       = str(row.get("phone", row.get("mobile", ""))).strip()
        if not vendor_name or not phone:
            errors.append(f"Skipped: {dict(row)}")
            continue
        v = Vendor(id=str(uuid.uuid4()), vendor_name=vendor_name, phone=phone,
                   company=str(row.get("company", "")),
                   last_contact=str(row.get("last_contact", "")),
                   interval_days=int(row.get("interval_days", 7) or 7),
                   notes=str(row.get("notes", "")), status="Active")
        db.add(v)
        imported += 1
    db.commit()
    return {"imported": imported, "errors": errors}

@app.post("/api/automation/payment/upload")
def upload_payment_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    df = read_upload(file)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    imported, errors = 0, []
    for _, row in df.iterrows():
        client_name = str(row.get("client_name", row.get("name", ""))).strip()
        phone       = str(row.get("phone", row.get("mobile", ""))).strip()
        amount      = str(row.get("amount", "")).strip()
        due_date    = str(row.get("due_date", "")).strip()
        if not client_name or not phone or not amount or not due_date:
            errors.append(f"Skipped: {dict(row)}")
            continue
        p = Payment(id=str(uuid.uuid4()), client_name=client_name, phone=phone,
                    amount=amount, due_date=due_date,
                    invoice=str(row.get("invoice", "")),
                    notes=str(row.get("notes", "")), status="Pending")
        db.add(p)
        imported += 1
    db.commit()
    return {"imported": imported, "errors": errors}
```

- [ ] **Step 2: Test birthday upload via curl**

```bash
echo "name,phone,birthday
Rahul Sharma,9876543210,04-15
Priya Patel,9123456789,08-20" > /tmp/test_employees.csv

curl -s -X POST http://localhost:5001/api/automation/birthday/upload \
  -F "file=@/tmp/test_employees.csv" | python -m json.tool
```

Expected: `{"imported": 2, "errors": []}`

- [ ] **Step 3: Commit**

```bash
git add automation-engine/main.py
git commit -m "feat: CSV and Excel upload endpoints for all 3 automations"
```

---

## Task 11: Scheduler

**Files:**
- Create: `automation-engine/scheduler.py`

- [ ] **Step 1: Write `scheduler.py`**

```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import date
from db import SessionLocal, Employee, Vendor, Payment, Setting, ActivityLog
from whatsapp import send_whatsapp
from automations.birthday import is_birthday_today, render_template as bday_render
from automations.vendor import is_followup_due, render_template as vendor_render
from automations.payment import should_send_reminder, get_status, render_template as pay_render

scheduler = BackgroundScheduler()

def _get(db, automation, key, default=""):
    row = db.query(Setting).filter_by(automation=automation, key=key).first()
    return row.value if row else default

def _log(db, automation, name, phone, msg, status):
    db.add(ActivityLog(automation=automation, name=name, phone=phone, message=msg, status=status))
    db.commit()

def run_birthday_job():
    db = SessionLocal()
    try:
        if _get(db, "birthday", "enabled") != "true":
            return
        global_instance = _get(db, "birthday", "instance")
        template = _get(db, "birthday", "template")
        today = date.today().isoformat()
        for emp in db.query(Employee).filter_by(enabled=True).all():
            if emp.last_wished == today:
                continue
            if is_birthday_today(emp.birthday):
                instance = emp.instance or global_instance
                msg = bday_render(emp.message or template, name=emp.name)
                result = send_whatsapp(instance, emp.phone, msg)
                if result["ok"]:
                    emp.last_wished = today
                    db.commit()
                _log(db, "birthday", emp.name, emp.phone, msg, "sent" if result["ok"] else "failed")
    finally:
        db.close()

def run_vendor_job():
    db = SessionLocal()
    try:
        if _get(db, "vendor", "enabled") != "true":
            return
        global_instance = _get(db, "vendor", "instance")
        template = _get(db, "vendor", "template")
        for v in db.query(Vendor).filter_by(status="Active").all():
            if is_followup_due(v.last_contact, v.interval_days):
                instance = v.instance or global_instance
                msg = vendor_render(template, vendor_name=v.vendor_name, company=v.company)
                result = send_whatsapp(instance, v.phone, msg)
                if result["ok"]:
                    v.last_contact = date.today().isoformat()
                    db.commit()
                _log(db, "vendor", v.vendor_name, v.phone, msg, "sent" if result["ok"] else "failed")
    finally:
        db.close()

def run_payment_job():
    db = SessionLocal()
    try:
        if _get(db, "payment", "enabled") != "true":
            return
        global_instance = _get(db, "payment", "instance")
        template = _get(db, "payment", "template")
        remind_days = [int(x) for x in _get(db, "payment", "remind_days", "7,3,1").split(",") if x.strip()]
        for p in db.query(Payment).filter(Payment.status.in_(["Pending", "Overdue"])).all():
            new_status = get_status(p.due_date)
            if new_status != p.status:
                p.status = new_status
                db.commit()
            if should_send_reminder(p.due_date, remind_days):
                instance = p.instance or global_instance
                overdue = new_status == "Overdue"
                msg = pay_render(template, overdue=overdue, client_name=p.client_name,
                                 amount=p.amount, invoice=p.invoice, due_date=p.due_date)
                result = send_whatsapp(instance, p.phone, msg)
                _log(db, "payment", p.client_name, p.phone, msg, "sent" if result["ok"] else "failed")
    finally:
        db.close()

def start_scheduler():
    scheduler.add_job(run_birthday_job, CronTrigger(hour=9, minute=0), id="birthday", replace_existing=True)
    scheduler.add_job(run_vendor_job,   CronTrigger(hour=9, minute=5), id="vendor",   replace_existing=True)
    scheduler.add_job(run_payment_job,  CronTrigger(hour=9, minute=10), id="payment", replace_existing=True)
    scheduler.start()
```

- [ ] **Step 2: Restart server, check logs**

```bash
uvicorn main:app --port 5001 --reload
```

Expected: No errors on startup. Scheduler starts silently.

- [ ] **Step 3: Commit**

```bash
git add automation-engine/scheduler.py
git commit -m "feat: APScheduler daily jobs for birthday, vendor, payment automations"
```

---

## Task 12: Add Python Engine to PM2

**Files:**
- Modify: `gemini-live-app-native/ecosystem.config.js`

- [ ] **Step 1: Open `ecosystem.config.js` and add automation-engine entry**

Find the `apps` array and add:

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
git commit -m "feat: add automation-engine Python service to PM2 ecosystem"
```

---

## Task 13: Frontend — Point Automation API to Python (port 5001)

**Files:**
- Modify: `gemini-live-app-native/dashboard.js`

- [ ] **Step 1: Find the automation API base URL in `dashboard.js`**

```bash
grep -n "automation/birthday\|automation/vendor\|automation/payment" dashboard.js | head -20
```

- [ ] **Step 2: Add a constant at the top of the automation section in `dashboard.js`**

Find the line where `automationSubPage` is declared (around line 2324) and add above it:

```js
var AUTOMATION_API = 'http://localhost:5001';
```

- [ ] **Step 3: Replace all automation fetch URLs to use the constant**

Find all instances of:
```js
fetch('/api/automation/
```

Replace with:
```js
fetch(AUTOMATION_API + '/api/automation/
```

And settings calls:
```js
fetch('/api/settings/
```

Replace with:
```js
fetch(AUTOMATION_API + '/api/settings/
```

- [ ] **Step 4: Test in browser**

Open `http://localhost:8100` → Automation → Employee Birthday Wish
- Add an employee manually → should appear in table
- Upload a CSV → should import and appear in same table
- Toggle ON/OFF → should persist

- [ ] **Step 5: Commit**

```bash
git add dashboard.js
git commit -m "feat: frontend automation API calls now point to Python engine (port 5001)"
```

---

## Task 14: Run All Tests

- [ ] **Step 1: Run full test suite**

```bash
cd automation-engine
pytest tests/ -v
```

Expected output:
```
tests/test_birthday.py::test_birthday_today_match     PASSED
tests/test_birthday.py::test_birthday_today_no_match  PASSED
tests/test_birthday.py::test_render_template_name     PASSED
tests/test_birthday.py::test_render_template_default  PASSED
tests/test_vendor.py::test_followup_due_today         PASSED
tests/test_vendor.py::test_followup_not_due_yet       PASSED
tests/test_vendor.py::test_followup_overdue           PASSED
tests/test_vendor.py::test_followup_empty             PASSED
tests/test_vendor.py::test_render_vendor_template     PASSED
tests/test_payment.py::test_reminder_7_days_before    PASSED
tests/test_payment.py::test_reminder_not_due          PASSED
tests/test_payment.py::test_status_overdue            PASSED
tests/test_payment.py::test_status_pending            PASSED

13 passed
```

- [ ] **Step 2: Final commit**

```bash
git add -A
git commit -m "feat: complete WhatsApp automation engine — Python + SQLite + APScheduler"
```

---

## Success Checklist

- [ ] `http://localhost:5001/docs` — Swagger UI shows all endpoints
- [ ] Birthday automation — manual add + CSV upload both appear in same table
- [ ] Vendor automation — "Send Now" sends message and updates last_contact
- [ ] Payment automation — color coding works (green/yellow/red), mark as paid stops reminders
- [ ] All 3 automations have ON/OFF toggle, instance select, template editor
- [ ] Settings persist across server restarts (SQLite)
- [ ] Activity log shows all sent messages
- [ ] All 13 tests pass
