---
name: html-expression
description: >-
  Decide when to render responses as rich HTML instead of plain text, then build the HTML.
  Use whenever you're about to produce a complex, structured, or information-dense response —
  status overviews, code walkthroughs, comparisons, architecture explanations, dashboards.
  Not for casual chat, short replies, emotional reactions, or simple confirmations.
  The skill gives you a decision framework and reusable design patterns so you don't have to
  reinvent HTML layout each time. When in doubt, lean toward using it — the rendering pipeline
  can handle it.
---

# HTML Expression

A decision framework + pattern library for rendering structured responses as inline HTML.

## Why HTML

HTML gives you layout, hierarchy, and visual semantics that plain text can't express:

| Plain text | HTML |
|---|---|
| Flowing paragraph, everything same weight | Cards, grids, visual hierarchy |
| Code inline, hard to read | Syntax-highlighted blocks with file labels |
| List items indented with dashes | Proper lists, tags, badges |
| Progress "████░░░░" | Sized progress bars with color |
| Table aligned with spaces | Real tables with sticky headers |

The goal isn't "make it pretty" — it's **encode information structure visually** so the user scans faster and absorbs more.

---

## Decision: HTML vs Plain Text

### Use HTML when the response contains:

**Structured data**
- Multiple stats / metrics / counters
- Comparisons（before/after, pros/cons）
- Tabular data（rows and columns）
- Progress state（% done, phases, status）

**Code**
- More than 3 lines of code
- Code with multiple languages or files
- Code that benefits from syntax highlighting + filename labels

**Layered information**
- Info that has headings, sub-sections, callouts
- Steps in a process that should be visually distinct
- Architecture / data flow with multiple components

**Mixed content**
- Code + explanation + stats in the same response
- Comparison of multiple approaches

### Stick to plain text when:

- **Casual chat**: "嗯", "hhh", "好的", "摸摸", emotional reactions
- **Short confirmations**: "记了一条：xxx", "写好了", "已删除"
- **Quick answers**: single sentence, yes/no, simple value
- **Copy-paste targets**: the user needs to paste the text elsewhere
- **Tool output**: the response is primarily tool feedback（"文件已写入"）
- **Nested within a larger plain-text flow**: don't break flow with a sudden HTML block

### Grey zone — can go either way:

- A single code block with explanation → HTML if the explanation has structure, plain text if it's one line
- A list of 3-5 items → Cards if each item has sub-details, plain list if just names
- Status update with 2-3 numbers → inline bold is fine, HTML only if there are 5+ metrics

**When in doubt**: ask yourself "would a quick glance at this HTML tell them more than reading the plain text?" If yes, render it.

---

## Workflow

When you decide to use HTML:

### Step 1: Identify the content type

Map the response to one or more of these patterns:

| Type | Pattern | Example |
|---|---|---|
| Stats | Stat card grid | Token usage, build times, counts |
| Table | Proper `<table>` | API endpoints, feature comparison |
| Progress | Progress bar + stages | Feature completion, build steps |
| Code | Syntax-highlighted block | Shader code, TS types, CSS |
| Comparison | Side-by-side cards | Before/after, pros/cons, options |
| Tags | Badge / chip list | Tech stack, categories, labels |
| Timeline | Vertical step list | Process flow, changelog, plan |
| Callout | Colored info box | Warnings, tips, key takeaways |
| Layered | Section with sub-sections | Architecture, design rationale |
| Dashboard | Mixed grid | Project status, system health |

If it's mixed, pick a container layout and nest patterns.

### Step 2: Choose a layout

- **Single card** (~1-3 related items) → One `<div>` with internal layout
- **Grid** (3+ same-type items) → `display:grid; grid-template-columns: 1fr 1fr;`
- **Full-width section** (longer content) → Single column, clear heading hierarchy
- **Dashboard** (mixed types in one response) → Multiple cards in a grid, card-full for spanning

### Step 3: Write the HTML

Reference `references/patterns.md` for reusable HTML snippets.

General rules:

```html
<!-- Always wrap in a container -->
<div style="...">
  ... content ...
</div>
```

```html
<!-- Stats card -->
<div style="
  background: /* surface color */;
  border-radius: 10px;
  padding: 14px;
  border: 1px solid /* border color */;
">
  <div style="font-size: 12px; color: var(--muted);">Label</div>
  <div style="font-size: 20px; font-weight: 700;">Value</div>
</div>
```

```html
<!-- Progress bar -->
<div style="height: 6px; background: #2a2a3e; border-radius: 3px; overflow: hidden;">
  <div style="width: 72%; height: 100%; background: #a78bfa; border-radius: 3px;"></div>
</div>
```

**Color system** (use these consistently across all HTML responses):

```
--accent  #a78bfa  purple  for highlights, headings, borders
--green   #34d399  green   for success, done, positive
--blue    #60a5fa  blue    for info, direct, code
--pink    #f472b6  pink    for tags, metadata
--yellow  #fbbf24  yellow  for warnings, in-progress
--red     #f87171  red     for errors, failures
--muted   #888888  gray    for secondary text
--bg      #0f0f1a  dark    for page background
--surface #1a1a2e  dark-2  for card background
--border  #2a2a3e  dark-3  for borders
```

Use `rgba(color, 0.1)` for hover/tint backgrounds:
```html
background: rgba(167, 139, 250, 0.1);  /* accent tint */
border: 1px solid rgba(167, 139, 250, 0.2);
```

### Step 4: Review

Before sending, check:

- [ ] Does the HTML encode the information structure, not just decorate it?
- [ ] Is the color usage semantic?（green = done, yellow = in progress, red = broken）
- [ ] Would this have been clearer as plain text? If yes → remove HTML
- [ ] Is the layout responsive?（use max-width + grid auto-fit, test at narrow widths）
- [ ] Are fonts readable?（system-ui or Segoe UI for UI, monospace for code）
- [ ] Does it use the established color system?

---

## Anti-patterns

**Don't over-style.** If the information doesn't have structure, don't force a card. A single sentence inside a rounded box is just decoration.

**Don't use images/icons that require attribution.** Stick to Unicode emoji for inline icons — they're universally available.

**Don't use external CSS or JS.** Everything must be inline styles, no external resources. No `<link>` or `<script src=...>`.

**Don't wrap everything in HTML.** If you're replying with 3 sentences and one of them has a code word, don't render the whole thing as HTML. Just bold or code inline.

**Don't use hover-dependent information.** In chat, users might not hover. Put key info in visible text.

**Don't forget that the user might copy-paste.** If they're going to paste your HTML into another context, warn them or offer a plain-text fallback.
