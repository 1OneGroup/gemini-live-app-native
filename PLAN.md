# Gemini Live + WhatsApp Automation — Project Plan

## System Overview

Ek local Node.js server (`localhost:8100`) jo do cheezein karta hai:
1. **Voice AI Calling** — Gemini Live AI + Plivo (phone calls)
2. **WhatsApp Automation** — Evolution GO se WhatsApp messages

---

## Architecture

```
Browser (localhost:8100/dashboard)
         │
         ▼
    server.js  ←──── REST APIs
         │
    ┌────┴─────────────────┐
    │                      │
db.js (in-memory)    Evolution GO
(campaigns, leads,   (localhost:4000)
 prompts, contacts)  WhatsApp instance
         │
    call-store.js
    (call recordings,
     transcripts, outcomes)
```

---

## Steps — Kese Bana

### Step 1 — Server Locally Chalana
- **Problem:** `better-sqlite3` install nahi hua (Visual Studio C++ compiler chahiye tha)
- **Fix:** SQLite hataya, pure JavaScript Maps se replace kiya (`db.js`)
- **Result:** Server `localhost:8100` pe chalne laga ✅

### Step 2 — WhatsApp Section (Sidebar)
- Sidebar mein alag **WhatsApp** section add kiya
- Pages: Send Message, Messages Config, WA Settings

### Step 3 — WA Settings Page
- Evolution GO ka URL, API Key, Instance Name configure karne ke liye page
- **Test Connection** button — green/red status dikhata hai
- Connected number dikhata hai (919217713083)

### Step 4 — Test Connection Fix
- **Problem:** Instance token se `/instance/all` nahi chalta
- **Fix:** Pehle user ki key try karo, fail ho toh `.env` wali global key fallback mein use karo

### Step 5 — Website Leads CRM
- Stats cards: All Leads, New, Contacted, Converted, Ignored
- Auto-Send WhatsApp toggle + message template
- Webhook URL (website se leads receive karne ke liye)
- Contacts table: Name, Phone, Email, Source, Message, Page URL, IP, Status, Date, WA status, Actions
- Lead status dropdown: New → Contacted → Converted / Ignored
- Send WA button per lead, Delete button

---

## How Connections Work

### Evolution GO Connection
```
Our Server (localhost:8100)
      │
      ├── GET /instance/all  ← Global API Key
      │   returns: instance list, token, jid, connected status
      │
      └── POST /send/text    ← Instance Token
          sends: WhatsApp message to phone number
```

**2 alag keys:**
| Key | Kaam |
|---|---|
| Global API Key (`sua-chave-api-segura-aqui`) | `/instance/all` ke liye — list dekhna |
| Instance Token (`0cdbfd03-...`) | `/send/text` ke liye — message bhejna |

### Dashboard Connection
```
Sidebar click → navigate('website')
      │
      ├── Saare pages hide
      ├── page-website show
      └── loadWebsite() call
              │
              └── fetch('/api/website-leads')
                       │
                       └── server.js → db.listWebsiteLeads()
```

### Website Lead Flow
```
1. Visitor fills form on website
2. Website → POST /api/website-leads → { name, phone, email, source, message, pageUrl, ipAddress }
3. server.js → db.createWebsiteLead() → RAM mein save
4. Auto-Send ON? → YES → Evolution GO → WhatsApp to lead
5. Dashboard table mein dikhta hai
6. Status: New → Contacted → Converted
```

---

## Key Files

| File | Kaam |
|---|---|
| `server.js` | All API routes + HTTP server |
| `dashboard.js` | Poora UI (single HTML string) |
| `db.js` | In-memory data store (campaigns, leads, prompts) |
| `call-store.js` | Per-call JSON files in `/data` folder |
| `.env` | Evolution GO config, ports, API keys |
| `prompts.js` | Default AI calling script |
| `batch-engine.js` | Bulk calling logic |

---

## API Endpoints

| Endpoint | Method | Kaam |
|---|---|---|
| `/api/whatsapp/status` | GET | WhatsApp connected hai ya nahi |
| `/api/whatsapp/send` | POST | Manually message bhejo |
| `/api/evo/test` | POST | Connection test karo |
| `/api/evo/config` | GET | Current Evolution config dekho |
| `/api/website-leads` | GET | Saare leads lao |
| `/api/website-leads` | POST | Naya lead add karo (webhook) |
| `/api/website-leads/:id` | PATCH | Lead update karo |
| `/api/website-leads/:id` | DELETE | Lead delete karo |
| `/api/website-leads/:id/send-wa` | POST | Specific lead ko WA bhejo |
| `/api/website-settings` | POST | Auto-send settings save karo |

---

## .env Configuration

```env
GEMINI_API_KEY=dummy_key_for_local_test
PLIVO_AUTH_ID=dummy_plivo_id
PLIVO_AUTH_TOKEN=dummy_plivo_token
PLIVO_FROM_NUMBER=+1234567890
PUBLIC_URL=http://localhost:8100
PORT=8100
DATA_DIR=./data
EVOLUTION_API_URL=http://localhost:4000
EVOLUTION_API_KEY=sua-chave-api-segura-aqui
EVOLUTION_INSTANCE=test-instance
```

---

## Dashboard Sections

### OVERVIEW
| Section | Kaam |
|---|---|
| Campaigns | Bulk calling campaigns banao, contacts upload karo |
| Calls | Saare calls ki history, transcript, duration |
| Analytics | Campaign performance, outcomes chart |

### SETTINGS
| Section | Kaam |
|---|---|
| Prompt Library | AI ke liye scripts/prompts manage karo |
| Settings | Gemini Live general settings |

### WHATSAPP
| Section | Kaam |
|---|---|
| Send Message | Manually kisi ko bhi WA message bhejo |
| Messages Config | Brochure templates manage karo |
| WA Settings | Evolution GO configure karo |
| Website Leads | Website se aane wale leads ka CRM |

---

## Server Start Command

```bash
node --env-file=.env server.js
```

---

## Pending / Next Steps

| Feature | Status |
|---|---|
| Website leads persistent storage (restart pe data reset hota hai) | ❌ |
| Real calling (Plivo credentials chahiye) | ❌ |
| Email auto-send on new lead | ❌ |
| WhatsApp chatbot flow | ❌ |
| VPS pe deploy karna | ❌ |
