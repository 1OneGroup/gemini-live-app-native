Configuration module providing API keys, environment variables, Gemini models, and shared application constants.

## Files

| File | Exports | Purpose |
|---|---|---|
| constants.js | USD_INR, MAX_RECONNECTIONS, goodbyePhrases | Application-wide constants for exchange rates, reconnection limits, and auto-hangup triggers. |
| env.js | GEMINI_API_KEY, GEMINI_MODEL, OPENROUTER_API_KEY, PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, PLIVO_FROM_NUMBER, PUBLIC_URL, EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE, DATABASE_URL, CLASSIFIER_DASHBOARD_URL, PORT, DATA_DIR | Validated environment variable accessors loaded from .env; single point of access for all external service credentials and configuration. |
| models.js | GEMINI_MODELS, getActiveModel, setActiveModel | Gemini model registry with pricing data and runtime model-override persistence to survive restarts. |

## Imported by

- src/index.js
- src/lib/pricing.js
- src/plivo/outbound.js
- src/gemini/session.js
- src/gemini/message-handler.js
