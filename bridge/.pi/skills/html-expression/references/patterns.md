# HTML Component Patterns

Reusable HTML snippets for common response types. Copy and adapt.

---

## 1. Stat Card Grid

3+ related numbers. Use 2-column grid, adjust to 1-column on narrow view.

```html
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:500px;">
  <div style="background:#1a1a2e;border-radius:10px;padding:12px;border:1px solid #2a2a3e;">
    <div style="font-size:12px;color:#888;">Label A</div>
    <div style="font-size:20px;font-weight:700;color:#a78bfa;">42</div>
  </div>
  <div style="background:#1a1a2e;border-radius:10px;padding:12px;border:1px solid #2a2a3e;">
    <div style="font-size:12px;color:#888;">Label B</div>
    <div style="font-size:20px;font-weight:700;color:#34d399;">18</div>
  </div>
  <div style="background:#1a1a2e;border-radius:10px;padding:12px;border:1px solid #2a2a3e;">
    <div style="font-size:12px;color:#888;">Label C</div>
    <div style="font-size:20px;font-weight:700;color:#fbbf24;">7</div>
  </div>
  <div style="background:#1a1a2e;border-radius:10px;padding:12px;border:1px solid #2a2a3e;">
    <div style="font-size:12px;color:#888;">Label D</div>
    <div style="font-size:20px;font-weight:700;color:#f472b6;">3</div>
  </div>
</div>
```

---

## 2. Progress Bar + Stage Labels

Single progress indicator, optionally with phase markers below.

```html
<div style="max-width:500px;">
  <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
    <span>Feature Name</span>
    <span style="color:#34d399;font-weight:600;">72%</span>
  </div>
  <div style="height:6px;background:#2a2a3e;border-radius:3px;overflow:hidden;margin-bottom:6px;">
    <div style="width:72%;height:100%;background:linear-gradient(90deg,#a78bfa,#60a5fa);border-radius:3px;"></div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;color:#666;">
    <span style="color:#a78bfa;">● Design</span>
    <span style="color:#60a5fa;">● Implement</span>
    <span style="color:#888;">○ Test</span>
  </div>
</div>
```

---

## 3. Syntax-Highlighted Code Block

Use span-based inline coloring. Minimal and consistent.

```html
<div style="background:#0f0f1a;border-radius:8px;padding:12px;border:1px solid #2a2a3e;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
    <span style="font-size:14px;">📄</span>
    <span style="font-size:12px;color:#a78bfa;font-weight:500;">filename.ts</span>
    <span style="font-size:11px;color:#666;margin-left:auto;">TypeScript</span>
  </div>
  <pre style="margin:0;font-family:'JetBrains Mono','Fira Code',monospace;font-size:13px;line-height:1.7;color:#e0e0e0;white-space:pre-wrap;">
<span style="color:#f472b6;">import</span> { <span style="color:#60a5fa;">createSignal</span> } <span style="color:#f472b6;">from</span> <span style="color:#fbbf24;">'solid-js'</span>

<span style="color:#f472b6;">function</span> <span style="color:#60a5fa;">Counter</span>() {
  <span style="color:#f472b6;">const</span> [count, setCount] = <span style="color:#60a5fa;">createSignal</span>(<span style="color:#fbbf24;">0</span>)
  <span style="color:#f472b6;">return</span> <span style="color:#a78bfa;">&lt;div&gt;</span>{count()}<span style="color:#a78bfa;">&lt;/div&gt;</span>
}
</pre>
</div>
```

**Color map for code syntax:**
- Keywords (import, from, function, const, return) → `#f472b6` (pink)
- Functions → `#60a5fa` (blue)
- Strings → `#fbbf24` (yellow)
- Numbers → `#fbbf24` (yellow)
- Types → `#34d399` (green)
- JSX tags → `#a78bfa` (accent)
- Variables, text → `#e0e0e0` (default)
- Comments → `#666` (muted)

---

## 4. Side-by-Side Comparison

Before/after, pros/cons, two approaches.

```html
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
  <div style="background:#1a1a2e;border-radius:10px;padding:14px;border:1px solid #2a2a3e;border-left:3px solid #f87171;">
    <div style="font-size:13px;font-weight:600;color:#f87171;margin-bottom:8px;">❌ 旧方案</div>
    <div style="font-size:13px;line-height:1.6;color:#ccc;">
      <div>• 每次手动拼字符串</div>
      <div>• 类型不安全</div>
      <div>• 维护成本高</div>
    </div>
  </div>
  <div style="background:#1a1a2e;border-radius:10px;padding:14px;border:1px solid #2a2a3e;border-left:3px solid #34d399;">
    <div style="font-size:13px;font-weight:600;color:#34d399;margin-bottom:8px;">✅ 新方案</div>
    <div style="font-size:13px;line-height:1.6;color:#ccc;">
      <div>• 模板引擎自动生成</div>
      <div>• 类型推导完整</div>
      <div>• 零维护</div>
    </div>
  </div>
</div>
```

---

## 5. Tag / Badge List

Small, compact, colored chips. Good for tech stacks, categories, labels.

```html
<div style="display:flex;flex-wrap:wrap;gap:6px;">
  <span style="background:rgba(167,139,250,0.15);color:#a78bfa;padding:3px 10px;border-radius:12px;font-size:12px;border:1px solid rgba(167,139,250,0.3);">SolidJS</span>
  <span style="background:rgba(52,211,153,0.15);color:#34d399;padding:3px 10px;border-radius:12px;font-size:12px;border:1px solid rgba(52,211,153,0.3);">TypeScript</span>
  <span style="background:rgba(96,165,250,0.15);color:#60a5fa;padding:3px 10px;border-radius:12px;font-size:12px;border:1px solid rgba(96,165,250,0.3);">WebSocket</span>
  <span style="background:rgba(251,191,36,0.15);color:#fbbf24;padding:3px 10px;border-radius:12px;font-size:12px;border:1px solid rgba(251,191,36,0.3);">Tailwind</span>
</div>
```

---

## 6. Callout / Info Box

Emphasize one piece of information. Color indicates type.

```html
<!-- Tip / positive -->
<div style="background:rgba(52,211,153,0.1);border-radius:8px;padding:10px 14px;display:flex;align-items:flex-start;gap:8px;border:1px solid rgba(52,211,153,0.2);">
  <span style="font-size:16px;flex-shrink:0;">💡</span>
  <span style="font-size:13px;color:#e0e0e0;">Main tip or insight here</span>
</div>

<!-- Warning -->
<div style="background:rgba(251,191,36,0.1);border-radius:8px;padding:10px 14px;display:flex;align-items:flex-start;gap:8px;border:1px solid rgba(251,191,36,0.2);">
  <span style="font-size:16px;flex-shrink:0;">⚠️</span>
  <span style="font-size:13px;color:#e0e0e0;">Something to watch out for</span>
</div>

<!-- Info -->
<div style="background:rgba(96,165,250,0.1);border-radius:8px;padding:10px 14px;display:flex;align-items:flex-start;gap:8px;border:1px solid rgba(96,165,250,0.2);">
  <span style="font-size:16px;flex-shrink:0;">ℹ️</span>
  <span style="font-size:13px;color:#e0e0e0;">Additional context or note</span>
</div>
```

---

## 7. Table

Proper table with alternating rows for tabular data.

```html
<div style="background:#1a1a2e;border-radius:10px;padding:0;border:1px solid #2a2a3e;overflow:hidden;">
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="background:#0f0f1a;">
        <th style="padding:10px 14px;text-align:left;color:#a78bfa;font-weight:600;border-bottom:1px solid #2a2a3e;">Name</th>
        <th style="padding:10px 14px;text-align:left;color:#a78bfa;font-weight:600;border-bottom:1px solid #2a2a3e;">Status</th>
        <th style="padding:10px 14px;text-align:right;color:#a78bfa;font-weight:600;border-bottom:1px solid #2a2a3e;">Value</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
        <td style="padding:8px 14px;color:#e0e0e0;">Item A</td>
        <td style="padding:8px 14px;"><span style="color:#34d399;">●</span> Running</td>
        <td style="padding:8px 14px;text-align:right;color:#e0e0e0;">42</td>
      </tr>
      <tr style="border-bottom:1px solid rgba(255,255,255,0.04);background:rgba(255,255,255,0.02);">
        <td style="padding:8px 14px;color:#e0e0e0;">Item B</td>
        <td style="padding:8px 14px;"><span style="color:#fbbf24;">●</span> Pending</td>
        <td style="padding:8px 14px;text-align:right;color:#e0e0e0;">18</td>
      </tr>
      <tr>
        <td style="padding:8px 14px;color:#e0e0e0;">Item C</td>
        <td style="padding:8px 14px;"><span style="color:#f87171;">●</span> Failed</td>
        <td style="padding:8px 14px;text-align:right;color:#e0e0e0;">0</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 8. Timeline / Step List

Vertical timeline for process flows, changelogs, sequential steps.

```html
<div style="padding-left:20px;">
  <div style="position:relative;padding-left:24px;padding-bottom:16px;border-left:2px solid #2a2a3e;">
    <div style="position:absolute;left:-7px;top:4px;width:12px;height:12px;border-radius:50%;background:#34d399;border:2px solid #0f0f1a;"></div>
    <div style="font-size:13px;font-weight:600;color:#34d399;">Step 1: Design</div>
    <div style="font-size:12px;color:#888;margin-top:2px;">Architecture spec completed</div>
  </div>
  <div style="position:relative;padding-left:24px;padding-bottom:16px;border-left:2px solid #2a2a3e;">
    <div style="position:absolute;left:-7px;top:4px;width:12px;height:12px;border-radius:50%;background:#60a5fa;border:2px solid #0f0f1a;"></div>
    <div style="font-size:13px;font-weight:600;color:#60a5fa;">Step 2: Implement</div>
    <div style="font-size:12px;color:#888;margin-top:2px;">Core logic in progress</div>
  </div>
  <div style="position:relative;padding-left:24px;">
    <div style="position:absolute;left:-7px;top:4px;width:12px;height:12px;border-radius:50%;background:#2a2a3e;border:2px solid #0f0f1a;"></div>
    <div style="font-size:13px;font-weight:600;color:#888;">Step 3: Test</div>
    <div style="font-size:12px;color:#666;margin-top:2px;">Not started</div>
  </div>
</div>
```

---

## 9. Dashboard Grid (Mixed)

Multiple cards of different types in one response.

```html
<div style="max-width:600px;">
  <!-- Row 1: header -->
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
    <span style="font-size:20px;">📊</span>
    <span style="font-size:16px;font-weight:600;">Dashboard Title</span>
    <span style="font-size:11px;color:#666;margin-left:auto;">2026-06-06</span>
  </div>

  <!-- Row 2: stat grid -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
    ...cards...
  </div>

  <!-- Row 3: full-width section -->
  <div style="background:#1a1a2e;border-radius:10px;padding:14px;border:1px solid #2a2a3e;">
    ...full-width content...
  </div>

  <!-- Row 4: footer -->
  <div style="margin-top:12px;padding-top:12px;border-top:1px solid #2a2a3e;font-size:11px;color:#666;text-align:center;">
    Footer note
  </div>
</div>
```

---

## 10. Inline Elements (for use inside other text)

Small UI elements for inline use — badges, status dots, colored text.

```html
<!-- Status dot -->
<span style="color:#34d399;">●</span> <span>Online</span>
<span style="color:#fbbf24;">●</span> <span>Warning</span>
<span style="color:#f87171;">●</span> <span>Error</span>

<!-- Inline tag -->
<span style="background:rgba(167,139,250,0.15);color:#a78bfa;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:500;">feature</span>

<!-- Colored number -->
<span style="color:#34d399;font-weight:600;">+42%</span>
<span style="color:#f87171;font-weight:600;">-12%</span>

<!-- Code inline -->
<code style="background:#0f0f1a;color:#f472b6;padding:1px 5px;border-radius:4px;font-size:13px;">someCode()</code>

<!-- Key value pair -->
<div style="display:flex;gap:8px;">
  <span style="color:#888;font-size:13px;">Key:</span>
  <span style="color:#e0e0e0;font-size:13px;font-weight:500;">Value</span>
</div>
```

---

## Reference: Color Palette

```css
--accent  #a78bfa  /* purple — highlights, headings, borders, primary */
--green   #34d399  /* green — success, done, positive, online */
--blue    #60a5fa  /* blue — info, code functions, direct */
--pink    #f472b6  /* pink — code keywords, metadata, tags */
--yellow  #fbbf24  /* yellow — warnings, strings, waiting */
--red     #f87171  /* red — errors, failures, negative */
--muted   #888888  /* gray — secondary text, timestamps */
--bg      #0f0f1a  /* darkest — page backdrop */
--surface #1a1a2e  /* dark-2 — card background */
--border  #2a2a3e  /* dark-3 — borders, dividers */
```

Tint backgrounds: `rgba(#hex, 0.08–0.15)` + border `rgba(#hex, 0.2–0.3)`.
