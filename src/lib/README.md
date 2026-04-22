# src/lib/

Shared utility functions with no I/O side-effects — classifiers, pricing calculations, phone parsing, JSON safety, call state tracking.

## Files

- `outcome-classifier.js` — Classify call outcomes (sale, callback, no-answer, error) from transcript + metadata
- `pricing.js` — Compute call cost, credit usage, per-minute rates
- `phone.js` — Normalize, validate, format phone numbers; detect country codes
- `safe-json.js` — Robust JSON.parse/stringify with fallbacks for malformed data
- `call-store.js` — In-memory session state (moved from root)

> **Status:** placeholder — will be populated in Phase 2. See /home/office/.claude/plans/swift-percolating-teapot.md for the full refactor plan.
