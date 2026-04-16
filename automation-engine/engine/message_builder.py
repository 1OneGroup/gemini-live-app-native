"""Tier-based Gemini prompt builder for escalating follow-up messages."""

TIER_CONFIG = {
    0: {
        "label": "\U0001F534 URGENT FOLLOW-UP",
        "tone": "polite, warm, professional",
        "length": "3 to 4 sentences",
        "angle": (
            "Introduce the topic as a gentle check-in. Express confidence "
            "that the vendor will cooperate. Do not sound accusatory. "
            "End with a clear but soft call-to-action."
        ),
    },
    1: {
        "label": "\U0001F534 REMINDER \u2014 Response Needed",
        "tone": "firm but still respectful, slightly concerned",
        "length": "4 to 5 sentences",
        "angle": (
            "Acknowledge that the first message has not been resolved. "
            "Mention that this is time-sensitive and there is business impact. "
            "Ask for a specific update (status + expected resolution time). "
            "Do NOT repeat phrasing from any earlier message."
        ),
    },
    2: {
        "label": "\u26A0\uFE0F FINAL NOTICE",
        "tone": "urgent, assertive, professional \u2014 not rude",
        "length": "5 to 6 sentences",
        "angle": (
            "State clearly this is the final reminder. Outline the next step "
            "if there is still no response (escalation to management, service "
            "hold, or formal notice). Request immediate confirmation today. "
            "Keep the language professional \u2014 persuasive, not threatening. "
            "Do NOT repeat phrasing from any earlier message."
        ),
    },
}


def build_prompt(vendor_name: str, reason: str, urgency: str,
                 reminder_count: int, sent_history: list,
                 reply_history: list, promise_history: list):
    """Returns (prompt_string, tier_label)."""
    tier = TIER_CONFIG.get(min(reminder_count, 2), TIER_CONFIG[0])
    history_block = ""

    if sent_history:
        history_block += "\nPreviously sent messages (do NOT repeat their wording):\n"
        for i, m in enumerate(sent_history, 1):
            history_block += f"[Message {i}]: {m}\n"

    if reply_history:
        history_block += "\nVendor's previous replies:\n"
        for i, r in enumerate(reply_history, 1):
            history_block += f"[Reply {i}]: {r}\n"

    if promise_history:
        history_block += "\nVendor's past promises (ALL BROKEN \u2014 none fulfilled):\n"
        for i, p in enumerate(promise_history, 1):
            deadline = p.get("deadline", "unknown")
            text = p.get("text", "")
            recorded = p.get("recorded_at", "")
            history_block += (
                f"[Promise {i}]: On {recorded}, vendor said \"{text}\" \u2014 "
                f"committed deadline was {deadline}, but the task was NOT "
                f"completed by then.\n"
            )
        history_block += (
            "\nCRITICAL: The vendor has a track record of missed commitments. "
            "In your new message:\n"
            "(a) Directly quote or paraphrase their earlier promise(s).\n"
            "(b) Firmly point out that the committed deadline(s) passed without completion.\n"
            "(c) Ask why the commitment was not honored.\n"
            "(d) Request a new, verifiable confirmation \u2014 NOT another vague promise.\n"
            "Be professional but make it clear this pattern is unacceptable.\n"
        )
    elif reply_history:
        history_block += (
            "\nIMPORTANT: The vendor already replied but it was insufficient "
            "(question, deflection, or vague). In your new message:\n"
            "(a) Briefly acknowledge what they said.\n"
            "(b) Directly address their deflection or question.\n"
            "(c) Re-anchor the original ask with a specific call-to-action.\n"
        )

    prompt = (
        f"You are writing a WhatsApp follow-up message body to a vendor.\n\n"
        f"Context:\n"
        f"- Vendor: {vendor_name}\n"
        f"- Topic: {reason}\n"
        f"- Urgency: {urgency}\n"
        f"- This is attempt #{reminder_count + 1} of 3\n"
        f"- Tier: {tier['label']}\n\n"
        f"Requirements:\n"
        f"- Tone: {tier['tone']}\n"
        f"- Length: {tier['length']}\n"
        f"- Approach: {tier['angle']}\n"
        f"- Plain text only \u2014 no markdown, no bullet points, no options.\n"
        f"- Do NOT include 'Hi <name>' / 'Dear <name>' / signature \u2014 body only.\n"
        f"{history_block}\n"
        f"Output ONLY the message body, nothing else."
    )
    return prompt, tier["label"]
