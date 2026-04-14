"""
SQLite-backed database layer — works locally without any cloud credentials.
"""
import os, json, sqlite3, uuid
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "automation.db")

def _conn():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

def _init():
    with _conn() as con:
        # Migrate legacy settings table if it has old schema (has 'automation' column)
        old_settings = con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'"
        ).fetchone()
        if old_settings:
            cols = [r[1] for r in con.execute("PRAGMA table_info(settings)").fetchall()]
            if 'automation' in cols:
                con.execute("DROP TABLE settings")
        con.executescript("""
        CREATE TABLE IF NOT EXISTS automations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            enabled INTEGER DEFAULT 0,
            data_source TEXT DEFAULT '{}',
            match_rule TEXT DEFAULT '{}',
            use_image INTEGER DEFAULT 0,
            image_template_url TEXT DEFAULT '',
            image_prompt TEXT DEFAULT '',
            message_template TEXT DEFAULT '',
            whatsapp_instance TEXT DEFAULT '',
            schedule TEXT DEFAULT '{"type":"daily","time":"09:00"}',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS automation_data (
            id TEXT PRIMARY KEY,
            automation_id TEXT NOT NULL,
            data TEXT DEFAULT '{}',
            last_processed TEXT DEFAULT NULL
        );
        CREATE TABLE IF NOT EXISTS activity_log (
            id TEXT PRIMARY KEY,
            automation_id TEXT,
            automation_name TEXT,
            recipient_name TEXT,
            recipient_phone TEXT,
            message_sent TEXT,
            image_sent INTEGER DEFAULT 0,
            status TEXT,
            error TEXT DEFAULT '',
            sent_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS vendor_followups (
            id TEXT PRIMARY KEY,
            vendor_name TEXT NOT NULL,
            phone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            company TEXT DEFAULT '',
            reason TEXT DEFAULT '',
            urgency TEXT DEFAULT 'medium',
            notes TEXT DEFAULT '',
            whatsapp_message TEXT DEFAULT '',
            email_message TEXT DEFAULT '',
            status TEXT DEFAULT 'draft',
            next_followup_date TEXT DEFAULT '',
            whatsapp_instance TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        """)
    # Seed settings from environment variables (only if not already set)
    env_seeds = {
        "evolution_api_url": os.getenv("EVOLUTION_API_URL", ""),
        "evolution_api_key": os.getenv("EVOLUTION_API_KEY", ""),
    }
    with _conn() as con:
        for k, v in env_seeds.items():
            if v:
                con.execute(
                    "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING",
                    (k, v)
                )

_init()

def _row_to_dict(row):
    if row is None:
        return None
    d = dict(row)
    for field in ("data_source", "match_rule", "schedule"):
        if field in d and isinstance(d[field], str):
            try:
                d[field] = json.loads(d[field])
            except Exception:
                d[field] = {}
    if "data" in d and isinstance(d["data"], str):
        try:
            d["data"] = json.loads(d["data"])
        except Exception:
            d["data"] = {}
    if "enabled" in d:
        d["enabled"] = bool(d["enabled"])
    if "use_image" in d:
        d["use_image"] = bool(d["use_image"])
    if "image_sent" in d:
        d["image_sent"] = bool(d["image_sent"])
    return d

# ── Settings ──────────────────────────────────────────────────────────────────
def get_setting(key: str, default: str = "") -> str:
    with _conn() as con:
        row = con.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return row["value"] if row else default

def set_setting(key: str, value: str):
    with _conn() as con:
        con.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                    (key, value))

# ── Automations ───────────────────────────────────────────────────────────────
def list_automations():
    with _conn() as con:
        rows = con.execute("SELECT * FROM automations ORDER BY created_at").fetchall()
        return [_row_to_dict(r) for r in rows]

def get_automation(automation_id: str):
    with _conn() as con:
        row = con.execute("SELECT * FROM automations WHERE id=?", (automation_id,)).fetchone()
        return _row_to_dict(row)

def create_automation(payload: dict):
    aid = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    with _conn() as con:
        con.execute("""
            INSERT INTO automations
              (id, name, description, enabled, data_source, match_rule,
               use_image, image_template_url, image_prompt, message_template,
               whatsapp_instance, schedule, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            aid,
            payload.get("name", ""),
            payload.get("description", ""),
            int(payload.get("enabled", False)),
            json.dumps(payload.get("data_source", {})),
            json.dumps(payload.get("match_rule", {})),
            int(payload.get("use_image", False)),
            payload.get("image_template_url", ""),
            payload.get("image_prompt", ""),
            payload.get("message_template", ""),
            payload.get("whatsapp_instance", ""),
            json.dumps(payload.get("schedule", {"type": "daily", "time": "09:00"})),
            now,
        ))
    return get_automation(aid)

def update_automation(automation_id: str, payload: dict):
    with _conn() as con:
        con.execute("""
            UPDATE automations SET
              name=?, description=?, enabled=?, data_source=?, match_rule=?,
              use_image=?, image_template_url=?, image_prompt=?, message_template=?,
              whatsapp_instance=?, schedule=?
            WHERE id=?
        """, (
            payload.get("name", ""),
            payload.get("description", ""),
            int(payload.get("enabled", False)),
            json.dumps(payload.get("data_source", {})),
            json.dumps(payload.get("match_rule", {})),
            int(payload.get("use_image", False)),
            payload.get("image_template_url", ""),
            payload.get("image_prompt", ""),
            payload.get("message_template", ""),
            payload.get("whatsapp_instance", ""),
            json.dumps(payload.get("schedule", {"type": "daily", "time": "09:00"})),
            automation_id,
        ))
    return get_automation(automation_id)

def delete_automation(automation_id: str):
    with _conn() as con:
        con.execute("DELETE FROM automations WHERE id=?", (automation_id,))
        con.execute("DELETE FROM automation_data WHERE automation_id=?", (automation_id,))

# ── Automation Data ───────────────────────────────────────────────────────────
def list_data(automation_id: str):
    with _conn() as con:
        rows = con.execute("SELECT * FROM automation_data WHERE automation_id=?", (automation_id,)).fetchall()
        return [_row_to_dict(r) for r in rows]

def add_data(automation_id: str, data: dict):
    did = str(uuid.uuid4())
    with _conn() as con:
        con.execute("INSERT INTO automation_data(id, automation_id, data) VALUES(?,?,?)",
                    (did, automation_id, json.dumps(data)))
    with _conn() as con:
        row = con.execute("SELECT * FROM automation_data WHERE id=?", (did,)).fetchone()
        return _row_to_dict(row)

def update_data(data_id: str, payload: dict):
    with _conn() as con:
        if "data" in payload:
            con.execute("UPDATE automation_data SET data=? WHERE id=?",
                        (json.dumps(payload["data"]), data_id))
        row = con.execute("SELECT * FROM automation_data WHERE id=?", (data_id,)).fetchone()
        return _row_to_dict(row)

def delete_data(data_id: str):
    with _conn() as con:
        con.execute("DELETE FROM automation_data WHERE id=?", (data_id,))

def mark_data_processed(data_id: str, marker: str):
    with _conn() as con:
        con.execute("UPDATE automation_data SET last_processed=? WHERE id=?", (marker, data_id))

# ── Activity Log ──────────────────────────────────────────────────────────────
def log_activity(automation_id: str, automation_name: str, recipient_name: str,
                 recipient_phone: str, message: str, image_sent: bool, status: str, error: str = ""):
    lid = str(uuid.uuid4())
    with _conn() as con:
        con.execute("""
            INSERT INTO activity_log
              (id, automation_id, automation_name, recipient_name, recipient_phone,
               message_sent, image_sent, status, error)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (lid, automation_id, automation_name, recipient_name, recipient_phone,
              message, int(image_sent), status, error))

def list_activity(limit: int = 200):
    with _conn() as con:
        rows = con.execute("SELECT * FROM activity_log ORDER BY sent_at DESC LIMIT ?", (limit,)).fetchall()
        return [_row_to_dict(r) for r in rows]

# ── Vendor Follow-ups ─────────────────────────────────────────────────────────
def list_vendor_followups():
    with _conn() as con:
        rows = con.execute("SELECT * FROM vendor_followups ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

def get_vendor_followup(fid: str):
    with _conn() as con:
        row = con.execute("SELECT * FROM vendor_followups WHERE id=?", (fid,)).fetchone()
        return dict(row) if row else None

def create_vendor_followup(payload: dict):
    fid = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    with _conn() as con:
        con.execute("""
            INSERT INTO vendor_followups
              (id, vendor_name, phone, email, company, reason, urgency, notes,
               whatsapp_message, email_message, status, next_followup_date, whatsapp_instance, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (fid, payload.get("vendor_name",""), payload.get("phone",""),
              payload.get("email",""), payload.get("company",""), payload.get("reason",""),
              payload.get("urgency","medium"), payload.get("notes",""),
              payload.get("whatsapp_message",""), payload.get("email_message",""),
              payload.get("status","draft"), payload.get("next_followup_date",""),
              payload.get("whatsapp_instance",""), now, now))
    return get_vendor_followup(fid)

def update_vendor_followup(fid: str, payload: dict):
    now = datetime.utcnow().isoformat()
    with _conn() as con:
        con.execute("""
            UPDATE vendor_followups SET
              vendor_name=?, phone=?, email=?, company=?, reason=?, urgency=?, notes=?,
              whatsapp_message=?, email_message=?, status=?, next_followup_date=?,
              whatsapp_instance=?, updated_at=?
            WHERE id=?
        """, (payload.get("vendor_name",""), payload.get("phone",""),
              payload.get("email",""), payload.get("company",""), payload.get("reason",""),
              payload.get("urgency","medium"), payload.get("notes",""),
              payload.get("whatsapp_message",""), payload.get("email_message",""),
              payload.get("status","draft"), payload.get("next_followup_date",""),
              payload.get("whatsapp_instance",""), now, fid))
    return get_vendor_followup(fid)

def delete_vendor_followup(fid: str):
    with _conn() as con:
        con.execute("DELETE FROM vendor_followups WHERE id=?", (fid,))
