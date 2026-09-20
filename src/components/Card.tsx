// src/components/Card.tsx
//
// A surface with very large rounded corners and a soft shadow. By default it is
// the light "sheet" colour. Give it a `tone` and it becomes one of the design's
// colour-coded cards (purple / amber / olive / beige): a soft gradient, a glossy
// highlight at the top, and a shadow tinted with its own colour. Text inside a
// toned card switches to the right "on" colour automatically (TextToneProvider),
// so callers never pick text colours by hand.
//
// If `onPress` is given the whole card is tappable and shrinks slightly while
// pressed. The shadow sits on the outer view and the gradient is clipped by an
// inner one, because clipping the outer view would also clip its shadow on iOS.

import { StyleSheet, View, type ViewProps } from "react-native";

import { neutralShadow, tintedShadow, type CardColorKey } from "@/theme/design";
import { useTheme } from "@/theme/ThemeProvider";
import { GradientFill } from "./GradientFill";
import { Icon } from "./Icon";
import { WavyEdge } from "./WavyEdge";
import { PressableScale } from "./PressableScale";
import { Rise } from "./Rise";
import { TextToneProvider } from "./Text";

type CardProps = ViewProps & {
  /** If given, the whole card becomes tappable. */
  onPress?: () => void;
  /** Only meaningful (and only applied) when `onPress` is set. */
  accessibilityLabel?: string;
  /** Colour-code the card. Omit for the plain light sheet. */
  tone?: CardColorKey;
  /** Show the round arrow button top-right (only with `onPress`): a plain "open this" cue. */
  arrow?: boolean;
  /** Give the card the design's rippled top edge (needs a `tone`). */
  wavy?: boolean;
  /** Which way the ripple starts, so stacked cards don't match. */
  waveFlip?: boolean;
  /** If given, the card fades up when it appears; the number staggers it after earlier cards. */
  enterIndex?: number;
};

export function Card({
  style,
  onPress,
  accessibilityLabel,
  tone,
  arrow,
  wavy,
  waveFlip,
  enterIndex,
  children,
  ...rest
}: CardProps) {
  const { colors, radius, spacing, cardColors, gradients, gradientDirection } = useTheme().design;
  const spec = tone ? cardColors[tone] : null;

  const isWavy = Boolean(wavy && spec && tone && tone !== "neutral");
  const waveHeight = 26;

  const container = [
    {
      borderRadius: radius.card,
      ...(isWavy ? { borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: waveHeight - 1 } : null),
      padding: spacing.cardPad,
      backgroundColor: spec ? spec.fill : colors.surface,
    },
    spec ? tintedShadow(spec.glow, "card") : neutralShadow,
    style,
  ];

  // Muted text on a coloured card: the card's own text colour, a little softer.
  const muted = spec ? (spec.on === "#FFFFFF" ? "rgba(255,255,255,0.86)" : "rgba(43,37,34,0.72)") : "";

  const body = (
    <>
      {spec && tone && tone !== "neutral" ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radius.card, overflow: "hidden" },
            isWavy ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : null,
          ]}
        >
          <GradientFill
            colors={gradients[tone]}
            fallback={spec.fill}
            {...(isWavy ? gradientDirection.vertical : gradientDirection.diagonal)}
          />
          {/* No gloss on rippled cards: it would lighten the body under the wave and leave a seam. */}
          {isWavy ? null : (
            <GradientFill
              colors={gradients.gloss}
              fallback="transparent"
              {...gradientDirection.vertical}
              style={{ height: "55%", bottom: undefined }}
            />
          )}
        </View>
      ) : null}
      {isWavy && spec && tone && tone !== "neutral" ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: -(waveHeight - 1) }}>
          <WavyEdge color={gradients[tone][0]} height={waveHeight} flip={waveFlip} />
        </View>
      ) : null}
      {children}
      {onPress && arrow ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: spacing.md,
            right: spacing.md,
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: spec && spec.on === "#FFFFFF" ? "rgba(255,255,255,0.22)" : spec ? "rgba(43,37,34,0.12)" : colors.beige,
          }}
        >
          <Icon name="arrow" size={20} color={spec ? spec.on : colors.ink} />
        </View>
      ) : null}
    </>
  );

  const wrapped = spec ? (
    <TextToneProvider value={{ color: spec.on, muted }}>{body}</TextToneProvider>
  ) : (
    body
  );

  const rise = (node: React.ReactElement) =>
    enterIndex === undefined ? node : <Rise index={enterIndex}>{node}</Rise>;

  if (onPress) {
    return rise(
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={container}
      >
        {wrapped}
      </PressableScale>,
    );
  }

  return rise(
    <View style={container} {...rest}>
      {wrapped}
    </View>,
  );
}
