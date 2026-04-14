from datetime import date
from db import get_automation, log_activity, mark_data_processed
from engine.data_sources import load_data
from engine.match_rules import matches
from engine.template import render
from whatsapp import send_text, send_media
from gemini_image import personalize_image

def run_automation(automation_id: str) -> dict:
    """Execute an automation. Returns summary dict."""
    try:
        auto = get_automation(automation_id)
    except Exception as exc:
        return {"ok": False, "reason": str(exc)}

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
        # Support multiple possible phone/name field names
        phone = (row.get("phone") or row.get("mobile") or row.get("whatsapp")
                 or row.get("mobile_no.") or row.get("mobile_no") or row.get("contact") or "")
        name = (row.get("name") or row.get("employee_name") or row.get("client_name")
                or row.get("vendor_name") or row.get("customer_name") or "")

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
