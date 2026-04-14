# Gemini Live — Lead Call Classifier Dashboard

A locally-hosted web dashboard that fetches disqualified lead call recordings from Plivo, transcribes them with OpenAI Whisper, and classifies each lead as **Interested / Not Interested / Follow Up Later** using GPT-4o-mini.

---

## Folder Structure

```
gemini live/
├── server.js         — Express backend + all API endpoints
├── classifier.js     — GPT-4o-mini classification logic
├── transcriber.js    — OpenAI Whisper transcription logic
├── plivo.js          — Plivo REST API integration
├── leads.json        — Local JSON database
├── .env              — API keys (never commit this)
├── package.json
└── public/
    ├── index.html    — Dashboard UI
    ├── style.css     — Dark theme styling
    └── app.js        — Frontend JavaScript
```

---

## Setup

### 1. Prerequisites

- **Node.js** v18 or higher — [Download](https://nodejs.org)
- A **Plivo** account with call recordings enabled
- An **OpenAI** account with API access

### 2. Install Dependencies

Open a terminal in this folder and run:

```bash
npm install
```

### 3. Configure Environment Variables

Edit the `.env` file and fill in your API credentials:

```
PLIVO_AUTH_ID=your_plivo_auth_id
PLIVO_AUTH_TOKEN=your_plivo_auth_token
OPENAI_API_KEY=your_openai_api_key
PORT=3000
```

### 4. Run the Server

```bash
node server.js
```

Or, for auto-restart on file changes during development:

```bash
npm run dev
```

### 5. Open the Dashboard

Navigate to: **http://localhost:3000**

---

## How to Get API Credentials

### Plivo (Telephony)

1. Sign up at [plivo.com](https://www.plivo.com)
2. Go to **Console → Overview**
3. Copy your **Auth ID** and **Auth Token**
4. Ensure call recording is enabled on your numbers (Console → Phone Numbers → Settings → Record Calls)

### OpenAI

1. Sign up or log in at [platform.openai.com](https://platform.openai.com)
2. Go to **API Keys** and create a new key
3. Paste it as `OPENAI_API_KEY` in `.env`
4. Ensure you have credits available (Whisper and GPT-4o-mini are pay-per-use)

---

## Using the Dashboard

### Fetch New Calls
Click **Fetch New Calls** to pull the latest call recordings from Plivo. New calls are saved to `leads.json` with status `fetched`. Already-imported calls are automatically deduplicated.

### Process All New Calls
Click **Process All New Calls** to run the complete pipeline in one click:
1. Fetches any new calls from Plivo
2. Transcribes all untranscribed audio using Whisper
3. Classifies all unclassified transcripts using GPT-4o-mini

A real-time progress bar shows the status of each step.

### Per-Lead Actions
Each lead card supports:
- **Transcribe** — Transcribe the audio (shown if not yet transcribed)
- **View Transcript** — Opens the full transcript in a modal
- **Re-classify** — Re-runs AI classification on the existing transcript
- **Override** — Manually set the classification (INTERESTED / NOT INTERESTED / FOLLOW UP LATER)
- **Delete** — Permanently removes the lead

### Filtering and Search
- Click any **stat card** at the top or use the **filter buttons** to filter by classification
- Use the **search bar** to find leads by phone number, reason, or transcript keyword

---

## Lead Status Lifecycle

```
fetched → transcribed → classified
           ↓               ↓
    transcription_failed  classification_failed
```

Failed leads show a retry button. Leads with confidence below 60% are flagged as **Needs Review**.

---

## Classification Categories

| Badge | Meaning |
|-------|---------|
| **INTERESTED** (Green) | Lead showed genuine interest — asked about pricing, agreed to site visit, etc. |
| **NOT INTERESTED** (Red) | Lead clearly declined — bought elsewhere, explicitly said no, budget mismatch |
| **FOLLOW UP LATER** (Yellow) | Lead is open but not ready now — salary pending, busy, said "call me later" |
| **NEEDS REVIEW** (Purple) | AI confidence below 60% — human review recommended |

---

## Transcription Language Support

Whisper auto-detects Hindi, English, and Hinglish (mixed Hindi-English). No configuration needed — the language parameter is intentionally omitted to allow automatic detection. This produces the best results for Indian real estate sales calls.

---

## Cost Estimates (OpenAI)

| Service | Model | Price |
|---------|-------|-------|
| Transcription | whisper-1 | ~$0.006/minute of audio |
| Classification | gpt-4o-mini | ~$0.0001/1K tokens (~$0.0003 per call) |

A typical 3-minute call costs approximately **$0.02–$0.03** to process.

---

## Troubleshooting

**Server won't start:**
- Run `npm install` first
- Check that `.env` exists with all four variables filled in

**Plivo fetch returns 0 calls:**
- Verify your Auth ID and Auth Token are correct
- Ensure call recording is enabled on your Plivo numbers
- Check that calls have been made and recordings are available in Plivo Console

**Transcription fails:**
- Check that your OpenAI API key is valid and has credits
- Audio files larger than 25MB cannot be transcribed (calls over ~30 minutes)
- Check server console for detailed error messages

**Classification fails:**
- Ensure the OpenAI API key has access to `gpt-4o-mini`
- Check server console for API error details

**Dashboard shows blank page:**
- Ensure the server is running (`node server.js`)
- Open browser console (F12) for JavaScript errors
- Verify you're accessing `http://localhost:3000` (not https)
