// src/app/(tabs)/_layout.tsx
//
// The tab bar. `(tabs)` in the folder name is a "route group" (Section
// 2.4) — parentheses mean Expo Router uses this folder for layout only and
// leaves it out of the URL, so `index.tsx` inside here is still just "/".

import { Tabs } from "expo-router";

import { FloatingTabBar } from "@/components/FloatingTabBar";
import { headerOptions, sceneBackground } from "@/theme/navigationOptions";
import { palette } from "@/theme/design";

// Tab headers already uppercase their titles (and the Inspections one is white on
// purple), so they skip the custom stacked-screen title component.
const { headerTitle: _stackTitle, ...tabHeaderOptions } = headerOptions;

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ ...tabHeaderOptions, sceneStyle: sceneBackground }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Projects",
        }}
      />
      <Tabs.Screen
        name="inspections"
        options={{
          title: "Inspections",
          // This tab is the full-bleed purple list screen, so its header joins in.
          headerStyle: { backgroundColor: palette.purple },
          headerTintColor: palette.white,
          headerTitleStyle: { ...tabHeaderOptions.headerTitleStyle, color: palette.white },
          sceneStyle: { backgroundColor: palette.purple },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
        }}
      />
    </Tabs>
  );
}
