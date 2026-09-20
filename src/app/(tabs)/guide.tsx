// src/app/(tabs)/guide.tsx  →  route "/guide"
//
// The "How to use" tab: what Fieldnote is and how to use it, for someone who has
// never seen it. It opens by itself once on the first launch (see the tabs layout)
// and is always available from the bottom bar. All the words live in
// src/lib/guideContent.ts; this file only lays them out.

import { useCallback, useRef } from "react";
import { ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { Screen, Text, TwoToneText, Card, Badge, Button, Rise, Icon } from "@/components";
import { GUIDE } from "@/lib/guideContent";
import { useTheme } from "@/theme/ThemeProvider";
import type { CardColorKey } from "@/theme/design";

// The step cards take colour in turn, like the Projects list.
const STEP_TONES: CardColorKey[] = ["accent", "highlight", "primary", "accent"];

export default function GuideScreen() {
  const router = useRouter();
  const { colors, spacing, cardColors, fonts } = useTheme().design;

  // On the very first launch, when this tab opens by itself, it was seen to end up
  // scrolled to the bottom with nobody touching it. A guide must always start at its
  // top, so: start at the top every time the tab is shown, and if the content scrolls
  // while no finger is dragging it, snap it back. Once the person drags, it is theirs.
  const scrollRef = useRef<ScrollView>(null);
  const userDragged = useRef(false);
  useFocusEffect(
    useCallback(() => {
      userDragged.current = false;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  return (
    <Screen>
      <ScrollView
        ref={scrollRef}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          userDragged.current = true;
        }}
        onScroll={(e) => {
          if (!userDragged.current && e.nativeEvent.contentOffset.y > 0) {
            scrollRef.current?.scrollTo({ y: 0, animated: false });
          }
        }}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Card tone="primary" enterIndex={0}>
          <TwoToneText size={36}>{GUIDE.purpose.title}</TwoToneText>
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {GUIDE.purpose.paragraphs.map((p) => (
              <Text key={p}>{p}</Text>
            ))}
          </View>
        </Card>

        <Rise index={1}>
          <TwoToneText size={30}>{GUIDE.steps.title}</TwoToneText>
        </Rise>

        {GUIDE.steps.items.map((step, i) => {
          const tone = STEP_TONES[i % STEP_TONES.length];
          const on = cardColors[tone].on;
          const chip = on === colors.ink ? "rgba(43,37,34,0.12)" : "rgba(255,255,255,0.22)";
          return (
            <Card key={step.title} tone={tone} enterIndex={i + 2}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: chip,
                  }}
                >
                  <Icon name={step.icon} size={26} color={on} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text upper style={{ fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.2 }} muted>
                    Step {i + 1}
                  </Text>
                  <Text variant="subtitle">{step.title}</Text>
                </View>
              </View>
              <Text style={{ marginTop: spacing.sm }}>{step.body}</Text>
            </Card>
          );
        })}

        <Rise index={6}>
          <TwoToneText size={30}>{GUIDE.offline.title}</TwoToneText>
        </Rise>
        <Card enterIndex={7}>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Icon name="offline" size={26} color={colors.primaryDeep} />
            <View style={{ flex: 1, gap: spacing.md }}>
              {GUIDE.offline.items.map((item) => (
                <View key={item.title}>
                  <Text variant="label">{item.title}</Text>
                  <Text muted>{item.body}</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>

        <Rise index={8}>
          <TwoToneText size={30}>{GUIDE.labels.title}</TwoToneText>
        </Rise>
        <Card enterIndex={9}>
          <View style={{ gap: spacing.md }}>
            {GUIDE.labels.items.map((item) => (
              <View key={item.status} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={{ width: 118 }}>
                  <Badge status={item.status} />
                </View>
                <Text muted style={{ flex: 1 }}>
                  {item.body}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Rise index={10}>
          <TwoToneText size={30}>{GUIDE.trouble.title}</TwoToneText>
        </Rise>
        {GUIDE.trouble.items.map((item, i) => (
          <Card key={item.title} enterIndex={11 + i}>
            <Text variant="label">{item.title}</Text>
            <Text muted style={{ marginTop: spacing.xs }}>
              {item.body}
            </Text>
          </Card>
        ))}

        <Card tone="highlight" enterIndex={14}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Icon name="shield" size={26} color={cardColors.highlight.on} />
            <TwoToneText size={28}>{GUIDE.data.title}</TwoToneText>
          </View>
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {GUIDE.data.paragraphs.map((p) => (
              <Text key={p}>{p}</Text>
            ))}
          </View>
        </Card>

        <Rise index={15}>
          <Button label={GUIDE.start} icon="plus" onPress={() => router.navigate("/")} />
        </Rise>
      </ScrollView>
    </Screen>
  );
}
