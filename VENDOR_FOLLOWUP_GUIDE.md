# Vendor Follow-up Automation — Complete Guide

## Overview

Vendor Follow-up ek **AI-powered two-way WhatsApp follow-up system** hai jo automatically vendors ko follow-up messages bhejta hai, unke replies padhta hai, aur intelligent conversation handle karta hai — bina kisi manual kaam ke.

---

## How to Use (Step by Step)

### Step 1 — Form Fill Karo

1. Dashboard → **Automation** → **Vendor Follow-up** → **Data Rows** tab
2. **Open Form** button click karo
3. Fill karo:
   - **Vendor Name** — company ya person ka naam
   - **Email** — vendor ka email
   - **Phone Number** — WhatsApp number (e.g. `918877224160`)
   - **Follow-up Reason** — kya mangna hai (e.g. "Invoice INV-2058 payment pending")
   - **Urgency** — High / Medium / Low
4. Submit karo → vendor turant list mein aa jayega

### Step 2 — Automation Khud Chalti Hai

Form submit hote hi system:
- Gemini se professional WhatsApp message banata hai
- Vendor ke number pe turant bhejta hai
- Status `awaiting_reply` set ho jaata hai
- Next reminder schedule ho jaata hai

### Step 3 — Reply Aane Pe Khud Handle Karta Hai

Vendor jo bhi reply kare — system samjhega aur turant jawab dega.

---

## System Flow — Pura Process

```
Form Submit
    ↓
Gemini → Message Generate (Attempt #1 — Polite)
    ↓
WhatsApp pe Bheja
    ↓
Status: awaiting_reply
Next Reminder: schedule (High=1 din, Medium=2 din, Low=3 din)
    ↓
Vendor Reply Aaya?
    ├── ✅ "ho gaya" / "sent ref 1234"   → replied_ok  → Thank-you message → STOP
    ├── 🕐 "kal tak kar dunga"           → replied_deferred → Deadline save → Reminder at deadline+30min
    ├── ⚠️  "ok" / "busy hun"            → replied_insufficient → Default gap pe reminder
    └── 🚫 "band karo" / "stop"          → opted_out → STOP forever
    
No Reply?
    ↓
Next Reminder Time Aane Pe → Attempt #2 (Firm tone)
    ↓
Still No Reply?
    ↓
Attempt #3 (Final Notice — broken promises mention)
    ↓
3 attempts ke baad → gave_up → STOP
```

---

## Message Escalation — 3 Tiers

System automatically tone change karta hai har attempt pe:

| Attempt | Label | Tone | Length | Approach |
|---------|-------|------|--------|----------|
| **#1** | 🔴 URGENT FOLLOW-UP | Polite, warm | 3–4 lines | Gentle check-in, confidence dikhao |
| **#2** | 🔴 REMINDER — Response Needed | Firm, concerned | 4–5 lines | Pehla message mention karo, business impact batao, specific update maango |
| **#3** | ⚠️ FINAL NOTICE | Urgent, assertive | 5–6 lines | Last reminder, escalation warning, immediate confirmation maango |

**Anti-repeat guarantee:** Attempt #2 aur #3 ke prompt mein pehle ke saare messages diye jaate hain aur Gemini ko explicitly bola jaata hai — "Do NOT repeat phrasing from previous messages."

---

## Reply Classification — Kya Sufficient Hai?

Gemini strict rules se decide karta hai:

### ✅ Sufficient (replied_ok) — Follow-up BAND
Reply sufficient tabhi maana jaata hai jab **teeno** conditions hon:
1. Explicit commitment verb — "kar diya", "done", "sent", "processed", "ho gaya"
2. Specific reference ya completion — ya toh time diya ("aaj sham tak") ya kaam complete ("payment sent ref 1234")
3. Koi question ya deflection nahi

| Reply | Result |
|-------|--------|
| "payment sent, ref UTR12345" | ✅ Done |
| "ho gaya bhai" | ✅ Done |
| "done, check karlo" | ✅ Done |
| "ok" | ⚠️ Insufficient |
| "theek hai" | ⚠️ Insufficient |
| "kar dunga" | ⚠️ Insufficient (no timeline) |
| "kitna amount?" | ⚠️ Insufficient (question back) |
| "busy hun" | ⚠️ Insufficient |

### 🕐 Promised Deadline (replied_deferred)
Agar vendor ne specific time diya:

| Reply | Saved Deadline | Next Reminder |
|-------|----------------|---------------|
| "aaj sham tak" | Today 18:00 | Today 18:30 |
| "kal tak" | Tomorrow 18:00 | Tomorrow 18:30 |
| "3 din baad" | +3 days 18:00 | +3 days 18:30 |
| "Monday morning" | Next Monday 10:00 | Next Monday 10:30 |
| "2 ghante me" | Now + 2 hrs | Now + 2.5 hrs |

**Default time mapping:**
- subah / morning → 10:00
- dopahar / afternoon → 14:00
- sham / evening → 18:00
- raat / night → 20:00
- sirf din diya, time nahi → 18:00

---

## Instant Auto-Reply — Har Reply Pe Turant Jawab

Jab bhi vendor reply kare, system **turant** Gemini-generated contextual reply bhejta hai:

| Vendor ka reply | System ka auto-reply |
|-----------------|----------------------|
| "payment sent ref 1234" | "Shukriya! Payment reference note kar li. Koi follow-up nahi aayega. ✅" |
| "kal tak kar dunga" | "Got it! Kal 6 baje tak ka note kar liya. Confirmation nahi mila toh follow-up karenge." |
| "I will send it already" | "Thanks! Exactly kab tak bhejoge? Please specific timeline share karo." |
| "band karo" | "Understood. Removed from list. No further messages." |

Reply **vendor ki language** (Hinglish/English) mein hoti hai aur unke exact words reference karta hai.

---

## Promise Tracking — Broken Promises Record

Agar vendor ne deadline di aur fulfill nahi ki:

1. Promise `promise_history` mein save hoti hai
2. Jab deadline pass hoti hai, scheduler next reminder bhejta hai
3. Gemini ko **puri history** di jaati hai — vendor ke sare broken promises
4. Attempt #3 mein Gemini explicitly unhe call out karta hai:

> *"Avinash bhai, aapne 14 April ko kaha tha 'kal tak kar dunga', phir 15 April ko 'aaj sham tak' — dono baar deadline pass ho gayi aur koi update nahi mila. Ye final reminder hai..."*

---

## Scheduler — Automatic Timing

**Har 15 minute** mein ek background job chalti hai jo check karti hai:
- Koi row hai jiska `next_reminder_at` pass ho gaya?
- Agar haan → message bhejo (agar business hours mein ho)

### Business Hours Guard
Messages sirf **09:00 – 20:00 IST** ke beech bheje jaate hain.

Agar reminder time raat ko pade (e.g. 23:00) → automatically **next din 09:00** pe shift ho jaata hai.

### Urgency-based Gaps
| Urgency | Gap Between Reminders |
|---------|----------------------|
| High | 1 din |
| Medium | 2 din |
| Low | 3 din |

---

## Data Rows — Status Meanings

| Status | Matlab |
|--------|--------|
| ⏳ Pending | Abhi tak message nahi gaya |
| 📤 Sent | Message bheja gaya |
| ⏰ Awaiting Reply | Message gaya, reply ka wait |
| ✅ Done ✓ | Vendor ne confirm kar diya — CLOSED |
| 🕐 Promised Time | Vendor ne deadline di, wait kar rahe hain |
| ⚠️ Needs Follow-up | Reply aaya but insufficient, reminder pending |
| ❌ Gave Up | 3 attempts ke baad bhi no response |
| 🚫 Opted Out | Vendor ne "stop" kaha — permanently removed |

---

## Opt-out Keywords

Ye words likhne pe vendor ko **permanently** list se hata diya jaata hai:
- `stop`
- `band karo` / `band kar`
- `unsubscribe`
- `remove me`
- `mat bhejo`

---

## Technical Architecture

```
[Evolution GO Docker :5000]
        ↓ webhook (every message)
[Python FastAPI :5001 /api/wa-webhook]
        ↓
[Reply Classifier (Gemini)]
        ├── extract_deadline()    — specific time detect karo
        ├── classify_reply()      — sufficient/insufficient
        └── is_optout()           — stop words check
        ↓
[DB Update — automation_data]
        ↓
[Instant Auto-Reply → send_text()]

[APScheduler every 15min]
        ↓
[list_due_reminders()]
        ↓
[run_code_automation_for_rows()]
        ↓
[build_followup_message(row)]    — tier + history aware Gemini prompt
        ↓
[send_followup(row, message)]    — WhatsApp + DB tracking
```

### Key Files
| File | Kaam |
|------|------|
| `automation-engine/main.py` | API routes + webhook handler |
| `automation-engine/db.py` | Database + tracking helpers |
| `automation-engine/scheduler.py` | 15-min reminder job |
| `automation-engine/engine/runner.py` | `build_followup_message`, `send_followup` |
| `automation-engine/engine/message_builder.py` | 3-tier Gemini prompt builder |
| `automation-engine/engine/reply_classifier.py` | `extract_deadline`, `classify_reply`, `is_optout` |
| `automation-engine/whatsapp.py` | Evolution GO API calls |

---

## Limits & Rules

- **Max 3 attempts** per vendor (1 original + 2 reminders)
- **Max 1 message per vendor per day**
- **Only 09:00–20:00 IST** mein messages
- Short replies (≤3 words like "ok", "haan") → automatically insufficient (Gemini call bhi nahi hoti)
- Agar Gemini fail ho → fallback hardcoded message bheja jaata hai (system kabhi silent nahi rehta)

---

## Starting the System

```bat
# start.bat chalao — dono servers start ho jaate hain
start.bat
```

- **Node dashboard** → http://localhost:8100
- **Python API** → http://localhost:5001
- **Evolution GO** → http://localhost:5000 (Docker)
