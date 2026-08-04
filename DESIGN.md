---
version: alpha
name: Kiroku
description: A single reading surface for machine-generated research reports. Ledger discipline, Japanese-first typography, one accent.
colors:
  primary: "#15181D"
  secondary: "#555F6E"
  tertiary: "#0B62D6"
  neutral: "#FFFFFF"
  surface: "#F6F7F9"
  sunken: "#ECEEF1"
  border: "#DDE1E6"
  faint: "#5E6773"
  accentSoft: "#E7F0FD"
  positive: "#0F7B52"
  caution: "#8A5A00"
  critical: "#B3261E"
typography:
  h1:
    fontFamily: Hiragino Kaku Gothic ProN
    fontSize: 1.95rem
    fontWeight: 700
    lineHeight: 1.32
    letterSpacing: "-0.015em"
  h2:
    fontFamily: Hiragino Kaku Gothic ProN
    fontSize: 1.28rem
    fontWeight: 680
    lineHeight: 1.4
    letterSpacing: "-0.005em"
  h3:
    fontFamily: Hiragino Kaku Gothic ProN
    fontSize: 1.08rem
    fontWeight: 660
    lineHeight: 1.6
  lede:
    fontFamily: Hiragino Kaku Gothic ProN
    fontSize: 1.18rem
    fontWeight: 400
    lineHeight: 1.7
  body-md:
    fontFamily: Hiragino Kaku Gothic ProN
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.85
  body-sm:
    fontFamily: Hiragino Kaku Gothic ProN
    fontSize: 0.9rem
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: Hiragino Kaku Gothic ProN
    fontSize: 0.72rem
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.08em"
  mono:
    fontFamily: SFMono-Regular
    fontSize: 0.86rem
    fontWeight: 400
    lineHeight: 1.7
  figure:
    fontFamily: SFMono-Regular
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.2
rounded:
  sm: 4px
  md: 8px
  lg: 12px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  page:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    width: 46rem
  eyebrow:
    textColor: "{colors.faint}"
    typography: "{typography.label}"
  callout-note:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 16px
  callout-warn:
    backgroundColor: "#FFF8E6"
    textColor: "{colors.caution}"
    rounded: "{rounded.md}"
    padding: 16px
  callout-critical:
    backgroundColor: "#FDECEA"
    textColor: "{colors.critical}"
    rounded: "{rounded.md}"
    padding: 16px
  status-positive:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.positive}"
    typography: "{typography.body-sm}"
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
  tag:
    backgroundColor: "{colors.accentSoft}"
    textColor: "#08479B"
    rounded: 999px
    padding: 4px
  table-head:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.secondary}"
    typography: "{typography.label}"
    padding: 8px
  figure-value:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    typography: "{typography.figure}"
  code-block:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.primary}"
    typography: "{typography.mono}"
    rounded: "{rounded.md}"
    padding: 16px
  viz-card:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 16px
  viz-caption:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.faint}"
    typography: "{typography.label}"
    padding: 12px
  bar-track:
    backgroundColor: "{colors.sunken}"
    rounded: 999px
    height: 8px
  bar-fill:
    backgroundColor: "{colors.tertiary}"
    rounded: 999px
    height: 8px
---

## Overview

Kiroku (記録) is the reading surface for a private archive of machine-generated
research reports, read mostly on an iPhone and sometimes on a Mac. Its job is not
to have a personality. Its job is to make thirty reports written on thirty
different days feel like thirty chapters of the same book.

That constraint drives every decision here. A report may not bring its own
palette, its own fonts, or its own layout. It brings *structure* — headings,
tables, figures, callouts — and this system supplies the appearance. The reader
should be able to move between two reports and notice only that the subject
changed.

The visual reference points are documentation surfaces rather than marketing
sites: Mintlify's border-driven depth and near-total absence of shadow, and
Notion's warm, low-contrast reading comfort for long prose. What is deliberately
rejected is the current default look of AI-generated design — cream paper with a
high-contrast serif and a terracotta accent, or near-black with one acid accent.
Those read as costume. A report archive should read as a record.

## Colors

One accent, used only where the reader can act or where a number must be found.

- **Primary (#15181D):** Body text and headings. Not pure black; the slight blue
  cast reduces halation against white on an OLED phone screen at night.
- **Secondary (#555F6E):** Table headers, metadata, secondary prose. Passes AA on
  white at body size.
- **Tertiary (#0B62D6):** The only accent. Links, focus rings, active tags, the
  rule under a section heading. Never a decorative fill.
- **Neutral (#FFFFFF) / Surface (#F6F7F9) / Sunken (#ECEEF1):** Three levels of
  ground. Cards and callouts sit on Surface; code sits on Sunken.
- **Border (#DDE1E6):** Hairlines. This is the primary separation device — see
  Elevation.
- **Faint (#5E6773):** Eyebrow labels, footnotes, timestamps. The lightest text
  permitted; anything lighter fails AA at these sizes.
- **Positive / Caution / Critical:** Semantic only. Allowed in callouts, status
  cells, and figure deltas. Never as branding.

Dark mode is a required counterpart, not an afterthought — most reading happens
at night. It inverts the grounds and lightens the accent to `#6AA9FF`, keeping
the same token names so authored HTML is unaffected.

## Typography

Japanese first. The stack leads with Hiragino Kaku Gothic ProN and Hiragino Sans
(macOS/iOS), falls back to Noto Sans JP and Yu Gothic UI, and only then to
system sans. No webfont is loaded: a 300KB Japanese webfont is a poor trade for a
document read once, and the local Hiragino is better than anything we would fetch.

- **Body is 17px / 1.85.** Japanese needs more leading than Latin at the same
  size; 1.5 feels cramped with kanji. The measure is capped at 46rem, which lands
  near 38–40 full-width characters per line — inside the comfortable range for
  Japanese, where 30–40 is the target.
- **`font-feature-settings: "palt" 1`** is on globally. Without proportional
  alternates, full-width brackets and punctuation leave visible holes.
- **Headings step by ratio, not by drama.** h1 1.75rem, h2 1.3rem, h3 1.06rem.
  An h2 is distinguished as much by the hairline beneath it as by its size.
- **Numerals are tabular** (`font-variant-numeric: tabular-nums`) everywhere a
  figure appears — tables, stat blocks, metadata. Ledger columns must align.
- **Never italicize Japanese.** There is no true italic for Japanese faces, so
  `<em>` on Japanese text renders as a mechanical slant. The system renders `<em>`
  as 傍点 (`text-emphasis: dot`) instead, and reserves italic for Latin runs.
- **Two families only.** Sans for everything readable, mono for code and figures.
  No third face, no display face.

## Layout

- **Single column, 46rem, centered.** No sidebars. A sidebar TOC on a phone is
  a drawer nobody opens.
- **8px spacing scale**: 4, 8, 16, 24, 40. Section rhythm comes from consistent
  `margin-top` on headings (40px before h2), not from ad-hoc spacing.
- **Sticky header, 44px minimum tap targets**, `env(safe-area-inset-*)` respected
  on all four sides so the notch and home indicator never clip content.
- **Tables always scroll horizontally** inside a wrapper rather than widening the
  page. A wide table is the single most common way a generated report breaks a
  phone layout.
- **Figures (stat blocks) are a grid**, wrapping to one column under 480px.

## Elevation & Depth

Depth is border-driven, following Mintlify. Shadows are almost absent.

| Level | Treatment | Use |
|---|---|---|
| 0 | No border, no shadow | Prose |
| 1 | `1px solid {colors.border}` | Cards, callouts, table rules, section hairlines |
| 2 | Surface fill + Level 1 border | Callouts, figure blocks |
| 3 | `0 1px 2px rgba(0,0,0,.05)` | Cards on hover only |

A generated report has no need for elevation beyond this. Anything more reads as
decoration and breaks the archive's flatness.

## Shapes

- 4px on inline code and tags
- 8px on callouts, figures, code blocks
- 12px on cards
- 999px on tag pills only

No shape is used for decoration. There are no blobs, no gradients, no
illustrations.

## Components

The authored HTML uses a small, fixed vocabulary. Anything outside it still
renders (plain `<p>`, `<ul>`, `<table>` all work), but these carry the meaning
the reader depends on:

- **`.eyebrow`** — the one-line kicker above the title. Category, not decoration.
- **`.figures` / `.figure`** — the stat block. A figure is a value plus a label
  plus optional delta. Use it for numbers the reader will look for twice; do not
  use it to make the page look like a dashboard.
- **`.callout` (`.note` / `.warn` / `.critical`)** — a claim that must not be
  missed. One per section at most.
- **`.tag`** — taxonomy, set at ingest, not by the report body.
- **`table`** — the workhorse. Numeric columns right-aligned via `.num`.
- **`.source`** — the provenance line at the end. A research report without
  sources is an opinion.
- **`figure.viz`** — the frame for a viewer-drawn chart. Carries a `figcaption`
  and optionally a trailing `.note`. The report supplies values in `data-*`; the
  viewer draws the graphic, so every chart in the archive looks the same.
- **`.bars` / `.bar`** — magnitude comparison. `data-value` per row,
  `data-max` on the group to declare the ceiling, `data-label` for the unit.
- **`.spark`** — trend shape from `data-points`. Rendered as SVG, **anchored at
  zero** so a rise from 12 to 58 does not fill the band as if it climbed from
  nothing.
- **`ol.timeline`** — ordered process with `data-state` of done/active/todo.
- **`.versus`** — two-column A/B comparison for cases a table would over-serve.

## Motion

Motion exists to direct attention on first read, never to decorate.

- Figures fade and rise 8px when scrolled into view; bars grow to their value and
  sparklines draw along their path. Each runs once.
- Everything is **visible by default** and only animates once JS marks the
  document, so a script failure degrades to a static, readable figure rather than
  a blank box.
- A 2.5s timer force-reveals anything the observer missed, and `beforeprint`
  reveals everything. A figure parked at `opacity: 0` is indistinguishable from a
  broken chart — that must never be what the reader sees.
- `prefers-reduced-motion: reduce` disables all of it; the end state renders
  immediately.
- No parallax, no scroll-jacking, no looping animation. A report is read once.

## Do's and Don'ts

**Do**

- Emit semantic HTML and let the system style it.
- Put exactly one `<h1>` at the top, then descend without skipping levels — the
  TOC and the document outline are generated from these.
- Right-align numeric table columns with `class="num"`.
- Write the summary as one sentence that says what was found, not what the report
  is about.
- State units in the header cell, not repeated in every row.

**Don't**

- Don't include `<style>`, `<script>`, `<link>`, inline `style=`, or `<font>`.
  They are stripped, and a report that depends on them renders wrong.
- Don't set colors, fonts, or widths. There is no case where a report needs its
  own palette.
- Don't use `<table>` for layout, or nested tables.
- Don't use `<em>` on Japanese text for emphasis when you mean strong — use
  `<strong>`. `<em>` becomes 傍点 and carries a softer meaning.
- Don't invent heading levels below h4 or use `<h5>`/`<h6>`.
- Don't add a hand-written table of contents; it is generated.
