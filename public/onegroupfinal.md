# One Group — Portable Project Briefing

> **Drop this single file into any Claude Code / Cursor / AI session.** It is self-contained. Nothing else has to be attached. It bundles the project rules, three design systems (One Group brand, shadcn, Samsung One UI), typography, component inventory, conversion workflow, and instructions for editing components or swapping the library.

---

## Part 0 — Config (edit these lines to swap the library or switch modes)

```yaml
# The GitHub repo you edit and push to. This is the authoritative source of truth.
DESIGN_SYSTEM_REPO: tech1onegroup/design-system-template
DESIGN_SYSTEM_BRANCH: main

# Optional reference template (shadcn baseline). Used as the starting point for new projects.
TEMPLATE_REPO: crumbleyt/design-system-template

# Upstream component library (authoritative for any shadcn primitive).
SHADCN_LIBRARY_URL: https://ui.shadcn.com
SHADCN_DOCS_URL:    https://ui.shadcn.com/docs/components

# Which of the three themes is active on the page you're working on.
ACTIVE_THEME: one-group        # one of: one-group | shadcn | samsung-one-ui

# Which import mode governs edits. Mode 1 = paint-job only. Mode 2 = layout changes allowed.
ACTIVE_MODE: strict-skin       # one of: strict-skin | layout-adaptation
```

All instructions below resolve `$DESIGN_SYSTEM_REPO`, `$ACTIVE_THEME`, and `$ACTIVE_MODE` from this block. To swap the library or change modes, edit this block only — do not search-and-replace elsewhere.

---

## Part 1 — What this file is for

You (the AI) are helping port/re-skin HTML or React pages so they match an approved One Group design system. Your job is **mechanical translation**: apply locked tokens, typography, and component primitives to an existing source page while preserving its structure 1:1. You are not a designer. You are not adding features.

Authoritative sources:
- **Your editable repo:** `https://github.com/$DESIGN_SYSTEM_REPO` (branch `$DESIGN_SYSTEM_BRANCH`)
- **Reference template:** `https://github.com/$TEMPLATE_REPO` (shadcn baseline — starting point for new projects)
- **shadcn upstream:** `$SHADCN_LIBRARY_URL` — canonical docs for any shadcn primitive

When anything in this file conflicts with the authoritative repo, the repo wins — fetch it.

---

## Part 2 — Hard Rules (non-negotiable)

### 2.1 The 1:1 Replica Rule

When rebuilding, porting, re-theming, or "applying the latest design system" to any existing page, the output **must be a 1:1 content replica** of the source.

**1:1 means:**
- Same **sections**, same order, same count.
- Same **buttons**, labels, icons, placement in headers/toolbars.
- Same **copy** — titles, subtitles, microcopy, placeholders, empty states.
- Same **data rows**, table columns, card fields.
- Same **nav items** in the sidebar.

**The ONLY things allowed to change:**
- CSS variables / design tokens (colors, radius, spacing scale).
- Typography stack (font-family, weight, size) per Part 4.
- Component styling (border, shadow, hover, badge color) using only locked tokens.
- Sidebar chrome (width, background) if new sidebar tokens demand it — nav labels/order stay identical.
- Semantic HTML cleanup (e.g., `aria-label`) that doesn't change visible content.

**FORBIDDEN without explicit user request in the current conversation:**
- Adding KPI cards, summary rows, stat tiles, metric strips.
- Adding tabs, segmented controls, filters, toggles not in source.
- Adding header action buttons (e.g., "Add Worker", "New Item") not in source.
- Adding empty states, onboarding banners, helper cards.
- Removing/replacing buttons that WERE in the source.
- Splitting one section into many, or merging sections.
- "Enhancing" with extra whitespace, hero areas, callouts.
- Adding components **just because the target design system has them**.

**The pre-ship test:** For every element in output, ask "Was this element present in the source file?" Yes → keep it, re-styled. No → delete it unless the user explicitly asked for it in this conversation.

> "The design system has component X" is **not** a reason to use component X on a re-skin. **Component availability ≠ permission to add.**

If you think the source is missing something, do NOT silently add it. Finish the 1:1 port, then in your final message propose the addition as a *separate* suggestion the user can approve or reject.

**Why this rule exists:** On 2026-04-11, during the `attendance.html` → `design-system-template` port, a KPI summary row, segmented tabs, and a swapped header button were added that were not in the source. The user flagged it as unwanted content invention. Re-skins are token/typography migrations, not redesigns — mechanical translation work.

### 2.2 Import Modes — Strict Skin vs Layout Adaptation

One Group has two modes for importing its style into another website's UI. The `ACTIVE_MODE` in Part 0 governs what may change.

#### Mode 1 — Strict Skin Mode (default, currently active)

Changes only the visual **skin** — the paint job. Layout, spatial arrangement, positioning, and structural hierarchy are **never touched**.

**Strict Skin CHANGES:**
- Colors (background, text, borders, accents) → replaced with design tokens
- Fonts (family, weight, size scale per theme) → replaced with approved fonts
- Border radius on buttons, cards, inputs, badges → matched to theme
- Shadows (depth, color) → matched to theme
- Icon library → replaced with Lucide React (never inline SVG icons)
- Status/badge colors → mapped to token system
- Button variants and visual treatment → matched to component library
- Chart/graph colors → replaced with `--chart-N` tokens
- Dark mode → wired to light/dark token sets

**Strict Skin MUST NOT CHANGE:**
- Page layout (columns, grid structure, flexbox arrangement)
- Section order and hierarchy
- Spacing values — keep exact `p-*`, `gap-*`, `m-*` values
- Sizing values — keep exact `w-*`, `h-*`, `max-w-*` values
- Positioning (fixed, absolute, sticky placements, offsets)
- Element count (don't add or remove elements like theme switchers)
- Typography scale — if original uses `text-4xl font-extrabold`, keep it
- Content (text, labels, data, images, URLs)
- Interaction patterns (hover animations, transitions, scale effects)
- Structural HTML nesting — `<a>` stays `<a>`, not `<Button>`
- Container shapes — if sidebar is `rounded-r-[24px]`, keep `rounded-r-[24px]`
- Joined/grouped UI patterns (if two buttons share one container, keep the grouping)
- Row/cell background color patterns
- Avatar shapes — `rounded-2xl` stays `rounded-2xl`, not circular

**The simple test:** if it affects **where** something is or **how much space** it takes, don't touch it. Only change what it **looks like** (color, font, border-radius, shadow).

#### Mode 2 — Layout Adaptation Mode (NOT active)

Would allow layout/spacing/sizing/typography-scale changes **in addition to** all Strict Skin changes. Do not use unless `ACTIVE_MODE` is explicitly set to `layout-adaptation`.

### 2.3 Never invent tokens

Never invent colors, fonts, spacing, or radii. Every token lives in Part 3 and Part 4. If a state (success, warning, info) has no dedicated token, compose from existing tokens (primary, destructive, muted). **No new hex values.** Ever.

### 2.4 No hardcoded hex values in components

Always use CSS variable references (`bg-primary`, `text-muted-foreground`, etc.) so themes stay swappable. The only exception: standalone static HTML exports (see Part 6.4) where inlining is explicitly required.

### 2.5 Charts use only chart tokens

All chart/graph colors come from `--chart-1` through `--chart-5`. Use them in order (primary series = `chart-1`). Never repeat a color within the same chart. Never use arbitrary colors for data visualisation.

### 2.6 Never mix tokens between themes

`shadcn` tokens live in the `shadcn` block. `samsung-one-ui` tokens live in the `samsung-one-ui` block. `one-group` brand tokens live in the `one-group` block. They are not interchangeable — do not pull a token from one theme and use it inside another.

---

## Part 3 — The Three Approved Themes

Three themes are approved. The `ACTIVE_THEME` variable in Part 0 picks which one applies to the page you're working on.

### 3.1 Theme A — One Group (brand)

**Style:** Warm cream + maroon brand palette. Anthropic Serif headlines, Anthropic Sans UI.
**Source of truth:** `$DESIGN_SYSTEM_REPO/design/07-css-variables.md`

#### Light mode
```css
:root[data-theme="one-group"] {
  --background: #f5f3ed;
  --foreground: #141413;
  --card: #ffffff;
  --card-foreground: #141413;
  --popover: #ffffff;
  --popover-foreground: #141413;
  --primary: #762224;
  --primary-foreground: #fffcf8;
  --secondary: #e8e6dc;
  --secondary-foreground: #4d4c48;
  --muted: #f0eee6;
  --muted-foreground: #5e5d59;
  --accent: #c45a5c;
  --accent-foreground: #fffcf8;
  --destructive: #d4453a;
  --destructive-foreground: #ffffff;
  --border: #f0eee6;
  --input: #f0eee6;
  --ring: #d1cfc5;
  --chart-1: #762224;
  --chart-2: #c45a5c;
  --chart-3: #e8e6dc;
  --chart-4: #5e5d59;
  --chart-5: #323234;
  --radius: 0.5rem;
  --sidebar: #ffffff;
  --sidebar-foreground: #141413;
  --sidebar-primary: #762224;
  --sidebar-primary-foreground: #fffcf8;
  --sidebar-accent: #f0eee6;
  --sidebar-accent-foreground: #762224;
  --sidebar-border: #f0eee6;
  --sidebar-ring: #d1cfc5;
}
```

#### Dark mode
```css
:root[data-theme="one-group"].dark {
  --background: #121214;
  --foreground: #fffcf8;
  --card: #323234;
  --card-foreground: #fffcf8;
  --popover: #323234;
  --popover-foreground: #fffcf8;
  --primary: #762224;
  --primary-foreground: #fffcf8;
  --secondary: #323234;
  --secondary-foreground: #fffcf8;
  --muted: #323234;
  --muted-foreground: #b0aea5;
  --accent: #c45a5c;
  --accent-foreground: #fffcf8;
  --destructive: #d4453a;
  --destructive-foreground: #ffffff;
  --border: #323234;
  --input: #323234;
  --ring: #323234;
  --chart-1: #c45a5c;
  --chart-2: #762224;
  --chart-3: #b0aea5;
  --chart-4: #87867f;
  --chart-5: #5e5d59;
  --radius: 0.5rem;
  --sidebar: #323234;
  --sidebar-foreground: #fffcf8;
  --sidebar-primary: #762224;
  --sidebar-primary-foreground: #fffcf8;
  --sidebar-accent: #323234;
  --sidebar-accent-foreground: #c45a5c;
  --sidebar-border: #323234;
  --sidebar-ring: #323234;
}
```

### 3.2 Theme B — shadcn (Geist / Neutral)

**Style:** Clean, neutral, monochromatic. Professional. Light + dark mode.
**Font:** Geist Sans (display + body), Geist Mono (code).
**Upstream:** `$SHADCN_LIBRARY_URL`

#### Light mode
```css
:root[data-theme="shadcn"] {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
}
```

#### Dark mode
```css
:root[data-theme="shadcn"].dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
}
```

**shadcn component conventions:**
- Buttons: `variant="default"` (black fill), `"outline"`, `"ghost"`, `"secondary"`, `"destructive"`, `"link"`
- Radius: `rounded-md` (0.5rem), cards `rounded-lg` (0.625rem)
- Type scale: `text-sm` body, `text-2xl font-bold` page titles, `text-xs` labels
- Spacing: `px-4 py-2` buttons, `p-6` cards, `gap-4` grids
- Shadows: `shadow-sm` cards, none on inputs
- Status: success `text-chart-3`, error `text-destructive`, warning `text-chart-2`

### 3.3 Theme C — Samsung One UI

**Style:** Rounded corners, iOS-inspired Apple-like system colors, spacious, mobile-first.
**Font:** Inter (closest web match to SamsungOne).
**Primary:** Samsung Blue `#0381FE`.

#### Light mode
```css
:root[data-theme="samsung-one-ui"] {
  --background: #F7F7F7;
  --foreground: #1C1C1E;
  --card: #FFFFFF;
  --card-foreground: #1C1C1E;
  --popover: #FFFFFF;
  --popover-foreground: #1C1C1E;
  --primary: #0381FE;
  --primary-foreground: #FFFFFF;
  --secondary: #F2F2F7;
  --secondary-foreground: #1C1C1E;
  --muted: #F2F2F7;
  --muted-foreground: #8E8E93;
  --accent: #E8F1FE;
  --accent-foreground: #0072DE;
  --destructive: #FF3B30;
  --border: #E5E5EA;
  --input: #E5E5EA;
  --ring: #0381FE;
  --chart-1: #0381FE;
  --chart-2: #34C759;
  --chart-3: #FF9500;
  --chart-4: #AF52DE;
  --chart-5: #FF2D55;
  --radius: 1rem;
}
```

#### Dark mode
```css
:root[data-theme="samsung-one-ui"].dark {
  --background: #000000;
  --foreground: #F5F5F7;
  --card: #1C1C1E;
  --card-foreground: #F5F5F7;
  --popover: #1C1C1E;
  --popover-foreground: #F5F5F7;
  --primary: #3E91FF;
  --primary-foreground: #FFFFFF;
  --secondary: #2C2C2E;
  --secondary-foreground: #F5F5F7;
  --muted: #2C2C2E;
  --muted-foreground: #8E8E93;
  --accent: #1A3A5C;
  --accent-foreground: #3E91FF;
  --destructive: #FF453A;
  --border: #38383A;
  --input: #38383A;
  --ring: #3E91FF;
  --chart-1: #3E91FF;
  --chart-2: #30D158;
  --chart-3: #FF9F0A;
  --chart-4: #BF5AF2;
  --chart-5: #FF375F;
  --radius: 1rem;
}
```

**Samsung One UI component conventions:**
- Radius: `rounded-2xl` on cards and modals, `rounded-xl` on inputs, `rounded-2xl` on buttons (One UI signature)
- Font: Inter; `font-medium` for labels, `font-semibold` for titles
- Spacing: more generous — `p-5` cards, `gap-5` grids, `px-5 py-3` buttons
- Shadows: `shadow-md` on cards (more pronounced than shadcn)
- Status: success `text-chart-2` (#34C759), error `text-destructive`, warning `text-chart-3` (#FF9500)
- Primary actions always `bg-primary` (Samsung Blue)

### 3.4 Theme visual differences (cross-reference)

| Element            | shadcn                           | Samsung One UI               | One Group (brand)        |
|--------------------|----------------------------------|------------------------------|--------------------------|
| Card radius        | `rounded-lg`                     | `rounded-2xl`                | `rounded-lg`             |
| Button radius      | `rounded-md`                     | `rounded-2xl`                | `rounded-md`             |
| Input radius       | `rounded-md`                     | `rounded-xl`                 | `rounded-md`             |
| Card shadow        | `shadow-sm`                      | `shadow-md`                  | `shadow-sm`              |
| Font               | Geist Sans                       | Inter                        | Anthropic Serif + Sans   |
| Primary CTA        | Near-black                       | Samsung Blue `#0381FE`       | Maroon `#762224`         |
| Active nav item    | Dark filled pill                 | Blue filled pill             | Maroon filled pill       |
| Success dot        | `bg-chart-3` (dark gray)         | `bg-chart-2` (#34C759 green) | `bg-chart-3` (cream)     |
| Page background    | Pure white                       | Off-white `#F7F7F7`          | Warm cream `#f5f3ed`     |

---

## Part 4 — Typography

### 4.1 One Group brand — font stack

| Role       | Font             | CSS Variable     | Fallback                     |
|------------|------------------|------------------|------------------------------|
| Headlines  | Anthropic Serif  | `--font-heading` | Georgia, serif               |
| Body / UI  | Anthropic Sans   | `--font-sans`    | Inter, system-ui, sans-serif |
| Code       | Anthropic Mono   | `--font-mono`    | JetBrains Mono, monospace    |

Font files: `/public/fonts/anthropic/` (6 WOFF2) in `$DESIGN_SYSTEM_REPO`.

**LICENSING — IMPORTANT.** Anthropic fonts are proprietary, **internal use only**. For any public-facing product, external docs, client portal, or UI visible to non-employees, **use the fallbacks** (Georgia / Inter / JetBrains Mono). Do not ship Anthropic fonts externally.

### 4.2 One Group brand — type hierarchy

| Role                | Font             | Size            | Weight   | Line height |
|---------------------|------------------|-----------------|----------|-------------|
| Display / Hero      | Anthropic Serif  | 64px (4rem)     | 500      | 1.10        |
| Section Heading     | Anthropic Serif  | 52px (3.25rem)  | 500      | 1.20        |
| Sub-heading Large   | Anthropic Serif  | 36px (~2.3rem)  | 500      | 1.30        |
| Sub-heading         | Anthropic Serif  | 32px (2rem)     | 500      | 1.10        |
| Sub-heading Small   | Anthropic Serif  | 25px (~1.6rem)  | 500      | 1.20        |
| Feature Title       | Anthropic Serif  | 20.8px (1.3rem) | 500      | 1.20        |
| Body Serif          | Anthropic Serif  | 17px (1.06rem)  | 400      | 1.60        |
| Body Large          | Anthropic Sans   | 20px (1.25rem)  | 400      | 1.60        |
| Body / Nav          | Anthropic Sans   | 17px (1.06rem)  | 400–500  | 1.00–1.60   |
| Body Standard       | Anthropic Sans   | 16px (1rem)     | 400–500  | 1.25–1.60   |
| Body Small          | Anthropic Sans   | 15px (0.94rem)  | 400–500  | 1.00–1.60   |
| Caption             | Anthropic Sans   | 14px (0.88rem)  | 400      | 1.43        |
| Label               | Anthropic Sans   | 12px (0.75rem)  | 400–500  | 1.25–1.60   |
| Overline            | Anthropic Sans   | 10px (0.63rem)  | 400      | 1.60        |
| Code                | Anthropic Mono   | 15px (0.94rem)  | 400      | 1.60        |

**Rules:** serif for authority / sans for utility · single weight (500) for all serif headings · relaxed body line-height (1.60) · tight heading line-height (1.10–1.30) · micro letter-spacing on small sans (≤12px: 0.12px–0.5px).

### 4.3 Other themes — font stacks
- **shadcn:** Geist Sans + Geist Mono. No custom weights beyond regular/medium/semibold/bold.
- **Samsung One UI:** Inter. Use `font-medium` for labels, `font-semibold` for titles.

---

## Part 5 — Component Library (shadcn 22 + Tailwind tokens + mapping)

### 5.1 What the template ships with

`$TEMPLATE_REPO` (the shadcn baseline) provides these 22 components out of the box:

`accordion` · `avatar` · `badge` · `button` · `card` · `dialog` · `dropdown-menu` · `input` · `label` · `menubar` · `navigation-menu` · `progress` · `select` · `separator` · `sheet` · `slider` · `sonner` (toasts) · `switch` · `table` · `tabs` · `textarea` · `tooltip`

**Not in the template — add when needed:**
- Samsung One UI theme tokens → add from Part 3.3 into `globals.css`
- Theme switcher → create `src/components/theme-switcher.tsx`
- Chart component → `npx shadcn@latest add chart` then install `recharts`

### 5.2 Source element → shadcn component mapping

When converting a source UI, map elements like this. Always prefer an existing primitive over a custom div.

| Source element                     | shadcn component                                                     |
|------------------------------------|----------------------------------------------------------------------|
| Navigation bar / menu              | `NavigationMenu` or `Menubar`                                        |
| Bordered div / content block       | `Card` + `CardHeader` + `CardContent`                                |
| Button                             | `Button` (default / outline / ghost / secondary / destructive)       |
| Text input / search box            | `Input`                                                              |
| Dropdown / select                  | `Select` + `SelectTrigger` + `SelectContent` + `SelectItem`          |
| Multi-line text                    | `Textarea`                                                           |
| Form field with label              | `Label` + `Input`                                                    |
| Modal / popup                      | `Dialog`                                                             |
| Side drawer                        | `Sheet`                                                              |
| Tab bar                            | `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent`                  |
| Data table                         | `Table` + `TableHeader` + `TableBody` + `TableRow` + `TableCell`     |
| Tag / chip / status pill           | `Badge` (default / secondary / destructive / outline)                |
| On/off toggle                      | `Switch`                                                             |
| Expandable section                 | `Accordion`                                                          |
| Hover tooltip                      | `Tooltip`                                                            |
| Loading bar                        | `Progress`                                                           |
| Range control                      | `Slider`                                                             |
| Profile photo                      | `Avatar` + `AvatarImage` + `AvatarFallback`                          |
| Toast / snackbar                   | `Sonner`                                                             |
| Divider / horizontal rule          | `Separator`                                                          |
| Context menu                       | `DropdownMenu`                                                       |
| Sidebar navigation                 | Custom `<aside>` with `Button variant="ghost"` nav items             |
| Chart / graph                      | `recharts` wrapped in `ChartContainer` from `chart.tsx`              |

For any primitive not listed, consult `$SHADCN_DOCS_URL`.

### 5.3 Tailwind token classes (use these, not hex values)

| Design intent           | Tailwind class                                |
|-------------------------|-----------------------------------------------|
| Page background         | `bg-background`                               |
| Default text            | `text-foreground`                             |
| Card surface            | `bg-card text-card-foreground`                |
| Primary button fill     | `bg-primary text-primary-foreground`          |
| Subtle background       | `bg-muted text-muted-foreground`              |
| Accent highlight        | `bg-accent text-accent-foreground`            |
| Error / delete          | `text-destructive` / `bg-destructive`         |
| Border lines            | `border-border`                               |
| Input background        | `bg-input`                                    |
| Focus ring              | `ring-ring`                                   |
| Chart color 1..5        | `text-chart-1` .. `text-chart-5`              |

### 5.4 Icons

All icons come from `lucide-react`. Never inline SVG icons in components. Static HTML exports are the one exception.

---

## Part 6 — Conversion Workflow (source UI → themed page)

### 6.1 Step 1 — Analyse the source
Identify: page sections (header, sidebar, main, footer), all interactive elements, data display elements, navigation patterns, charts/graphs. Count them. You'll check this count against the output.

### 6.2 Step 2 — Map elements
Use the table in Part 5.2. Every interactive element in source maps to a shadcn primitive. Every bordered content block maps to `Card`.

### 6.3 Step 3 — Apply theme tokens
Use the table in Part 5.3. **No hardcoded hex values.** Only `bg-*` / `text-*` / `border-*` classes that resolve to CSS variables. Dark mode must work.

### 6.4 Step 4 — Output the Next.js component
- Path: `src/app/<page-name>/page.tsx`
- `"use client"` only when interactivity requires it
- Named imports for every shadcn component used
- `lucide-react` for every icon
- No hardcoded hex
- Tailwind classes only for spacing/sizing/layout
- Match source layout **exactly** (per Mode 1 in Part 2.2)

### 6.5 Step 5 — Static HTML output (no Next.js)
If the target is a standalone HTML file:
- Inline the full `<style>` block with the active theme's token blocks from Part 3
- Set `<html data-theme="$ACTIVE_THEME">`
- Replace Tailwind classes with inline CSS or a CDN Tailwind link
- For charts: inline SVG polylines with hardcoded colors from the active theme
  - shadcn — UP `#525252` / DOWN `#DC2626` / FLAT `#737373`
  - Samsung One UI — UP `#34C759` / DOWN `#FF3B30` / FLAT `#8E8E93`
  - One Group — UP `#762224` / DOWN `#d4453a` / FLAT `#5e5d59`
- No external JS deps required

---

## Part 7 — Charts

### 7.1 Available chart types (Recharts)

All charts wrap Recharts inside `ChartContainer` from `src/components/ui/chart.tsx`.

| Chart type             | Recharts components                         | Best for                        |
|------------------------|---------------------------------------------|---------------------------------|
| Sparkline (mini trend) | `LineChart` + `Line` + `ResponsiveContainer`| 7-day trends in table rows      |
| Line chart             | `LineChart` + `Line` + `XAxis` + `YAxis`    | Time-series data                |
| Bar chart              | `BarChart` + `Bar` + `XAxis` + `YAxis`      | Category comparisons            |
| Area chart             | `AreaChart` + `Area`                        | Cumulative / stacked totals     |
| Pie / Donut            | `PieChart` + `Pie` + `Cell`                 | Part-to-whole breakdown         |
| Radial bar             | `RadialBarChart` + `RadialBar`              | Single metric progress          |

### 7.2 Sparkline standard

```tsx
import { LineChart, Line, ResponsiveContainer } from "recharts"

function Sparkline({ data, trend }: { data: { v: number }[], trend: "up" | "down" | "flat" }) {
  const color =
    trend === "up"   ? "var(--color-chart-3)"
    : trend === "down" ? "var(--color-destructive)"
    : "var(--color-muted-foreground)"

  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

### 7.3 Color assignment
Use chart tokens in order: `chart-1` (primary series), `chart-2` (secondary), etc. Never repeat within a chart. Never use arbitrary colors.

---

## Part 8 — How to change a UI component (local-edit-then-sync)

This is how edits propagate. **Do not edit components directly on GitHub via the web UI.** Always go through a local checkout.

### 8.1 Setup (once per machine)

```bash
git clone https://github.com/$DESIGN_SYSTEM_REPO.git
cd design-system-template
npm install
npm run dev      # http://localhost:3000 — live preview
```

> **Breaking-changes warning.** `design-system-template` uses a version of Next.js with APIs that may differ from your training data. Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices.

### 8.2 Edit loop

1. **Locate the component.** shadcn primitives live under `src/components/ui/`. Page-level compositions live under `src/components/` or `src/app/`.
2. **Edit locally.** Use tokens (`var(--primary)`, `bg-primary`, etc.) — **never** hardcoded hex. If a token doesn't exist for your need, compose from existing tokens. Do not add new ones.
3. **Preview.** Dev server, light and dark mode, hover/focus/disabled states.
4. **Test a real consumer.** Open a page that uses the component. Verify nothing else broke.
5. **Lint + typecheck:**
   ```bash
   npm run lint
   npm run typecheck   # if defined
   ```
6. **Commit** (describe the change, not the file):
   ```bash
   git add src/components/ui/<component>.tsx
   git commit -m "fix(button): tighten focus ring on secondary variant"
   ```
7. **Push** only after preview + lint/typecheck pass:
   ```bash
   git push origin $DESIGN_SYSTEM_BRANCH
   ```
8. **Pull from consumers.** Any project consuming the design system must re-pull or bump the dep.

### 8.3 Token-only changes
Edit `design/07-css-variables.md` **and** the matching `globals.css` (or wherever the `:root[data-theme="..."]` block lives). Keep MD and runtime CSS in sync — both are authoritative in different contexts.

### 8.4 Component structure changes
Adding a new variant is fine. Removing/renaming a variant is a breaking change — flag it to the user, don't silently delete.

### 8.5 Adding a missing shadcn primitive
If the template is missing a primitive you need: `npx shadcn@latest add <component>`. Verify the result uses tokens (not hex) before committing.

---

## Part 9 — How to swap the design system repo

Sometimes you'll point this briefing at a different library (a fork, a new version, a client-specific theme).

### 9.1 Do the swap
1. Edit the variables in **Part 0**. That's the only URL source — do not hunt-and-replace elsewhere.
2. Fetch the new repo:
   ```bash
   git clone https://github.com/<new-repo>.git
   ```
3. Confirm these files exist (structure must match, or this briefing is no longer accurate):
   - `design/07-css-variables.md` — token definitions
   - `design/03-typography.md` — font + type hierarchy
   - `design/08-rules.md` — design rules (if present)
   - `src/components/ui/` — shadcn-style component primitives

### 9.2 Verify after swap
- [ ] `design/07-css-variables.md` still uses the `:root[data-theme="..."]` pattern. If the theme name changed, update Part 3.
- [ ] Token **names** (`--primary`, `--background`, `--card`, etc.) still match Part 3. If any renamed, update Part 3.
- [ ] `design/03-typography.md` fonts and hierarchy still match Part 4. If fonts changed (e.g., different licensing), update Part 4 — especially the licensing warning.
- [ ] `src/components/ui/` has the same component names, or update Part 5.1 inventory and 5.2 mapping.
- [ ] Re-skin one known-good page and diff against a pre-swap baseline. If it renders wrong, the swap isn't done — don't ship.

### 9.3 What stays after a swap
The Hard Rules in Part 2 (1:1 replica, strict-skin mode, no new tokens, no hex in components, chart tokens only, don't mix themes) apply to **every** design system, not just this one. Never delete Part 2 during a swap.

---

## Part 10 — Pre-ship checklist

Before shipping any re-skin or converted page, every box must be checked.

- [ ] Every element in output maps to an element in source (Part 2.1 pre-ship test).
- [ ] No new KPI rows, tabs, header buttons, banners, or components that weren't in source.
- [ ] No hardcoded hex values anywhere in components — only `var(--token)` / Tailwind token classes from Part 5.3.
- [ ] All icons imported from `lucide-react` (not inline SVG) — or, for static HTML exports only, inline SVGs using hardcoded theme colors from Part 6.5.
- [ ] Layout matches source exactly (column count, section order, spacing ratios, exact `p-*`/`gap-*`/`m-*` values).
- [ ] Typography scale from source preserved (no `text-4xl font-extrabold` → `text-3xl font-bold` downgrades).
- [ ] All shadcn component imports present and correct.
- [ ] `"use client"` only where interactivity requires it.
- [ ] Chart colors use `--chart-1..5` only.
- [ ] Both light and dark mode render correctly (token coverage verified).
- [ ] File saved to correct path (`src/app/<page-name>/page.tsx`).
- [ ] Static HTML exports: theme CSS block inlined, hardcoded SVG trend colors match active theme.
- [ ] Licensing respected — public-facing pages do NOT ship Anthropic fonts (use fallbacks).
- [ ] Any additions the source didn't have are **proposed in the final message**, not shipped in code.

If any box is unchecked, the work is not done.

---

## Part 11 — Reference audit: known Strict Skin Mode violations

From a prior `code.html` conversion audit. **19 violations** were found in the first attempt; do not repeat them. These are all Mode 1 failures — things that Strict Skin Mode must never change.

### Category A — layout/spacing (must keep original values)

| # | What was changed           | Original                                 | Wrong recreation         | Fix                             |
|---|----------------------------|------------------------------------------|--------------------------|---------------------------------|
| 1 | Sidebar right corners      | `rounded-r-[24px]`                       | Flat `border-r`          | Keep `rounded-r-[24px]`         |
| 2 | Sidebar nav gap            | `gap-6`                                  | `gap-2`                  | Keep `gap-6`                    |
| 3 | Header height              | `h-16`                                   | `h-14`                   | Keep `h-16`                     |
| 4 | Content padding            | `p-10`                                   | `p-8`                    | Keep `p-10`                     |
| 5 | Content max-width          | `max-w-7xl`                              | `max-w-5xl`              | Keep `max-w-7xl`                |
| 6 | Title size/weight          | `text-4xl font-extrabold`                | `text-3xl font-bold`     | Keep `text-4xl font-extrabold`  |
| 7 | Submit button size         | `py-5 text-lg rounded-[24px] shadow-xl`  | `h-12 text-base`         | Keep original dimensions        |
| 8 | Card corners               | `rounded-[32px]`                         | Default `Card` radius    | Keep `rounded-[32px]`           |
| 9 | FAB position               | `bottom-10 right-10`                     | `bottom-8 right-8`       | Keep `bottom-10 right-10`       |
|10 | Button padding             | `px-5 py-3`                              | Default                  | Keep `px-5 py-3`                |

### Category B — structural (must keep original elements/patterns)

| #  | What was changed     | Original                                   | Wrong recreation         | Fix                        |
|----|----------------------|--------------------------------------------|--------------------------|----------------------------|
| 11 | Export buttons       | Joined dual button in one container        | Two separate buttons     | Keep joined container      |
| 12 | Nav element type     | `<a>` link tags                            | `<Button>` components    | Keep `<a>` tags            |
| 13 | Search bar shape     | `rounded-full` pill                        | Rectangular `Input`      | Keep `rounded-full`        |
| 14 | Theme switcher       | Not in original                            | Added `<ThemeSwitcher/>` | Remove — don't add         |
| 15 | Avatar shape         | `rounded-2xl`                              | Circular `Avatar`        | Keep `rounded-2xl`         |
| 16 | Avatar ring          | `ring-2 ring-white shadow-sm`              | No ring                  | Keep ring styling          |
| 17 | Row backgrounds      | Status colors (green/gray/pink)            | No row coloring          | Keep status row colors     |
| 18 | FAB hover animation  | `hover:scale-110 active:scale-95`          | None                     | Keep hover animation       |
| 19 | FAB shadow           | `shadow-2xl shadow-blue-400` (blue glow)   | `shadow-lg`              | Keep colored shadow        |

### Category C — allowed skin-only changes (these ARE OK under Strict Skin)

- Icon library swap (e.g., Material → Lucide)
- Color hex values → CSS variable tokens
- Font family → active theme font
- Badge variants mapped to theme
- Shadow depth adjusted to theme (but not removed)

---

## Part 12 — Scope of this file

This briefing covers **design-system re-skinning and conversion** against One Group's three approved themes. It is deliberately **not** a general project index. It does not cover:

- `chrome-extension` internals
- `gemini-live-app-native-main`
- `one-group-ui` app business logic
- Backend, data pipelines, deployments

If the user asks for work outside re-skinning/conversion, fall back to whatever docs exist in that subproject — this file is not authoritative for those domains.
