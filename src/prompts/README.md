# src/prompts/

Gemini Live system prompts, runtime cue templates, and prompt variable injection.

## Files

- `index.js` — Prompt loader; resolves prompt name → system message + metadata
- `default-clermont.js` — Default outbound sales prompt with instructions, tone, guardrails
- `runtime-cues.js` — Template strings for injecting dynamic vars (contact name, product, campaign context)

> **Status:** placeholder — will be populated in Phase 2. See /home/office/.claude/plans/swift-percolating-teapot.md for the full refactor plan.
