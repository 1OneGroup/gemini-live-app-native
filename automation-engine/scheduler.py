from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = BackgroundScheduler()

BUSINESS_START_HOUR = 9
BUSINESS_END_HOUR = 20
IST = timezone(timedelta(hours=5, minutes=30))


def _job(automation_id: str):
    from engine.runner import run_automation
    print(f"[scheduler] running {automation_id}")
    result = run_automation(automation_id)
    print(f"[scheduler] result: {result}")


def _reminder_checker():
    """Every 15 min: find rows whose next_reminder_at has passed and send next reminder.
    Business hours guard: only fire between 09:00–20:00 IST."""
    now_ist = datetime.now(IST)
    if now_ist.hour < BUSINESS_START_HOUR or now_ist.hour >= BUSINESS_END_HOUR:
        print(f"[reminder_checker] outside business hours (IST {now_ist.strftime('%H:%M')}), skipping")
        return

    import db
    from engine.runner import run_code_automation_for_rows

    due = db.list_due_reminders()
    if not due:
        return
    print(f"[reminder_checker] {len(due)} rows due")

    by_auto = {}
    for r in due:
        by_auto.setdefault(r["automation_id"], []).append(r)

    for aid, rows in by_auto.items():
        auto = db.get_automation(aid)
        if not auto or not auto.get("enabled"):
            print(f"[reminder_checker] skipping disabled/missing automation {aid}")
            continue
        # runner._enrich_row expects raw db row dicts
        run_code_automation_for_rows(auto, rows)


def reload_jobs():
    """Clear user automation jobs (preserving internal jobs prefixed with __)."""
    from db import list_automations
    for job in scheduler.get_jobs():
        if job.id.startswith("__"):
            continue
        scheduler.remove_job(job.id)
    try:
        automations = list_automations()
    except Exception as exc:
        print(f"[scheduler] could not load automations: {exc}")
        return
    for auto in automations:
        if not auto.get("enabled"):
            continue
        cron_expr = auto.get("schedule_cron", "").strip()
        if not cron_expr:
            sched = auto.get("schedule") or {}
            time_str = sched.get("time", "09:00")
            try:
                hour, minute = map(int, time_str.split(":"))
            except Exception:
                hour, minute = 9, 0
            trigger = CronTrigger(hour=hour, minute=minute)
        else:
            try:
                trigger = CronTrigger.from_crontab(cron_expr)
            except Exception as exc:
                print(f"[scheduler] invalid cron '{cron_expr}' for {auto['name']}: {exc}")
                continue
        scheduler.add_job(
            _job,
            trigger,
            args=[auto["id"]],
            id=auto["id"],
            replace_existing=True,
        )
        print(f"[scheduler] registered {auto['name']} @ {cron_expr or 'legacy'}")


def start_scheduler():
    reload_jobs()
    # Internal reminder tick job — runs every 15 min, business hours only
    scheduler.add_job(
        _reminder_checker,
        CronTrigger(minute="*/15"),
        id="__reminder_checker__",
        replace_existing=True,
    )
    print("[scheduler] registered __reminder_checker__ (*/15 min)")
    scheduler.start()
