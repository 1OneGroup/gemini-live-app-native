# src/dashboard

Assembles the single-page dashboard HTML by concatenating layout, styles, and client scripts into a byte-identical template literal.

## Files

| File | Exports | Purpose |
|---|---|---|
| `index.js` | `getDashboardHtml()` | Concatenates all parts in fixed order: layout part1 → styles → layout part2 → scripts → layout part3 |
| `layout.html.js` | `{ part1, part2, part3 }` | Three HTML chunks: DOCTYPE + head + style tag open; head close + body open + script tag open; script close + body/html close |
| `styles.css.js` | CSS string | Complete dark theme stylesheet; placed between `<style>` tags |
| `bootstrap.js` | `{ nav, health, utils, init }` | Navigation handler, health check loop, utility functions (escape, rupee), and page load init |
| `client/` | (subdir) | Feature modules: campaigns, calls, prompts, analytics, brochures, settings; plus state and utils |

## Verification

Output is byte-identical to the original dashboard.js template literal. Baseline sha256 is `2dee3b508bc3d0436cff2ef0d829c530a692a3e31df8f8b3903e1ccb30cd4460` (docs/dashboard-baseline.html). Any edit that changes the rendered HTML breaks verification.

## Imported by

- `src/index.js` (line 8): `const { getDashboardHtml } = require('./dashboard')`
