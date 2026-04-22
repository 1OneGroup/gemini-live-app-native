# src/config/

Static configuration and environment setup — API keys, model names, feature flags, port numbers, and constants.

## Files

- `env.js` — Load and validate `process.env.*` vars; export normalized config object
- `models.js` — Gemini model name, DeepSeek model name, pricing constants
- `constants.js` — Magic numbers and fixed config (retry limits, timeout seconds, regex patterns)

> **Status:** placeholder — will be populated in Phase 2. See /home/office/.claude/plans/swift-percolating-teapot.md for the full refactor plan.
