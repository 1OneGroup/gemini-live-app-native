# src/dashboard/client

Feature modules that render as JavaScript strings. Each exports inline JS for a single dashboard page or feature.

## Files

| File | Exports | Purpose |
|---|---|---|
| `state.js` | JS string | Module-level `let` declarations: allCalls, allCampaigns, filters, chart instances, DataTable refs, currentPage |
| `utils.js` | JS string | Shared helpers: `esc()` for HTML escaping, `rupee()` for Indian currency formatting |
| `campaigns.js` | JS string | Campaign CRUD, CSV upload, batch timeline, AI analysis approval, outcome/batch charts, contact table |
| `calls.js` | JS string | Call history list, filtering, detail panel with cost breakdown, transcript, outcome classification |
| `analytics.js` | JS string | Platform-wide stats, daily/campaign charts, cost tracker with token counts, model pricing display |
| `prompts.js` | JS string | Named prompt library create/edit/delete/activate; system instructions for AI agent |
| `brochures.js` | JS string | WhatsApp message templates with attachment support; active template sent post-call |
| `settings.js` | JS string | Employee-to-WhatsApp instance routing, model selector with pricing, cost rate display |

## Verification

Output is byte-identical to the original dashboard.js template literal. Baseline sha256 is `2dee3b508bc3d0436cff2ef0d829c530a692a3e31df8f8b3903e1ccb30cd4460` (docs/dashboard-baseline.html). Any edit that changes the rendered HTML breaks verification.
