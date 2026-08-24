// src/app/(tabs)/_layout.tsx
//
// The tab bar. `(tabs)` in the folder name is a "route group" (Section
// 2.4) — parentheses mean Expo Router uses this folder for layout only and
// leaves it out of the URL, so `index.tsx` inside here is still just "/".

import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTitleStyle: { color: theme.colors.text },
        tabBarStyle: { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.border },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Projects",
          tabBarIcon: ({ color }) => <TabGlyph glyph="🏗" color={color} />,
        }}
      />
      <Tabs.Screen
        name="inspections"
        options={{
          title: "Inspections",
          tabBarIcon: ({ color }) => <TabGlyph glyph="📋" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <TabGlyph glyph="⚙️" color={color} />,
        }}
      />
    </Tabs>
  );
}

// A plain emoji glyph instead of an icon library — Phase 1 scope (1.3.1)
// doesn't call for one, and pulling in an icon set for three tabs would be
// a dependency earning its place later, not now.
function TabGlyph({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ fontSize: 18, color }}>{glyph}</Text>;
}
