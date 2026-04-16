"""Reply classifier: opt-out detection, deadline extraction, sufficiency verdict."""
import json
import re

OPTOUT_WORDS = {
    "stop", "unsubscribe", "remove me", "do not message",
    "band karo", "band kar", "mat bhejo", "mat bhej",
}


def is_optout(text: str) -> bool:
    t = (text or "").lower().strip()
    return any(w in t for w in OPTOUT_WORDS)


def _gemini_for_auto(auto: dict):
    """Build a gemini callable configured with the automation's keys."""
    import db as _db
    from engine.runner import make_gemini_fn
    key = (auto.get("gemini_key") or "").strip() or _db.get_setting("gemini_api_key", "")
    model = (auto.get("gemini_model") or "").strip() or "gemini-2.5-flash"
    return make_gemini_fn(key, model)


def extract_deadline(auto: dict, reply_text: str, now_iso: str) -> dict:
    """
    Ask Gemini to detect a specific deadline in the vendor's reply.
    Returns {'has_deadline': bool, 'deadline_iso': str|None, 'raw_text': str}.
    """
    reply_text = (reply_text or "").strip()
    if not reply_text:
        return {"has_deadline": False, "deadline_iso": None, "raw_text": ""}

    prompt = (
        "You are a deadline extractor for vendor follow-up replies.\n\n"
        f"Current datetime (IST): {now_iso}\n\n"
        f"Vendor reply:\n{reply_text}\n\n"
        "Task: Check if the vendor gave a SPECIFIC timeline or deadline for "
        "completing a task. Examples of specific timelines:\n"
        "- 'aaj sham tak' -> today 18:00\n"
        "- 'kal tak' -> tomorrow 18:00\n"
        "- '3 din baad' -> 3 days from now at 18:00\n"
        "- 'Monday morning' -> next Monday 10:00\n"
        "- '2 ghante me' -> now + 2 hours\n"
        "- 'by 5pm today' -> today 17:00\n\n"
        "Vague or missing timelines (return has_deadline: false):\n"
        "- 'jaldi kar dunga' (no specific time)\n"
        "- 'busy hun' (no commitment)\n"
        "- 'ok' (no timeline)\n"
        "- 'baad mein' (vague)\n\n"
        "Default time-of-day mapping if day given without time:\n"
        "- morning/subah -> 10:00\n"
        "- afternoon/dopahar -> 14:00\n"
        "- evening/sham -> 18:00\n"
        "- night/raat -> 20:00\n"
        "- no time at all -> 18:00\n\n"
        "Output ONLY a JSON object on a single line, no markdown, no prose:\n"
        '{"has_deadline": true, "deadline_iso": "2026-04-15T18:00:00", "raw_text": "aaj sham tak"}\n'
        "OR\n"
        '{"has_deadline": false, "deadline_iso": null, "raw_text": ""}'
    )

    try:
        gemini = _gemini_for_auto(auto)
        out = gemini(prompt).strip()
        # Extract JSON (Gemini sometimes wraps in ```json blocks despite system prompt)
        if "```" in out:
            m = re.search(r"\{[^}]+\}", out)
            if m:
                out = m.group(0)
        parsed = json.loads(out)
        if isinstance(parsed, dict) and parsed.get("has_deadline"):
            return {
                "has_deadline": True,
                "deadline_iso": parsed.get("deadline_iso"),
                "raw_text": parsed.get("raw_text") or reply_text,
            }
    except Exception:
        pass
    return {"has_deadline": False, "deadline_iso": None, "raw_text": ""}


def classify_reply(auto: dict, sent_msg: str, reply_text: str) -> str:
    """
    Strict sufficiency classifier.
    Returns 'replied_ok' or 'replied_insufficient'.
    """
    if not reply_text:
        return "replied_insufficient"
    # Short-circuit: 1-3 word replies never count as sufficient
    if len(reply_text.strip().split()) <= 3:
        return "replied_insufficient"

    prompt = (
        "You are a strict reply classifier for a vendor follow-up system. "
        "Decide whether a vendor's WhatsApp reply is SUFFICIENT to stop reminders.\n\n"

        "A reply is SUFFICIENT only if ALL of these are true:\n"
        "1. It contains an explicit commitment verb (will do / kar dunga / "
        "done / processed / sent / settled / bhej diya / ho gaya) OR states "
        "the task is already complete.\n"
        "2. It contains either a specific timeline (aaj / kal / tomorrow / "
        "by <time> / in <X hours>) OR a concrete confirmation that the "
        "action is complete (done / processed / sent with reference etc.)\n"
        "3. It does NOT contain an open question or a request for more info.\n\n"

        "A reply is INSUFFICIENT if ANY of these are true:\n"
        "- It is just 'ok' / 'theek hai' / 'samjh gaya' / 'haan' (bare acknowledgment).\n"
        "- It commits without a timeline ('kar dunga' with no 'kab').\n"
        "- It asks a question back or requests more info.\n"
        "- It postpones vaguely ('busy hun', 'baad mein', 'thoda time lagega').\n"
        "- It deflects or blames.\n\n"

        "Examples:\n"
        "Reply: 'ok' -> NO\n"
        "Reply: 'theek hai' -> NO\n"
        "Reply: 'ok kar dunga' -> NO (no timeline)\n"
        "Reply: 'aaj sham tak ho jayega' -> YES\n"
        "Reply: 'payment sent, ref #12345' -> YES\n"
        "Reply: 'kitna amount?' -> NO (question back)\n"
        "Reply: 'busy hun' -> NO\n"
        "Reply: 'kal 11 baje tak pakka' -> YES\n\n"

        f"Original follow-up sent:\n{sent_msg}\n\n"
        f"Vendor's reply:\n{reply_text}\n\n"
        "Answer with a single word: YES or NO. Default to NO if unsure."
    )

    try:
        gemini = _gemini_for_auto(auto)
        out = gemini(prompt).strip().upper()
        return "replied_ok" if out.startswith("Y") else "replied_insufficient"
    except Exception:
        return "replied_insufficient"
