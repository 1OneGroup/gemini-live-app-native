# src/dashboard/

Dashboard server-side infrastructure — HTML layout, CSS generation, and Bootstrap logic to serve the single-page app.

## Files

- `index.js` — HTTP handler for GET / (returns rendered HTML shell)
- `styles.css.js` — Generate dashboard CSS (colors, layout, responsive grid)
- `layout.html.js` — Build the HTML template with meta tags, script tags, nonces
- `bootstrap.js` — Server-side data hydration (initial campaigns, user context, etc.)

> **Status:** placeholder — will be populated in Phase 6. See /home/office/.claude/plans/swift-percolating-teapot.md for the full refactor plan.
