// src/components/Button.tsx
//
// A full pill button (design/DESIGN.md §7): purple for the main action, beige for
// quiet ones, red for destructive. The label is fixed text, so it's set in
// uppercase condensed type. Pressing it shrinks it slightly (PressableScale).
// Small text on the primary button sits on `primaryDeep`, the purple deep enough
// for white text to pass contrast (5.9:1).

import { ActivityIndicator } from "react-native";

import { tintedShadow } from "@/theme/design";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon, type IconName } from "./Icon";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "danger";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** An optional icon shown before the label. */
  icon?: IconName;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
}: ButtonProps) {
  const theme = useTheme();
  const { colors, radius, spacing, size, textStyles } = theme.design;

  const fill: Record<Variant, string> = {
    primary: colors.primaryDeep,
    secondary: colors.beige,
    danger: colors.danger,
  };
  const textColor: Record<Variant, string> = {
    primary: colors.onPrimary,
    secondary: colors.ink,
    danger: colors.onPrimary,
  };

  const isDisabled = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      // `label` is already a required prop on every Button, so a screen reader
      // announcing it costs nothing extra.
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        {
          minHeight: size.buttonHeight,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.lg,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: spacing.sm,
          backgroundColor: fill[variant],
          opacity: isDisabled ? 0.55 : 1,
        },
        variant === "secondary" ? null : tintedShadow(fill[variant], "soft"),
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor[variant]} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={textColor[variant]} /> : null}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[textStyles.button, { color: textColor[variant] }]}
          >
            {label}
          </Text>
        </>
      )}
    </PressableScale>
  );
}
