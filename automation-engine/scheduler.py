from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = BackgroundScheduler()

def _job(automation_id: str):
    from engine.runner import run_automation
    print(f"[scheduler] running {automation_id}")
    result = run_automation(automation_id)
    print(f"[scheduler] result: {result}")

def reload_jobs():
    """Clear and reload all jobs from current automation configs in Supabase."""
    from db import list_automations
    for job in scheduler.get_jobs():
        scheduler.remove_job(job.id)
    try:
        automations = list_automations()
    except Exception as exc:
        print(f"[scheduler] could not load automations: {exc}")
        return
    for auto in automations:
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
