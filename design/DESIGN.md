# Fieldnote design system

The visual rules for restyling Fieldnote to match [`reference.png`](reference.png).
The values live in one file, [`src/theme/design.ts`](../src/theme/design.ts); this
document says **what they are, why, and where each one is used**.

> Not to be confused with [`docs/DESIGN.md`](../docs/DESIGN.md), which is the
> project's engineering decision log. This file is only about how the app *looks*.

## 0. Scope and rules

**Styling only.** No change to functionality, logic, data, navigation, routes or
state. Every button, icon, label and feature stays exactly as it is; only how it
looks changes.

- The reference is for a different app. **Its content, labels and icons are not
  copied** — only its design system: colour, type, shape, spacing, shadow, layout.
- Our existing emoji tab icons stay. Our text stays. (Headings become UPPERCASE
  only through styling, never by rewriting them.)
- **Light theme only** for now (decision: the reference is light; dark can be
  designed later). The app is locked to light so nothing renders half-styled.
- **The PDF report is unchanged.** It gets its own frozen palette so restyling the
  app can't alter it.

**Feel:** playful, warm, friendly, polished. Smooth press states, small scale animations.

## 1. Colour

Warm cream ground, charcoal ink, and three colour-coded card families.

| Token | Hex | Use | Contrast* |
| --- | --- | --- | --- |
| `cream` | `#F7F3E6` | App background | ink on it **13.6** |
| `sheet` | `#FFFCF4` | The light rounded sheet on coloured screens | muted ink **5.5** |
| `beige` | `#E6E0CC` | Secondary surface: inputs, quiet chips, icon-button fills | ink **11.4** |
| `ink` | `#2B2522` | Text, dark bottom nav. **Never pure black.** | cream on it **13.6** |
| `inkMuted` | `#6F655D` | Secondary text | **5.1** on cream |
| `purple` | `#8B63C9` | Hero cards, full-bleed screens (as a **surface**) | white on it **4.4** ⚠ |
| `purpleDeep` | `#7550B0` | Buttons and small text carrying white | white on it **5.9** ✓ |
| `amber` | `#F5B301` | Secondary cards | **ink** on it **8.2** ✓; white **1.9** ✗ |
| `olive` | `#708664` | Highlight banners (surface) | white on it **4.0** ⚠ |
| `oliveDeep` | `#5E7453` | Olive when it carries white text | white on it **5.1** ✓ |
| `sky` | `#3D9BE9` | Checkmarks / selection pops | — |
| `red` | `#C4342F` | Notification dot, errors | **4.9** on cream ✓ |
| `pink → sky` | gradient | Slider / progress tracks | — |

\*WCAG contrast ratio; 4.5 is the minimum for normal-size text, 3 for large/bold.

**Rules that come from those numbers**
1. **Text on amber is always ink**, never white (white fails badly).
2. White on `purple` is 4.4 — just under the limit. Use white on `purple` only for
   **large or bold** text (headings, card titles). Anything small that carries white
   sits on `purpleDeep`. Buttons are `purpleDeep`.
3. White on `olive` is 4.0 — same rule; small text uses `oliveDeep`.
4. Meaning is never carried by colour alone: a status colour always comes with its label.
5. Every category gets its own colour-coded card.

**Colour-coding (cards).** Project cards cycle purple → amber → olive so a list reads as a
stack of colour. Inspection status: Draft = beige, In progress = amber, Completed =
oliveDeep, Submitted = purpleDeep (each with its label).

**Small pops:** sky blue for checkmarks/selection, a red dot for notifications (e.g. the
"couldn't upload" problem state), a pink→sky gradient for progress tracks.

## 2. Typography

| Role | Family | Notes |
| --- | --- | --- |
| Headings | **Barlow Condensed** (Light 300, Medium 500, SemiBold 600, Bold 700) | Condensed techy grotesque; free lookalike for the reference |
| Body | **DM Sans** (Regular 400, Medium 500, Bold 700) | Friendly, clean, readable at small sizes |

Scale (px): caption 11 · small 13 · body 16 · body-large 18 · card title 26 · title 34 · display 44.

**The two-tone headline.** The **first word light, the rest bold** — "CHOOSE" light +
"YOUR FIGHTER" bold. `splitTwoTone()` does the split, so any existing heading text is
rendered this way **without changing its wording**. A single-word heading is just bold.

**Uppercase rule (decision).** UPPERCASE applies **only to my fixed headings and
labels** — screen titles, section headings, card-title text the app itself writes, tiny
captions, button labels. **Text people type is never uppercased** (project names, inspection
titles, notes, answers): long names would shout and become hard to read.

**Captions:** tiny (11px), uppercase, letter-spaced (1.6) — used for labels and metadata.

**With custom fonts, `fontWeight` does nothing.** The weight is part of the font family
name, so each style names its family explicitly (`textStyles` in `design.ts`).

**Legibility guards:** condensed Light is only used at 34px and up; anything smaller uses
SemiBold/Bold or the body font. Form question labels stay in DM Sans (medium) so long
questions remain readable.

## 3. Shape and surfaces

- **Radii:** cards 32, hero cards and the sheet's top corners 36, inputs 20, **pill = 999**
  (buttons, nav, chips, badges), circular icon buttons 44px (radius 22).
- **Stacked cards** overlap slightly (`cardOverlap` 18px) with a **soft wavy top edge**
  (drawn with `react-native-svg`), each colour-coded.
- **Soft gradients and a glossy inner highlight** (`expo-linear-gradient`): a diagonal
  gradient on the card, plus a translucent white gloss fading out by the middle.
- **Circular icon buttons** (44px) with **translucent fills** (`overlayLight` on colour,
  `overlayDark` on cream).
- **Arch / rounded-pill frames** for any image or avatar-style element.

## 4. Shadows

Diffuse and **tinted with the surface's own colour** — a purple card casts a purple glow,
not a grey one. `tintedShadow(color, "soft" | "card" | "float")`. Android 9+ (the A51 runs
13) tints `elevation` shadows with `shadowColor`, so one style serves both platforms;
Android blurs less than iOS, so shadows are a little tighter than the reference.

## 5. Layout

Single-column mobile, **generous padding (22px screen gutter)**.

- **Header:** screen title left, circular icon buttons right (only where the app already
  has such actions — nothing is added).
- **Big friendly two-tone headline** under the header.
- **Stacked full-width colourful cards**, each with a circular action slot top-right.
- **Floating dark pill bottom nav** (charcoal, 20px above the bottom, 40px side margins);
  the **active tab is a light rounded square**. Lists get `navClearance` extra bottom
  padding so the last card clears it.
- **List / schedule screens:** full-bleed purple background, horizontal **pill chips** on
  it, then a **cream rounded sheet** below with a **vertical timeline** and **colour-coded
  line segments**.
- **Selection / onboarding screens:** cream background, a large arch hero card, centred
  two-tone heading, one wide purple pill button.

## 6. Motion

Pressed elements scale to 0.97 (90 ms) and spring back (damping 14, stiffness 240);
cards fade/slide up on entry with a 55 ms stagger. Built with the already-installed
`react-native-reanimated`. Reduced-motion settings are respected (no scale/stagger).

## 7. How my screens and components map to the reference

| Mine | Reference pattern | Notes |
| --- | --- | --- |
| Sign-in / Create account | Selection/onboarding (cream, centred two-tone heading, wide purple pill) | Inputs become beige pills; the mode toggle is a quiet pill |
| Projects tab | Header + big headline + **stacked colour-coded cards** | Cards cycle purple/amber/olive; whole card is tappable (as today) |
| Inspections tab | **Full-bleed purple + cream sheet with timeline** | My existing filter chips play the reference's date-chip role; a status-coloured line segment per row |
| Project detail | Hero card + sheet | Name/client/address on the purple hero; inspections in the sheet |
| New Project / New Inspection | Selection layout | Beige pill inputs, pill chips (wrapping), wide purple pill button |
| Inspection detail (the form) | Purple header + cream sheet | Sections get two-tone headings; **"Finish up"** becomes a colour-coded card |
| Settings | Stacked colour-coded cards | Account / Uploading / Developer tools each their own colour |
| Bottom tabs | **Floating dark pill nav** | Existing emoji icons kept; active tab on a light rounded square |
| `UploadBanner` | The **olive highlight banner** | Problem state gets the red dot |
| `Toast` | Small dark/olive pill | |
| `Badge` / `SyncStatusDot` | Pills | Status colours from §1; labels unchanged |
| `EmptyState` | Cream + two-tone heading | The "How Fieldnote works" steps become a soft card |
| `Button` | Wide purpleDeep pill; secondary = beige pill | 56px tall, condensed uppercase label |
| `Input` | Beige pill/rounded field | 20px radius, label as caption |
| Photo viewer, signature pad | **Unchanged surfaces** | Black viewer and white signature canvas stay (function); only their buttons restyle |

## 8. Implementation notes

- **Fonts:** `@expo-google-fonts/barlow-condensed` + `@expo-google-fonts/dm-sans`, loaded
  with `expo-font` at startup; the app shows its existing loading state until they're ready.
- **Native packages added:** `expo-linear-gradient`, `react-native-svg` — these need **one
  new development build** (started; fonts don't need one).
- **Wiring plan:** `src/theme/tokens.ts` (read by `ThemeProvider`) re-exports from
  `design.ts`, keeping the existing key names (`bg`, `surface`, `text`, `primary` …) so
  components don't break; new keys are added alongside. The PDF's palette is copied to a
  frozen file first, so it cannot change.
- **Review process:** shared components first (Button, Card, Input, Text, Badge, Screen,
  tab bar), then one screen at a time — pausing after each for review.

## 9. Things that may not map cleanly (flagged now, resolved as we go)

1. **Circular action button on cards.** The reference cards have a ↗ button; ours are
   tappable as a whole with no separate button. Adding a glyph would add an icon, which the
   rules forbid — so the slot is used only where I already have an element (e.g. an
   inspection's sync/status badge).
2. **The reference's greeting header and avatar, date chips, calendar, "budget" slider**
   have no counterpart in my app and are **not** added; only their look is borrowed.
3. **Emoji inside the dark nav pill** will look busier than the reference's line icons.
4. **Very long user-typed names** on colour-coded cards must truncate gracefully.
5. **Wavy card edges inside a scrolling list** need care for performance and for the last
   card clearing the floating nav.
6. **Forms are long and dense** (the inspection form) — the two-tone condensed style is
   applied to headings, while question labels stay in the readable body font.
7. **Android shadows** are less diffuse than the reference's.
