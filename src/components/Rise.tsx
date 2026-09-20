// src/components/Rise.tsx
//
// Wraps content so it fades up into place when its screen appears, one block
// after another (`index` staggers them). The "silky" entrance from the design's
// motion rules (design/DESIGN.md §6); runs on the UI thread, so it stays smooth,
// and does nothing under the phone's "reduce motion" setting.

import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";

import { design } from "@/theme/design";

type Props = { index?: number; style?: StyleProp<ViewStyle>; children: ReactNode };

export function Rise({ index = 0, style, children }: Props) {
  const { staggerMs, enterMs } = design.motion;
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * staggerMs)
        .duration(enterMs + 120)
        .springify()
        .damping(16)
        .reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
