// src/components/PressableScale.tsx
//
// A pressable that shrinks a little while held, then springs back — the "smooth
// press state" from the design (design/DESIGN.md §6). Used by buttons, cards and
// the tab bar. The animation runs on the UI thread (Reanimated), so it stays
// smooth even if JavaScript is busy. Skipped entirely when the phone's
// "reduce motion" accessibility setting is on.

import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { design } from "@/theme/design";

type Props = Omit<PressableProps, "style" | "children"> & {
  /** Applied to the element that scales — put the background, radius and shadow here. */
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function PressableScale({ style, children, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        if (!reduceMotion) {
          scale.set(withTiming(design.motion.pressScale, { duration: design.motion.pressInMs }));
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduceMotion) scale.set(withSpring(1, design.motion.spring));
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
