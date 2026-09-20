// src/app/(tabs)/_layout.tsx
//
// The tab bar. `(tabs)` in the folder name is a "route group" (Section
// 2.4) — parentheses mean Expo Router uses this folder for layout only and
// leaves it out of the URL, so `index.tsx` inside here is still just "/".

import { useEffect } from "react";
import { Tabs, usePathname, useRouter } from "expo-router";

import { FloatingTabBar } from "@/components/FloatingTabBar";
import { headerOptions, sceneBackground } from "@/theme/navigationOptions";
import { palette } from "@/theme/design";
import { hasSeenGuide, markGuideSeen } from "@/lib/guideSeen";

// Tab headers already uppercase their titles (and the Inspections one is white on
// purple), so they skip the custom stacked-screen title component.
const { headerTitle: _stackTitle, ...tabHeaderOptions } = headerOptions;

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();

  // First launch: open the "How to use" guide once. Only when the app opened on the
  // normal home screen — a deep link (fieldnote://inspections/…) must land where it
  // points, so it neither opens the guide nor uses up the one-time flag.
  useEffect(() => {
    if (pathname !== "/") return;
    let cancelled = false;
    (async () => {
      if (await hasSeenGuide()) return;
      if (cancelled) return;
      await markGuideSeen();
      router.navigate("/guide");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on first mount
  }, []);

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
        name="guide"
        options={{
          title: "How to use",
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
