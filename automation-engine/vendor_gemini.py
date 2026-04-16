"""Gemini-powered message generation for vendor follow-ups."""
import os
import json
import requests

def generate_vendor_messages(vendor_name: str, company: str, reason: str,
                              urgency: str, notes: str) -> dict:
    """Returns {"whatsapp": "...", "email_subject": "...", "email_body": "..."}"""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return _fallback(vendor_name, company, reason, urgency)

    urgency_text = {"high": "very urgent", "medium": "moderately urgent", "low": "when convenient"}.get(urgency, "moderately urgent")

    prompt = f"""You are a professional business communication assistant. Generate follow-up messages for a vendor.

Vendor Name: {vendor_name}
Company: {company}
Follow-up Reason: {reason}
Urgency: {urgency_text}
Additional Notes: {notes}

Generate TWO messages:
1. A WhatsApp message (conversational, professional, 2-4 lines, include urgency appropriately)
2. An email (formal, with subject line)

Respond ONLY with valid JSON in this exact format:
{{
  "whatsapp": "the whatsapp message here",
  "email_subject": "the email subject here",
  "email_body": "the email body here"
}}"""

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        resp = requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=15)
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        # Extract JSON from response
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except Exception as e:
        return _fallback(vendor_name, company, reason, urgency)

def _fallback(vendor_name, company, reason, urgency):
    return {
        "whatsapp": f"Hi {vendor_name}, this is a follow-up regarding {reason} for {company}. Please share the details at your earliest convenience. Thank you.",
        "email_subject": f"Follow-up: {reason} - {company}",
        "email_body": f"Dear {vendor_name},\n\nThis is a follow-up regarding {reason}.\n\nPlease share the required information at your earliest convenience.\n\nBest regards"
    }
