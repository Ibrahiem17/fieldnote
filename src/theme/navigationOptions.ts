// src/theme/navigationOptions.ts
//
// How Expo Router's headers look (design/DESIGN.md §5): the cream background with
// no divider line, and a condensed uppercase title in ink. Shared by the tab
// screens and the stacked screens so every header matches.

import type { TextStyle } from "react-native";

import { HeaderTitle } from "@/components/HeaderTitle";
import { colors, fonts } from "./design";

const headerTitleStyle: TextStyle = {
  fontFamily: fonts.headingBold,
  fontSize: 24,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: colors.text,
};

export const headerOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerTitleStyle,
  // Stacked screens draw their title through this so it is uppercase on Android too.
  headerTitle: HeaderTitle,
} as const;

/** Background behind every screen, so a screen change never flashes another colour. */
export const sceneBackground = { backgroundColor: colors.bg } as const;
