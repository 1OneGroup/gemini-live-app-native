# gemini-live-app-native

AI-powered outbound calling platform — Plivo PSTN bridge with Gemini Live voice, post-call DeepSeek analysis, WhatsApp brochure distribution, and a campaign manager dashboard.

## Quick start

**With Docker (recommended for production):**
```bash
docker compose up -d --build
# App runs on http://localhost:8100
```

**Local development:**
```bash
cp .env.example .env
# Edit .env with your API keys
npm install
npm start
# App runs on http://localhost:8100
```

## Architecture

See [CLAUDE.md](CLAUDE.md) for:
- Data flow diagram (Plivo → Gemini Live → WhatsApp/DeepSeek)
- File map and refactor status
- Full environment variable reference

## Design notes & implementation plans

See `docs/` for:
- `refactor-baseline.txt` — pre-refactor behavior snapshot
- `dashboard-baseline.html` — dashboard UI snapshot

## Health check

```bash
curl http://localhost:8100/health
# Response: {"status":"ok","sessions":0,"pending":0,"activeSessions":[]}
```
