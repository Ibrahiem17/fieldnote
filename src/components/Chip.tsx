// src/components/Chip.tsx
//
// A pill-shaped choice ("Clear", "Rain", a project name…). Unselected it's a light
// pill with a soft shadow; selected it turns deep purple with white text, so the
// current choice is obvious without relying on colour alone (the text also stays
// readable: white on the deep purple is 5.95:1). Shrinks slightly when pressed.

import type { PressableProps } from "react-native";

import { neutralShadow } from "@/theme/design";
import { useTheme } from "@/theme/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

type Props = Pick<PressableProps, "onPress" | "hitSlop"> & {
  label: string;
  selected: boolean;
  accessibilityLabel?: string;
};

export function Chip({ label, selected, onPress, hitSlop, accessibilityLabel }: Props) {
  const { colors, radius, spacing, fonts } = useTheme().design;

  return (
    <PressableScale
      onPress={onPress}
      hitSlop={hitSlop ?? { top: 4, bottom: 4, left: 2, right: 2 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={[
        {
          minHeight: 44,
          paddingHorizontal: spacing.md,
          justifyContent: "center",
          borderRadius: radius.pill,
          backgroundColor: selected ? colors.primaryDeep : colors.surface,
        },
        selected ? null : neutralShadow,
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.bodyBold,
          fontSize: 15,
          color: selected ? colors.onPrimary : colors.ink,
        }}
      >
        {label}
      </Text>
    </PressableScale>
  );
}
