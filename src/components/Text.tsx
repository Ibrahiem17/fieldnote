// src/components/Text.tsx
//
// The one text primitive. Fonts and sizes come from the design system
// (src/theme/design.ts, design/DESIGN.md §2): condensed headings, DM Sans body.
//
// Two rules to know:
//  - Uppercase is OPT-IN (`upper`), never automatic. `title`/`subtitle` are used
//    for text a person typed (a project's name) as well as for fixed headings,
//    and typed text must keep its own capitalisation. Fixed headings, labels and
//    buttons ask for `upper` explicitly.
//  - With custom fonts `fontWeight` is ignored — the weight is baked into the
//    font family, so every variant names its family.
//
// On a coloured card the default text colour flips to the card's "on" colour
// (white on purple, ink on amber) through TextToneProvider, so nothing inside a
// card has to know what colour the card is.

import { createContext, useContext } from "react";
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";

import { splitTwoTone } from "@/theme/design";
import { useTheme } from "@/theme/ThemeProvider";

type Variant = "title" | "subtitle" | "body" | "caption" | "label";

export type TextTone = { color: string; muted: string };
const TextToneContext = createContext<TextTone | null>(null);
export const TextToneProvider = TextToneContext.Provider;

type TextProps = RNTextProps & {
  variant?: Variant;
  /** Use the muted colour instead of the main text colour. */
  muted?: boolean;
  color?: string;
  /** UPPERCASE with a little letter-spacing. Only for FIXED headings and labels. */
  upper?: boolean;
};

export function Text({ variant = "body", muted, color, upper, style, ...rest }: TextProps) {
  const theme = useTheme();
  const tone = useContext(TextToneContext);
  const { fonts, textStyles } = theme.design;

  const variantStyle: Record<Variant, TextStyle> = {
    title: { fontFamily: fonts.headingBold, fontSize: 34, lineHeight: 38, letterSpacing: 0.4 },
    subtitle: { fontFamily: fonts.headingSemi, fontSize: 26, lineHeight: 30, letterSpacing: 0.3 },
    body: textStyles.body,
    caption: textStyles.small,
    label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  };

  const resolvedColor =
    color ?? (muted ? (tone?.muted ?? theme.colors.textMuted) : (tone?.color ?? theme.colors.text));
  const upperStyle: TextStyle | null = upper ? { textTransform: "uppercase", letterSpacing: 1.2 } : null;

  return <RNText style={[variantStyle[variant], upperStyle, { color: resolvedColor }, style]} {...rest} />;
}

/**
 * The two-tone headline: the FIRST word light, the REST bold, in uppercase
 * condensed type ("CHOOSE" light + "YOUR FIGHTER" bold). The wording is passed in
 * unchanged; only how it's drawn differs. A one-word heading is just bold.
 */
export function TwoToneText({
  children,
  size = 34,
  color,
  style,
}: {
  children: string;
  size?: number;
  color?: string;
  style?: TextStyle;
}) {
  const theme = useTheme();
  const tone = useContext(TextToneContext);
  const { fonts } = theme.design;
  const { light, bold } = splitTwoTone(children);

  const base: TextStyle = {
    fontSize: size,
    lineHeight: Math.round(size * 1.1),
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: color ?? tone?.color ?? theme.colors.text,
  };

  return (
    <RNText accessibilityRole="header" style={[base, style]}>
      {light ? <RNText style={{ fontFamily: fonts.headingLight }}>{`${light} `}</RNText> : null}
      <RNText style={{ fontFamily: fonts.headingBold }}>{bold}</RNText>
    </RNText>
  );
}
