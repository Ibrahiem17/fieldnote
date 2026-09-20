// src/theme/design.ts
//
// THE design system: one place for every colour, font, radius, shadow, spacing
// value and motion setting. It is derived from design/reference.png and is
// documented, with the reasoning and the contrast numbers, in design/DESIGN.md.
//
// STATUS: created, not yet wired in. src/theme/tokens.ts (what the app reads
// today) is untouched until this file has been reviewed; the next step makes
// tokens.ts / ThemeProvider read from here. Styling only — nothing in this file
// knows about screens, data or navigation.
//
// Rules of thumb (full versions in design/DESIGN.md):
//   - Colours: warm cream background, ink (never pure black) text, purple as the
//     main colour, amber and olive as secondary cards. Text on amber is INK.
//   - Type: condensed heading font (often UPPERCASE) + friendly body font. With
//     custom fonts React Native ignores `fontWeight`; the WEIGHT IS THE FAMILY.
//   - Shapes: very large radii, pills for buttons/nav/chips.
//   - Shadows: diffuse, tinted with the surface's own colour.

import type { TextStyle, ViewStyle } from "react-native";

// ─── Colour ───────────────────────────────────────────────────────────────────

/** Raw palette — the reference's colours, named for what they ARE. */
export const palette = {
  cream: "#F7F3E6", //  app background
  sheet: "#FFFCF4", //  the light rounded sheet that sits on coloured screens
  beige: "#E6E0CC", //  secondary surface: inputs, quiet chips, icon-button fills
  ink: "#2B2522", //    text, bottom nav — charcoal, never pure black
  inkMuted: "#6F655D", // secondary text (5.1:1 on cream)

  purple: "#8B63C9", // hero cards, full-bleed screens (surface colour)
  purpleDeep: "#7550B0", // buttons / small text carrying white (5.9:1)
  purpleSoft: "#B79BE3", // translucent fills, disabled tints

  amber: "#F5B301", // secondary cards — text on it is INK (8.2:1), never white
  amberDeep: "#E09A00",

  olive: "#708664", // highlight banners (surface only)
  oliveDeep: "#5E7453", // olive when it carries white text (5.1:1)

  sky: "#3D9BE9", //   checkmarks / selection
  pink: "#F58FB2", //  slider-track gradient start
  red: "#C4342F", //   notification dot, errors (4.9:1 on cream)

  white: "#FFFFFF",
} as const;

/**
 * Semantic colours. The FIRST ten keys keep the names the app already reads
 * (theme.colors.bg / surface / text …) so wiring this in doesn't touch a
 * component; the rest are the design's own additions.
 */
export const colors = {
  // existing names, re-pointed
  bg: palette.cream,
  surface: palette.sheet,
  text: palette.ink,
  textMuted: palette.inkMuted,
  primary: palette.purple,
  primaryText: palette.white,
  border: "rgba(43,37,34,0.12)", // hairline on cream, tinted with ink
  danger: palette.red,
  success: palette.oliveDeep,
  warning: palette.amberDeep,

  // additions
  beige: palette.beige,
  ink: palette.ink,
  primaryDeep: palette.purpleDeep, // use for buttons and small text on purple
  primarySoft: palette.purpleSoft,
  accent: palette.amber,
  accentDeep: palette.amberDeep,
  highlight: palette.olive,
  highlightDeep: palette.oliveDeep,
  select: palette.sky,
  notification: palette.red,
  onPrimary: palette.white,
  onAccent: palette.ink, // amber + white FAILS contrast (1.85:1): always ink
  onHighlight: palette.white, // only ever on oliveDeep, or bold/large on olive
  onDark: palette.cream, // text on the dark nav pill
  overlayLight: "rgba(255,255,255,0.28)", // translucent icon-button fill on colour
  overlayDark: "rgba(43,37,34,0.10)", //  translucent icon-button fill on cream
} as const;

/** Each kind of thing gets its own colour (the reference's colour-coded cards). */
export const cardColors = {
  primary: { fill: palette.purple, on: palette.white, glow: palette.purple },
  accent: { fill: palette.amber, on: palette.ink, glow: palette.amber },
  highlight: { fill: palette.olive, on: palette.white, glow: palette.olive },
  neutral: { fill: palette.beige, on: palette.ink, glow: palette.ink },
} as const;
export type CardColorKey = keyof typeof cardColors;

/** Project cards cycle through these, so a list reads as a stack of colours. */
export const cardCycle: readonly CardColorKey[] = ["primary", "accent", "highlight"];

/** Inspection status → colour. Meaning is never carried by colour alone (a label always shows). */
export const statusColors = {
  draft: { fill: palette.purpleSoft, on: palette.ink },
  in_progress: { fill: palette.amber, on: palette.ink },
  completed: { fill: palette.oliveDeep, on: palette.white },
  submitted: { fill: palette.purpleDeep, on: palette.white },
} as const;

/** Gradients for <LinearGradient colors={…} start end>. Top-left → bottom-right. */
export const gradients = {
  primary: ["#9169D0", palette.purple, "#7048AE"],
  accent: ["#FFC933", palette.amber, "#EBA000"],
  highlight: ["#7F9573", palette.olive, "#5F7554"],
  /** Slider track: pink → blue. */
  track: [palette.pink, palette.sky],
  /** Glossy inner highlight laid over a card: bright at the top, gone by the middle. */
  gloss: ["rgba(255,255,255,0.32)", "rgba(255,255,255,0)"],
} as const satisfies Record<string, readonly string[]>;
export const gradientDirection = {
  diagonal: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  vertical: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  horizontal: { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

/**
 * Font family names as registered by expo-font from the @expo-google-fonts
 * packages. With custom fonts the weight is baked into the family: setting
 * `fontWeight` on these does nothing.
 */
export const fonts = {
  headingLight: "BarlowCondensed_300Light",
  headingMedium: "BarlowCondensed_500Medium",
  headingSemi: "BarlowCondensed_600SemiBold",
  headingBold: "BarlowCondensed_700Bold",
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodyBold: "DMSans_700Bold",
} as const;

export const fontSize = {
  caption: 11, //  tiny spaced uppercase labels
  small: 13,
  body: 16,
  bodyLg: 18,
  cardTitle: 26, // condensed, uppercase
  title: 34,
  display: 44, //  the big two-tone headline
} as const;

/** Uppercase condensed text wants air between letters, especially when small. */
export const letterSpacing = { caption: 1.6, heading: 0.6, body: 0 } as const;

/**
 * Ready-made text styles. `Text` variants map onto these (title → display/title,
 * subtitle → cardTitle, body → body, label/caption → caption).
 * `uppercase` is applied ONLY to fixed headings and labels — never to text a
 * person typed (project names, inspection titles).
 */
export const textStyles = {
  display: { fontFamily: fonts.headingLight, fontSize: fontSize.display, lineHeight: 48, letterSpacing: letterSpacing.heading, textTransform: "uppercase" },
  displayBold: { fontFamily: fonts.headingBold, fontSize: fontSize.display, lineHeight: 48, letterSpacing: letterSpacing.heading, textTransform: "uppercase" },
  title: { fontFamily: fonts.headingLight, fontSize: fontSize.title, lineHeight: 38, letterSpacing: letterSpacing.heading, textTransform: "uppercase" },
  titleBold: { fontFamily: fonts.headingBold, fontSize: fontSize.title, lineHeight: 38, letterSpacing: letterSpacing.heading, textTransform: "uppercase" },
  cardTitle: { fontFamily: fonts.headingSemi, fontSize: fontSize.cardTitle, lineHeight: 30, letterSpacing: letterSpacing.heading, textTransform: "uppercase" },
  body: { fontFamily: fonts.body, fontSize: fontSize.body, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: fontSize.body, lineHeight: 23 },
  small: { fontFamily: fonts.body, fontSize: fontSize.small, lineHeight: 19 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: fontSize.caption, lineHeight: 15, letterSpacing: letterSpacing.caption, textTransform: "uppercase" },
  button: { fontFamily: fonts.headingSemi, fontSize: 20, lineHeight: 24, letterSpacing: letterSpacing.heading, textTransform: "uppercase" },
} as const satisfies Record<string, TextStyle>;

/**
 * The two-tone headline rule: the FIRST word light, the REST bold
 * ("CHOOSE" light + "YOUR FIGHTER" bold). `splitTwoTone` does the split so any
 * existing heading text can be rendered this way without changing its wording.
 */
export function splitTwoTone(text: string): { light: string; bold: string } {
  const trimmed = text.trim();
  const space = trimmed.indexOf(" ");
  return space < 0
    ? { light: "", bold: trimmed } // a single word is just bold
    : { light: trimmed.slice(0, space), bold: trimmed.slice(space + 1) };
}

// ─── Shape ────────────────────────────────────────────────────────────────────

export const radius = {
  sm: 12,
  md: 20, //   inputs, small tiles
  card: 32, // stacked colour cards
  cardLg: 36, // hero cards, the sheet's top corners
  sheet: 36,
  pill: 999, // buttons, nav, chips, badges
  icon: 22, //  half of iconButton — a circle
} as const;

export const size = {
  iconButton: 44, // circular icon buttons
  buttonHeight: 56, // full-width pill buttons
  navHeight: 64, //  floating bottom nav
  navActive: 48, //  the light rounded square behind the active tab
  hit: 44, //        minimum tap target
} as const;

// ─── Spacing & layout ─────────────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  gutter: 22, // screen padding (design range 20–24)
  cardGap: 16, // between stacked cards
  cardPad: 22, // inside a card
} as const;

export const layout = {
  /** Cards visually tuck under the one above by this much (wavy top edge overlap). */
  cardOverlap: 18,
  /** Floating dark pill nav. */
  nav: { bottomOffset: 20, sideMargin: 40 },
  /** Extra bottom padding lists need so the last card clears the floating nav. */
  navClearance: 104,
  /** Full-bleed coloured header area on list screens before the cream sheet begins. */
  heroHeight: 190,
} as const;

// ─── Shadow ───────────────────────────────────────────────────────────────────

/**
 * A diffuse shadow tinted with the surface's own colour (a purple card casts a
 * purple glow, not grey). On Android 9+ (the A51 runs 13) `shadowColor` also
 * tints the `elevation` shadow, so one object serves both platforms. Android
 * blurs less than iOS, so the values are a compromise.
 */
export function tintedShadow(color: string, strength: "soft" | "card" | "float" = "card"): ViewStyle {
  const s = { soft: [6, 14, 0.18, 6], card: [12, 24, 0.34, 12], float: [18, 32, 0.4, 18] }[strength];
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: s[0] },
    shadowRadius: s[1],
    shadowOpacity: s[2],
    elevation: s[3],
  };
}
export const neutralShadow = tintedShadow(palette.ink, "soft");

// ─── Motion ───────────────────────────────────────────────────────────────────

export const motion = {
  /** Pressed elements shrink slightly, then spring back. */
  pressScale: 0.97,
  pressInMs: 90,
  spring: { damping: 14, stiffness: 240, mass: 0.7 },
  /** Cards fading up when a list appears. */
  enterMs: 260,
  staggerMs: 55,
} as const;

// ─── The whole thing, for ThemeProvider ───────────────────────────────────────

export const design = {
  palette,
  colors,
  cardColors,
  cardCycle,
  statusColors,
  gradients,
  gradientDirection,
  fonts,
  fontSize,
  letterSpacing,
  textStyles,
  radius,
  size,
  spacing,
  layout,
  motion,
} as const;

export type Design = typeof design;
