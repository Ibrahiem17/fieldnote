// src/app/(tabs)/index.tsx  →  route "/"
//
// The Projects tab. Projects can be created here ("New Project" opens
// /projects/new; before that screen existed they only came from the dev
// seed, which can't sync — docs/DESIGN.md D-039). Tapping a project opens
// its detail screen, which lists that project's inspections filtered.

import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Screen, Text, Card, EmptyState, Button, UploadBanner } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { listProjects } from "@/repositories/projects";
import type { Project } from "@/db/schema";

export default function ProjectsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  // Phase 4, Day 4: this screen had no user-visible error state before —
  // a load failure just left the list empty with no explanation.
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return listProjects()
      .then((rows) => setProjectList(rows))
      .catch((e) => {
        console.error(e);
        setError("Couldn't load projects.");
      })
      .finally(() => setLoading(false));
  }, []);

  // useFocusEffect (not a plain useEffect) re-runs every time this screen
  // becomes visible again — including "came back from a project's detail
  // screen" — so a change made elsewhere is never left stale on this list.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load().catch((e) => {
        if (!cancelled) console.error(e);
      });
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  return (
    <Screen padded={false}>
      <UploadBanner />
      {loading && projectList.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <EmptyState title="Something went wrong" message={error}>
          <Button label="Try again" onPress={() => load()} />
        </EmptyState>
      ) : (
        <FlashList
          data={projectList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: theme.design.spacing.gutter, paddingTop: theme.spacing.sm }}
          renderItem={({ item, index }) => (
            // Cards rise in one after another, and each overlaps the bottom of the one
            // above it (its rippled top edge sits on top), like the design's stacked cards.
            <Animated.View
              entering={FadeInDown.delay(Math.min(index, 8) * theme.design.motion.staggerMs)
                .duration(theme.design.motion.enterMs + 120)
                .springify()
                .damping(16)}
              style={{ marginTop: index === 0 ? 0 : -18 }}
            >
            <Card
              tone={theme.design.cardCycle[index % theme.design.cardCycle.length]}
              wavy
              waveFlip={index % 2 === 1}
              arrow
              style={{ paddingRight: 76, paddingBottom: theme.design.spacing.cardPad + 22 }}
              onPress={() => router.push(`/projects/${item.id}`)}
              accessibilityLabel={item.name}
            >
              <Text variant="subtitle">{item.name}</Text>
              {item.clientName ? (
                <Text muted style={{ marginTop: 2 }}>
                  {item.clientName}
                </Text>
              ) : null}
              {item.address ? (
                <Text variant="caption" muted style={{ marginTop: 2 }}>
                  {item.address}
                </Text>
              ) : null}
            </Card>
            </Animated.View>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No projects yet"
              message={"A project is a job or a site. Create one, then add inspections to it."}
            >
              <View style={{ gap: theme.spacing.xs, alignSelf: "stretch" }}>
                <Text variant="label" muted>
                  How Fieldnote works
                </Text>
                <Text muted>1. Tap New Project and name the job.</Text>
                <Text muted>2. Add an inspection and answer the questions — photos, location and signature included.</Text>
                <Text muted>3. Create a PDF report to send or save.</Text>
                <Text variant="caption" muted style={{ marginTop: theme.spacing.xs }}>
                  No signal? No problem — everything saves on this phone and uploads later.
                </Text>
              </View>
            </EmptyState>
          }
        />
      )}

      <View style={{ padding: theme.spacing.md }}>
        <Button label="New Project" icon="plus" onPress={() => router.push("/projects/new")} />
      </View>
    </Screen>
  );
}
