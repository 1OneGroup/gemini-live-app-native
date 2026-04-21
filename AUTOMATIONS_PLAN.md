# WhatsApp Automations — Management Plan

**Date:** 2026-04-13
**Project:** gemini-live-app-native
**Goal:** Manage three WhatsApp automations (Birthday Wish, Vendor Followup, Payment Reminder) individually from the dashboard.

---

## Overview

Add three new automation pages to the existing `gemini-live-app-native` server (port 8100). Each automation will have its own:
- ON/OFF control
- Data (CSV upload + manual form entry)
- Message template
- Timing / schedule
- Activity log

The existing Evolution GO (port 4000) WhatsApp connection will be reused.

---

## Architecture

```
Dashboard (localhost:8100)
         │
         ▼
    server.js  ←──── REST APIs
         │
    ┌────┼───────────────────────┐
    │    │                       │
    ▼    ▼                       ▼
 data/   node-cron          Evolution GO
 *.json  (scheduler)        (WhatsApp send)
```

### Sidebar Structure
```
AUTOMATION
├── Employee Birthday Wish
├── Vendor Followup
└── Payment Reminder
```

---

## Data Storage

JSON files inside the `data/` folder (atomic writes):

```
data/
├── employees.json              ← birthday list
├── vendors.json                ← vendor list
├── payments.json               ← payment list
├── automation-settings.json    ← per-automation settings
└── activity-log.json           ← sent message logs
```

---

## Automation 1: Employee Birthday Wish

### Data Fields
- `name`
- `phone`
- `birthday` (DD-MM format)
- `department` (optional)
- `last_wished` (auto-updated)

### Controls
- ON/OFF toggle
- Time picker (what time the wish should go out daily, default 9:00 AM)
- Message template editor (variables: `{name}`, `{department}`)
- Test button (send a test wish to your own number)

### Logic
- Daily cron job runs at the configured time
- Match today's date against all employees
- On match → send WhatsApp wish → update `last_wished`
- Prevent duplicate wishes on the same day

### CSV Format
```
name,phone,birthday,department
Rahul Sharma,919876543210,15-08,Sales
```

### Table Columns
| Name | Phone | Birthday | Dept | Last Wished | Actions |

---

## Automation 2: Vendor Followup

### Data Fields
- `vendor_name`
- `company`
- `phone`
- `last_contact` (date)
- `interval_days` (per-vendor override possible)
- `status` (Active / Paused / Done)
- `notes`

### Controls
- ON/OFF toggle
- Default interval (global, e.g. 7 days)
- Message template (variables: `{vendor_name}`, `{company}`)
- "Send Now" button per row
- "Send to All Due" bulk button

### Logic
- Daily cron checks: `last_contact + interval_days <= today`
- Send WhatsApp message to every due vendor
- After sending, set `last_contact = today`
- Skip vendors with status "Paused" or "Done"

### CSV Format
```
vendor_name,company,phone,last_contact,interval_days,notes
Ramesh,ABC Traders,919876543210,2026-04-01,7,Monthly supplier
```

### Table Columns
| Vendor | Company | Phone | Last Contact | Next Due | Status | Actions |

---

## Automation 3: Payment Reminder

### Data Fields
- `client_name`
- `phone`
- `invoice` (optional)
- `amount`
- `due_date`
- `status` (Pending / Paid / Overdue)
- `notes`

### Controls
- ON/OFF toggle
- Reminder schedule (e.g. 7 days, 3 days, 1 day before + on the due date itself)
- Message template (variables: `{client}`, `{amount}`, `{due_date}`, `{invoice}`)
- "Mark as Paid" button per row
- "Send Now" manual button

### Logic
- Daily cron checks the due date of every pending payment
- If today falls in the reminder window → send reminder
- Once the due date has passed → mark as "Overdue" and use a different template
- Marking an entry as Paid stops further reminders

### Color Coding
- 🟢 Green — safe (due date far away)
- 🟡 Yellow — inside the reminder window
- 🔴 Red — overdue

### CSV Format
```
client_name,phone,invoice,amount,due_date,notes
XYZ Corp,919876543210,INV-001,50000,2026-05-15,Monthly retainer
```

### Table Columns
| Client | Phone | Invoice | Amount | Due Date | Days Left | Status | Actions |

---

## Shared Backend Components

### 1. JSON Storage Helper
- `readJSON(file)` / `writeJSON(file, data)` helpers
- Atomic write (temp file → rename)
- Crash-safe

### 2. Scheduler (node-cron)
One master cron job that checks all three automations at the user-set time (default 9:00 AM):
```
09:00 AM daily
   ├─→ Birthday check         (if ON)
   ├─→ Vendor followup check  (if ON)
   └─→ Payment reminder check (if ON)
```

### 3. CSV Upload
- Generic endpoint: `POST /api/automation/:type/upload`
- `multer` + `csv-parse`
- Validation (phone format, date format)
- Preview → confirm → save flow

### 4. WhatsApp Send (existing)
- Reuse the existing Evolution GO `/send/text` call
- Wrapper function: `sendWhatsApp(phone, message)`

### 5. Activity Log
- Every send is logged: `{timestamp, automation, to, message, status}`
- "Recent Activity" section on the dashboard
- Keep the last 500 entries (older ones truncated)

---

## Implementation Phases

### Phase 1 — Foundation
1. `data/` folder + JSON storage helper
2. `automation-settings.json` schema
3. Generic CSV upload handler
4. Activity log system
5. `node-cron` setup

### Phase 2 — Birthday Wish (refine existing)
1. Dashboard page (stats, toggle, template editor)
2. Add/Edit/Delete + CSV upload
3. Daily cron — birthday check + send
4. Test button

### Phase 3 — Vendor Followup
1. Dashboard page
2. CRUD + CSV
3. Followup logic (interval check)
4. "Send Now" per row + bulk

### Phase 4 — Payment Reminder
1. Dashboard page (with color coding)
2. CRUD + CSV
3. Reminder scheduling logic
4. Mark as Paid / Overdue handling

### Phase 5 — Polish
1. Activity log page
2. Error handling + retry on WhatsApp send failure
3. Backup button (download all JSON files)

---

## Dependencies to Add

```json
{
  "node-cron": "^3.0.3",
  "csv-parse": "^5.5.0",
  "multer": "^1.4.5"
}
```

---

## Success Criteria

- [ ] All three automations can be turned ON/OFF from the dashboard
- [ ] CSV upload imports data in bulk
- [ ] Manual form adds single entries
- [ ] Birthday wishes go out automatically at the correct time each day
- [ ] Vendor followups go out automatically when due, and manual send also works
- [ ] Payment reminders go out at the correct lead times, and overdue is handled
- [ ] Data survives server restarts (JSON persistence)
- [ ] All sent messages appear in the activity log
