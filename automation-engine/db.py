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
        # Migrate legacy activity_log if id column is INTEGER (old schema)
        old_log = con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='activity_log'"
        ).fetchone()
        if old_log:
            id_col = con.execute("PRAGMA table_info(activity_log)").fetchall()
            id_type = id_col[0][2] if id_col else ''
            if id_type == 'INTEGER':
                con.execute("DROP TABLE activity_log")
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
            code TEXT DEFAULT '',
            schedule_cron TEXT DEFAULT '0 9 * * *',
            gemini_key TEXT DEFAULT '',
            gemini_model TEXT DEFAULT 'gemini-2.5-flash',
            form_schema TEXT DEFAULT '',
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
            stdout TEXT DEFAULT '',
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
    # Migrate existing automations table — add new columns if missing
    with _conn() as con:
        auto_cols = [r[1] for r in con.execute("PRAGMA table_info(automations)").fetchall()]
        if 'code' not in auto_cols:
            con.execute("ALTER TABLE automations ADD COLUMN code TEXT DEFAULT ''")
        if 'schedule_cron' not in auto_cols:
            con.execute("ALTER TABLE automations ADD COLUMN schedule_cron TEXT DEFAULT '0 9 * * *'")
        if 'gemini_key' not in auto_cols:
            con.execute("ALTER TABLE automations ADD COLUMN gemini_key TEXT DEFAULT ''")
        if 'gemini_model' not in auto_cols:
            con.execute("ALTER TABLE automations ADD COLUMN gemini_model TEXT DEFAULT 'gemini-2.5-flash'")
        if 'form_schema' not in auto_cols:
            con.execute("ALTER TABLE automations ADD COLUMN form_schema TEXT DEFAULT ''")
        log_cols = [r[1] for r in con.execute("PRAGMA table_info(activity_log)").fetchall()]
        if 'stdout' not in log_cols:
            con.execute("ALTER TABLE activity_log ADD COLUMN stdout TEXT DEFAULT ''")
        if 'automation_id' not in log_cols:
            con.execute("ALTER TABLE activity_log ADD COLUMN automation_id TEXT DEFAULT ''")
        if 'automation_name' not in log_cols:
            con.execute("ALTER TABLE activity_log ADD COLUMN automation_name TEXT DEFAULT ''")
        if 'recipient_name' not in log_cols:
            con.execute("ALTER TABLE activity_log ADD COLUMN recipient_name TEXT DEFAULT ''")
        if 'recipient_phone' not in log_cols:
            con.execute("ALTER TABLE activity_log ADD COLUMN recipient_phone TEXT DEFAULT ''")
        if 'message_sent' not in log_cols:
            con.execute("ALTER TABLE activity_log ADD COLUMN message_sent TEXT DEFAULT ''")
        if 'image_sent' not in log_cols:
            con.execute("ALTER TABLE activity_log ADD COLUMN image_sent INTEGER DEFAULT 0")
        if 'status' not in log_cols:
            con.execute("ALTER TABLE activity_log ADD COLUMN status TEXT DEFAULT ''")
        if 'error' not in log_cols:
            con.execute("ALTER TABLE activity_log ADD COLUMN error TEXT DEFAULT ''")
        if 'sent_at' not in log_cols:
            con.execute("ALTER TABLE activity_log ADD COLUMN sent_at TEXT DEFAULT (datetime('now'))")

        # Two-way reply tracking columns on automation_data
        data_cols = [r[1] for r in con.execute("PRAGMA table_info(automation_data)").fetchall()]
        for col, ddl in [
            ("status",              "TEXT DEFAULT 'pending'"),
            ("last_sent_at",        "TEXT DEFAULT NULL"),
            ("last_sent_message",   "TEXT DEFAULT ''"),
            ("sent_message_history","TEXT DEFAULT '[]'"),
            ("reply_history",       "TEXT DEFAULT '[]'"),
            ("reply_text",          "TEXT DEFAULT ''"),
            ("reply_received_at",   "TEXT DEFAULT NULL"),
            ("reminder_count",      "INTEGER DEFAULT 0"),
            ("next_reminder_at",    "TEXT DEFAULT NULL"),
            ("urgency_snapshot",    "TEXT DEFAULT 'medium'"),
            ("phone_snapshot",      "TEXT DEFAULT ''"),
            ("promised_deadline",   "TEXT DEFAULT NULL"),
            ("promised_text",       "TEXT DEFAULT ''"),
            ("promise_history",     "TEXT DEFAULT '[]'"),
        ]:
            if col not in data_cols:
                con.execute(f"ALTER TABLE automation_data ADD COLUMN {col} {ddl}")
        con.execute(
            "CREATE INDEX IF NOT EXISTS idx_autodata_phone_status "
            "ON automation_data(phone_snapshot, status)"
        )
        con.execute(
            "UPDATE automation_data SET status='pending' WHERE status IS NULL OR status=''"
        )

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
    for list_field in ("sent_message_history", "reply_history", "promise_history"):
        if list_field in d and isinstance(d[list_field], str):
            try:
                parsed = json.loads(d[list_field])
                d[list_field] = parsed if isinstance(parsed, list) else []
            except Exception:
                d[list_field] = []
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
               whatsapp_instance, schedule, code, schedule_cron, gemini_key, gemini_model, form_schema, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
            payload.get("code", ""),
            payload.get("schedule_cron", "0 9 * * *"),
            payload.get("gemini_key", ""),
            payload.get("gemini_model", "gemini-2.5-flash"),
            payload.get("form_schema", ""),
            now,
        ))
    return get_automation(aid)

def update_automation(automation_id: str, payload: dict):
    with _conn() as con:
        con.execute("""
            UPDATE automations SET
              name=?, description=?, enabled=?, data_source=?, match_rule=?,
              use_image=?, image_template_url=?, image_prompt=?, message_template=?,
              whatsapp_instance=?, schedule=?, code=?, schedule_cron=?, gemini_key=?, gemini_model=?, form_schema=?
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
            payload.get("code", ""),
            payload.get("schedule_cron", "0 9 * * *"),
            payload.get("gemini_key", ""),
            payload.get("gemini_model", "gemini-2.5-flash"),
            payload.get("form_schema", ""),
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

# ── Two-way reply tracking helpers ────────────────────────────────────────────
from datetime import timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))
URGENCY_DAY_GAP = {"high": 1, "medium": 2, "low": 3}
BUSINESS_START_HOUR = 9
BUSINESS_END_HOUR = 20

def normalize_phone(raw: str) -> str:
    """Strip jid suffix, device id, non-digits, return last 10 digits."""
    if not raw:
        return ""
    s = str(raw).split("@")[0].split(":")[0]
    digits = "".join(c for c in s if c.isdigit())
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[2:]
    return digits[-10:]

def _clamp_business_hours(dt: datetime) -> datetime:
    """If dt falls outside 09:00–20:00 IST, shift to next 09:00 IST."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    ist = dt.astimezone(IST)
    if ist.hour < BUSINESS_START_HOUR:
        ist = ist.replace(hour=BUSINESS_START_HOUR, minute=0, second=0, microsecond=0)
    elif ist.hour >= BUSINESS_END_HOUR:
        ist = (ist + timedelta(days=1)).replace(
            hour=BUSINESS_START_HOUR, minute=0, second=0, microsecond=0
        )
    return ist.astimezone(timezone.utc)

def _compute_next_reminder(urgency: str) -> str:
    """now + urgency_days, clamped to business hours. Returns ISO UTC."""
    days = URGENCY_DAY_GAP.get((urgency or "medium").lower(), 2)
    target = datetime.now(timezone.utc) + timedelta(days=days)
    target = _clamp_business_hours(target)
    return target.strftime("%Y-%m-%d %H:%M:%S")

def _now_sqlite() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

def _parse_iso(s: str) -> datetime:
    """Parse ISO string. Leaves naive datetimes naive so callers can apply
    the right timezone (IST for promises, UTC for stored timestamps)."""
    if not s:
        return None
    try:
        if "T" in s:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
    except Exception:
        return None

def _json_list(raw) -> list:
    if isinstance(raw, list):
        return raw
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []

def mark_sent(data_id: str, message: str, urgency: str, phone: str):
    """Called after send_followup returns ok. Appends to history, sets awaiting_reply."""
    with _conn() as con:
        row = con.execute("SELECT * FROM automation_data WHERE id=?", (data_id,)).fetchone()
        if not row:
            return
        history = _json_list(row["sent_message_history"])
        history.append(message)
        new_count = (row["reminder_count"] or 0) + 1
        now = _now_sqlite()
        norm_phone = normalize_phone(phone)
        # Only compute default next_reminder_at if no live promise is set
        promised = row["promised_deadline"]
        if promised:
            next_at = None  # promise-based schedule takes priority, leave as-is
        else:
            next_at = _compute_next_reminder(urgency)
        if new_count >= 3:
            # Max attempts reached — stop future reminders
            new_status = "gave_up"
            next_at = None
        else:
            new_status = "awaiting_reply"
        if promised and new_count < 3:
            # Preserve existing next_reminder_at (set from promise)
            con.execute("""
                UPDATE automation_data SET
                  status=?, last_sent_at=?, last_sent_message=?,
                  sent_message_history=?, reminder_count=?,
                  phone_snapshot=?, urgency_snapshot=?
                WHERE id=?
            """, (new_status, now, message, json.dumps(history), new_count,
                  norm_phone, (urgency or "medium").lower(), data_id))
        else:
            con.execute("""
                UPDATE automation_data SET
                  status=?, last_sent_at=?, last_sent_message=?,
                  sent_message_history=?, reminder_count=?,
                  next_reminder_at=?, phone_snapshot=?, urgency_snapshot=?
                WHERE id=?
            """, (new_status, now, message, json.dumps(history), new_count,
                  next_at, norm_phone, (urgency or "medium").lower(), data_id))

def find_awaiting_row_by_phone(phone: str):
    """Find most recent row expecting a reply from this phone."""
    norm = normalize_phone(phone)
    if not norm:
        return None
    with _conn() as con:
        row = con.execute("""
            SELECT * FROM automation_data
            WHERE phone_snapshot=? AND status IN ('awaiting_reply','replied_deferred')
            ORDER BY last_sent_at DESC LIMIT 1
        """, (norm,)).fetchone()
        return _row_to_dict(row) if row else None

def mark_reply_received(data_id: str, text: str, verdict: str,
                        promised_deadline: str = None,
                        promised_text: str = None):
    """
    verdict ∈ {'replied_ok', 'replied_deferred', 'replied_insufficient', 'opted_out'}
    """
    with _conn() as con:
        row = con.execute("SELECT * FROM automation_data WHERE id=?", (data_id,)).fetchone()
        if not row:
            return
        reply_hist = _json_list(row["reply_history"])
        reply_hist.append(text)
        now = _now_sqlite()
        reminder_count = row["reminder_count"] or 0
        urgency = row["urgency_snapshot"] or "medium"

        if verdict == "replied_ok" or verdict == "opted_out":
            next_at = None
            new_promised = row["promised_deadline"]
            new_promised_text = row["promised_text"]
            promise_hist_json = row["promise_history"]
        elif verdict == "replied_deferred" and promised_deadline:
            # Save promise, set next_reminder_at = deadline + 30 min, clamp to business hours
            deadline_dt = _parse_iso(promised_deadline)
            if deadline_dt:
                # Gemini returns naive IST-intended times (prompt says "Current datetime (IST)"),
                # so naive values must be interpreted as IST, not UTC.
                if deadline_dt.tzinfo is None:
                    deadline_dt = deadline_dt.replace(tzinfo=IST)
                target = deadline_dt + timedelta(minutes=30)
                target = _clamp_business_hours(target)
                next_at = target.strftime("%Y-%m-%d %H:%M:%S")
            else:
                next_at = _compute_next_reminder(urgency)
            # Append to promise_history
            prom_hist = _json_list(row["promise_history"])
            prom_hist.append({
                "deadline": promised_deadline,
                "text": promised_text or text,
                "recorded_at": now,
            })
            promise_hist_json = json.dumps(prom_hist)
            new_promised = promised_deadline
            new_promised_text = promised_text or text
        else:
            # replied_insufficient — fall back to urgency interval
            if reminder_count >= 3:
                next_at = None
                verdict = "gave_up"
            else:
                next_at = _compute_next_reminder(urgency)
            new_promised = row["promised_deadline"]
            new_promised_text = row["promised_text"]
            promise_hist_json = row["promise_history"]

        con.execute("""
            UPDATE automation_data SET
              status=?, reply_text=?, reply_received_at=?, reply_history=?,
              next_reminder_at=?, promised_deadline=?, promised_text=?,
              promise_history=?
            WHERE id=?
        """, (verdict, text, now, json.dumps(reply_hist),
              next_at, new_promised, new_promised_text or "",
              promise_hist_json or "[]", data_id))

def list_due_reminders():
    """Rows where next_reminder_at has passed and count < 3."""
    with _conn() as con:
        rows = con.execute("""
            SELECT * FROM automation_data
            WHERE status IN ('sent','awaiting_reply','replied_insufficient','replied_deferred')
              AND next_reminder_at IS NOT NULL
              AND next_reminder_at <= datetime('now')
              AND reminder_count < 3
        """).fetchall()
        return [_row_to_dict(r) for r in rows]

# ── Activity Log ──────────────────────────────────────────────────────────────
def log_activity(automation_id: str, automation_name: str, recipient_name: str,
                 recipient_phone: str, message: str, image_sent: bool, status: str,
                 error: str = "", stdout: str = ""):
    lid = str(uuid.uuid4())
    with _conn() as con:
        con.execute("""
            INSERT INTO activity_log
              (id, automation_id, automation_name, recipient_name, recipient_phone,
               message_sent, image_sent, status, error, stdout)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (lid, automation_id, automation_name, recipient_name, recipient_phone,
              message, int(image_sent), status, error, stdout))

def list_activity(limit: int = 200):
    with _conn() as con:
        rows = con.execute("SELECT * FROM activity_log ORDER BY sent_at DESC LIMIT ?", (limit,)).fetchall()
        return [_row_to_dict(r) for r in rows]

def list_activity_for_automation(automation_id: str, limit: int = 50):
    with _conn() as con:
        rows = con.execute(
            "SELECT * FROM activity_log WHERE automation_id=? ORDER BY sent_at DESC LIMIT ?",
            (automation_id, limit)
        ).fetchall()
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
