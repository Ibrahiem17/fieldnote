// src/components/FloatingTabBar.tsx
//
// The bottom navigation as a floating dark pill (design/DESIGN.md §5): a
// charcoal capsule with a soft shadow, and the active tab shown as a light
// rounded shape that also names the tab, so a first-time user always knows where
// they are. The icons are the app's own (each tab's `tabBarIcon`); this only
// changes how the bar looks. It sits in the normal layout flow (not overlaid), so
// screens end above it and nothing hides behind it.

import { View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";

import { tintedShadow } from "@/theme/design";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon, type IconName } from "./Icon";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

// Which icon each tab shows, by route name.
const tabIcons: Record<string, IconName> = {
  index: "projects",
  inspections: "inspections",
  settings: "settings",
};

// The active tab widens and the others slide over with a spring, rather than jumping.
const slide = LinearTransition.springify().damping(17).stiffness(190);

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, radius, size, spacing, fonts } = useTheme().design;
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: colors.bg,
        paddingTop: spacing.sm,
        paddingBottom: Math.max(insets.bottom, 12) + 8,
        alignItems: "center",
      }}
    >
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            height: size.navHeight,
            paddingHorizontal: 8,
            gap: 4,
            borderRadius: radius.pill,
            backgroundColor: colors.ink,
          },
          tintedShadow(colors.ink, "float"),
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = typeof options.title === "string" ? options.title : route.name;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          return (
            <Animated.View key={route.key} layout={slide}>
            <PressableScale
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              style={{
                height: size.navActive,
                minWidth: size.navActive,
                paddingHorizontal: focused ? 18 : 14,
                borderRadius: radius.pill,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                backgroundColor: focused ? colors.bg : "transparent",
              }}
            >
              <Icon name={tabIcons[route.name] ?? "projects"} size={22} color={focused ? colors.ink : colors.onDark} />
              {focused ? (
                <Animated.View entering={FadeIn.duration(220).delay(60)} exiting={FadeOut.duration(90)}>
                  <Text upper style={{ fontFamily: fonts.headingSemi, fontSize: 17, color: colors.ink }}>
                    {label}
                  </Text>
                </Animated.View>
              ) : null}
            </PressableScale>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
