# UMAL Management — Design Brief

| | |
|---|---|
| **Version** | 2.0 · Draft · 2026-11-10 |
| **Strict reference** | University of Mindanao official website — https://umindanao.edu.ph (inspected 2026-11-10) |
| **Applies to** | All screens in [App Flow](03-app-flow.md) |

---

## 1. Direction

UMAL is the University of Mindanao's ambassador corps, so the app should feel like an **official UM product**. It should use the same maroon and gold, the same type and the same calm, institutional confidence as umindanao.edu.ph, tuned for a dense, daily-use admin tool.

- **Institutional, not corporate.** Maroon carries identity. Gold is a highlight used sparingly, the way UM uses it to emphasise one word ("Quality, **Affordable,** and Open Education").
- **Calm workspace.** White and near-white surfaces with neutral grey borders. Colour is reserved for brand moments, status and primary actions.
- **Trustworthy AI.** AssignAI looks like a careful assistant, not a toy. It always shows *why*, never sparkles or gradients on data.

> **Source of truth.** Every token in §3–§4 was read from the live UM site's CSS custom properties (`:root`) and computed styles on 2026-11-10. The UM site itself is built on the same shadcn/ui token names this app uses, so the values map one-to-one.

## 2. Brand assets and usage rules

| Asset | Rule |
|---|---|
| **UMAL logo** | Primary mark in the app header, login panel and favicon. Mark will provide official SVG/PNG files (PRD §9, still open). Don't redraw or recolour it. |
| **UM seal + "UM / The University of Mindanao" wordmark** | Used on umindanao.edu.ph as the header lockup (seal, then a large serif "UM" in maroon with the full name beneath). Show it in this app **only with written permission** from the university's marketing or PR office. Until then, use the text "University of Mindanao" in Poppins 500 as an endorsement line under the UMAL mark. |
| **Photography** | UM uses full-bleed campus and event photos under maroon overlays. Use only UMAL's own event photos, with consent, on the login panel only. Don't take photos from the UM site. |
| **Tone of copy** | UM's voice is confident and institutional ("First in Leadership Education", "Quality, Affordable, and Open Education"). In-app copy stays plain and direct: sentence case, short labels, no exclamation marks except success toasts. |

## 3. Colour tokens

These are the shadcn CSS variables. Values marked **UM** are copied from the UM site's `:root`. Values marked **App** are additions required for accessibility or status and derived from the UM palette.

```css
:root {
  /* UM brand */
  --primary: #A50511;            /* UM maroon — buttons, active nav, links, key numbers   (UM) */
  --primary-foreground: #FAFAFA; /*                                                         (UM) */
  --secondary: #FFB600;          /* UM gold — highlights, badges on maroon, focus accents (UM) */
  --secondary-foreground: #1C1C1C; /* App: UM uses #fff, but white on gold is 1.76:1 → use near-black (9.69:1) */
  --maroon-deep: #A41E22;        /* secondary maroon seen on UM site — hover/pressed       (UM) */
  --accent-foreground: #FFA42E;  /* warm orange accent                                     (UM) — decorative only */

  /* Surfaces & text */
  --background: #FFFFFF;         /* (UM) */
  --foreground: #1C1C1C;         /* body text (UM) */
  --card: #FFFFFF;  --card-foreground: #0A0A0A;          /* (UM) */
  --popover: #FFFFFF; --popover-foreground: #0A0A0A;     /* (UM) */
  --muted: #F5F5F5;              /* (UM) */
  --muted-foreground: #666666;   /* App: UM's #737373 fails AA on #F5F5F5 (4.35:1); #666 = 5.7:1 on white */
  --border: #EDEDED;             /* (UM) */
  --input: #E5E5E5;              /* (UM) */
  --ring: #A50511;               /* App: focus ring in maroon (UM uses #0A0A0A) */
  --radius: 0.5rem;              /* (UM) */

  /* Dark band (UM footer/top strips use #000 and #171717) */
  --ink: #171717;                /* (UM) */

  /* Sidebar (UM values) */
  --sidebar: #FAFAFA; --sidebar-foreground: #3F3F46; --sidebar-border: #E8E8E8;
  --sidebar-accent: #F0F0F0; --sidebar-accent-foreground: #4D4D4D;
  --sidebar-primary: #A50511;    /* App: UM uses #1A1A1A; maroon for active item to carry brand */

  /* Status (App — AA on white) */
  --destructive: #B91C1C;        /* App: UM's #EF4444 with white text is 3.76:1 → darkened (6.47:1) */
  --success: #15803D;            /* 5.02:1 */
  --warning-foreground: #8A6100; /* gold-family text on white 5.54:1; badge bg = #FFF4D6 */
  --info: #1D4ED8;               /* 6.7:1 */

  /* Charts — UM site palette (UM) */
  --chart-1: #A50511; /* App: lead series in maroon */
  --chart-2: #FFB600; --chart-3: #274754; --chart-4: #2A9D90; --chart-5: #E76E50;
}
```

### Contrast rules (measured)

| Pair | Ratio | Use |
|---|---|---|
| Maroon `#A50511` on white | **7.99:1** | Text, icons, buttons ✅ |
| White on maroon | 7.99:1 | Primary button label, header band ✅ |
| Gold `#FFB600` on maroon | **4.54:1** | Gold text/badges on maroon bands ✅ (AA normal) |
| Near-black `#1C1C1C` on gold | 9.69:1 | Gold badge labels ✅ |
| Gold on white | **1.76:1** | ❌ **Never** for text or thin icons on white. Gold on white only as fills ≥ 3 px (underline bars, progress fill) next to text that already carries the meaning. |
| `#666666` on `#F5F5F5` | 5.3:1 | Secondary text on muted surfaces ✅ |

### Colour proportion

About **80% neutrals, 15% maroon, 5% gold**. Maroon is for primary actions, the active nav item, headings with key numbers, and the login/brand panel. Gold is for one highlight per view at most: the "remaining slots" pill, a gold underline under page titles (UM uses a gold rule under its hero), and new-item badges.

## 4. Typography

UM uses **Poppins** for everything (headings 700–900, body 400). The app self-hosts it with `next/font/google` (subsets: latin; weights 400, 500, 600, 700, 800).

| Role | Size / line-height | Weight | Colour |
|---|---|---|---|
| Display (login, empty-state hero) | 36/44 | 800 | white on maroon or `--foreground` |
| Page title (H1) | 24/32 | 700 | `--foreground`, with a 3 px gold underline bar 40 px wide below |
| Section title (H2) | 18/28 | 600 | `--foreground` |
| Card title | 16/24 | 600 | `--foreground` |
| Body | 14/22 | 400 | `--foreground` |
| Secondary / meta | 13/20 | 400 | `--muted-foreground` |
| Label / table header | 12/16, uppercase, tracking +0.04em | 600 | `--muted-foreground` |
| KPI number | 32/36, tabular-nums | 800 (UM uses 900 for stats) | `--primary` |

- Numbers in tables and KPIs use `font-variant-numeric: tabular-nums`.
- Never use serif type. The serif "UM" belongs only to the university's own wordmark.

## 5. Layout and spacing

- **Grid:** 4 px base. Spacing scale 4, 8, 12, 16, 24, 32, 48.
- **Adviser shell:**
  - 256 px sidebar (`--sidebar` background, maroon active item with a 3 px gold left bar)
  - 56 px top bar (white, bottom border `--border`) holding page title, term switcher and user menu
  - content max width 1280 px, 24 px padding
- **Member shell:**
  - white top bar with the UMAL mark left and nav centred
  - content max width 960 px
- **Brand band:** a full-width maroon band, matching UM's maroon hero sections, appears only on Login, Onboarding header and the Dashboard greeting strip (white text, gold highlight word).
- **Radius:** `--radius` 8 px for cards and inputs, 6 px for buttons and nav items (matches UM nav buttons), full for avatars and pills.
- **Elevation:** borders first. Shadows only on popovers, dialogs and sheets (`0 8px 24px rgb(0 0 0 / 0.08)`).
- **Breakpoints:** 360 (min), 640, 768, 1024, 1280. Below 1024 the sidebar collapses into a sheet.

## 6. Components (shadcn/ui, themed)

| Component | Spec |
|---|---|
| **Button** | `default` = maroon background, white text, hover `--maroon-deep`. `secondary` = white background with `--border`, text `--foreground`. `ghost` for toolbars. `destructive` = `#B91C1C`. Gold buttons are not allowed (contrast). Height 36 (sm 32, lg 44 touch). |
| **Badge / status pill** | Event: draft (grey `#F5F5F5`/`#3F3F46`), published (maroon tint `#FBE9EA`/`#A50511`), completed (`#E8F5EC`/`#15803D`), cancelled (`#F5F5F5`/`#666`, strike-through title). Assignment: assigned (info tint), attended (success), no_show (destructive tint `#FDECEC`/`#B91C1C`), excused (warning `#FFF4D6`/`#8A6100`), cancelled (grey). |
| **Eligibility badge** | ✅ Eligible (success), ⚠ Class conflict (warning), ⛔ reason (destructive tint). Always icon **and** text; never colour alone. |
| **Staffing progress** | 6 px bar, track `--muted`, fill maroon. Full = success green. Over capacity isn't possible. Label `4 / 6` in tabular numbers. One bar per shift on event detail; one overall bar on cards. |
| **Shift chip** | Outline pill: label + time (`Day 2 · Sat 08:00–17:00`) + staffing `4/6`. Selected = maroon tint `#FBE9EA` with maroon border. A fully staffed shift shows a green check. |
| **KPI card** | White card, label (12 px uppercase muted), value (32 px maroon 800), delta/meta line. |
| **Tables** | shadcn DataTable, 44 px rows, sticky header `#FAFAFA`, row hover `#FAFAFA`, selected row maroon tint `#FBE9EA`. |
| **Forms** | Label above the field, helper text in muted, error text `#B91C1C` with icon, required asterisk in maroon. |
| **Toasts** | Sonner; success uses a green left bar, errors a destructive bar. |
| **Schedule grid** | Columns Mon–Sat, rows every 30 min from 07:00 to 21:00. Class blocks have a maroon tint fill `#FBE9EA` with a 2 px maroon left border. Unavailability blocks are diagonal-hatched grey. Event preview overlays are dashed gold border. |

## 7. AssignAI panel

| Element | Spec |
|---|---|
| Header | "AssignAI" in Poppins 600, a small maroon assistant icon (lucide `bot`; no sparkle icons), plus the provider status dot (green / amber / grey). |
| Adviser bubble | Right-aligned, maroon background, white text, radius 12 px with a 4 px corner on the sender side. |
| Assistant bubble | Left-aligned, `--muted` background, `--foreground` text. `assumptions` render below it as outline chips: "Assumed: …". |
| Input | Multiline textarea, Enter sends, Shift+Enter adds a newline. Placeholder: *"e.g. 6 ushers — 3 male, 3 female, tall, no one with class"*. Quick-reply chips sit above the input when `clarify`. |
| Constraints card | Shown as editable rows, not raw JSON. One row per group: `[count] × [gender] · [colleges] · [new/returning] · [year] · [height]`. Global rows: "Class conflicts: Not allowed" switch and an ordered priority list. Fields changed by the last turn get a gold outline for 2 s. |
| Shift scope bar | Row of shift chips + "All shifts" above the split view; a segmented "Same team / Different per shift" toggle appears when > 1 shift is selected. Hidden for single-shift events. |
| Pick card | Name 600, meta line (college · year · hours this term), score bar (maroon), "Why" disclosure showing the three component chips, ✕ remove. |
| Shortfall callout | Warning tint `#FFF4D6`, text `#8A6100`, with the action button "Allow any college (+5)". |
| Approve bar | Sticky bottom bar: "Approve 4 volunteers" (primary), plus a "Remaining after: 2 slots" pill (gold fill, `#1C1C1C` text). |

Motion: 150 ms ease-out for highlights and panel transitions. Respect `prefers-reduced-motion`. No typing animation for AI replies; show a 3-dot skeleton while waiting.

## 8. Accessibility (WCAG 2.2 AA)

- All text pairs meet the §3 ratios. Use the CI check `pnpm test:contrast`, which asserts the token pairs.
- Focus ring: 2 px `--ring` (maroon) plus a 2 px white offset. Never remove outlines.
- Touch targets are ≥ 44 × 44 px on mobile.
- Status always has icon + text. Charts include a data table toggle.
- Forms use real `<label>`s, `aria-describedby` for errors, and error summaries on submit.
- The AssignAI chat log is an `aria-live="polite"` region; new picks are announced as "4 recommendations updated".
- Respect `prefers-reduced-motion`. The schedule grid has a list alternative (the mobile view) available on desktop too.

## 9. Iconography and illustration

- **Icons:** lucide-react at stroke 1.75 and 16/20 px, inheriting text colour.
- **Illustrations:** none, except simple maroon/gold line spot illustrations on empty states (original, abstract shapes). No cartoon characters and no university mascots.

## 10. Do / Don't

| Do | Don't |
|---|---|
| Use maroon for the one primary action per view | Put gold text or icons on white |
| Use a gold underline bar under page titles, as UM's hero rule does | Use gradients on data, glassmorphism or neon "AI" styling |
| Keep cards white with `#EDEDED` borders | Use the UM seal or serif "UM" wordmark without permission |
| Show reasons next to every AI pick | Show raw JSON to advisers |
| Use real UMAL event photos (with consent) on login | Copy photos or banners from umindanao.edu.ph |

## 11. Reference observations (umindanao.edu.ph, 2026-11-10)

- **Tech:** the site's `:root` uses shadcn variable names: `--primary:#a50511`, `--secondary:#ffb600`, `--foreground:#1c1c1c`, `--muted:#f5f5f5`, `--muted-foreground:#737373`, `--border:#ededed`, `--input:#e5e5e5`, `--destructive:#ef4444`, `--radius:.5rem`. Charts use `#e76e50 #2a9d90 #274754 #e8c468 #f4a462`.
- **Type:** Poppins on 430 of 433 sampled elements. Hero headings are 700 white on maroon, stat numbers 900 maroon.
- **Composition:**
  - white sticky header with the seal + UM wordmark left and a hamburger (mobile)
  - maroon full-bleed hero carousel with a gold rule beneath
  - bold white headline with one gold-highlighted word
  - floating circular maroon (chat) and gold (back-to-top) buttons
  - near-black bands for footer areas
- **Academic units listed on the site** (used for the catalog seed): CAE, CAFAE, CASE, CBAE, CCE, CCJE, CEE, CHE, CHSE, CTE, CLE, PS, TS, BED.
