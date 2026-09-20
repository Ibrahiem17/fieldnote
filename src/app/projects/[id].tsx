// src/app/projects/[id].tsx  →  route "/projects/anything"
//
// The square brackets in the filename (Section 2.4) mean this screen
// handles any project ID. `useLocalSearchParams()` reads which one out of
// the URL.

import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import { Screen, Text, Card, Button, EmptyState, Badge, useToast } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { getProject } from "@/repositories/projects";
import { listInspections } from "@/repositories/inspections";
import { deleteProjectWithInspections } from "@/lib/deleteProject";
import { formatTimestamp } from "@/lib/time";
import type { Inspection, Project } from "@/db/schema";

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [inspectionList, setInspectionList] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  // Phase 4, Day 4: same gap as every other list screen — a load failure
  // used to just leave the screen looking permanently loading/empty.
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return Promise.all([getProject(id), listInspections({ projectId: id })])
      .then(([p, rows]) => {
        setProject(p);
        setInspectionList(rows);
      })
      .catch((e) => {
        console.error(e);
        setError("Couldn't load this project.");
      })
      .finally(() => setLoading(false));
  }, [id]);

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

  if (loading && !project) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <EmptyState title="Something went wrong" message={error}>
          <Button label="Try again" onPress={() => load()} />
        </EmptyState>
      </Screen>
    );
  }

  if (!loading && !project) {
    return (
      <Screen>
        <EmptyState title="Project not found" message="It may have been deleted." />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={{ padding: theme.design.spacing.gutter, gap: theme.spacing.sm }}>
        <Card tone="primary" enterIndex={0}>
          <Text variant="title">{project?.name ?? "…"}</Text>
          {project?.clientName ? <Text muted>{project.clientName}</Text> : null}
          {project?.address ? (
            <Text variant="caption" muted>
              {project.address}
            </Text>
          ) : null}
          {project?.notes ? <Text style={{ marginTop: theme.spacing.xs }}>{project.notes}</Text> : null}
        </Card>
        <Button
          label="New Inspection for this project"
          onPress={() => router.push({ pathname: "/inspections/new", params: { projectId: id } })}
        />
        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Edit project"
              variant="secondary"
              onPress={() => router.push({ pathname: "/projects/new", params: { id } })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Delete project"
              variant="secondary"
              onPress={() => {
                const count = inspectionList.length;
                Alert.alert(
                  `Delete "${project?.name ?? "this project"}"?`,
                  count > 0
                    ? `The ${count} ${count === 1 ? "inspection" : "inspections"} inside will be deleted too. This can't be undone.`
                    : "This can't be undone.",
                  [
                    { text: "Keep it", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await deleteProjectWithInspections(id);
                          toast.show("Project deleted", "info");
                          router.back();
                        } catch (e) {
                          console.error(e);
                          Alert.alert("Couldn't delete", "Something went wrong. Please try again.");
                        }
                      },
                    },
                  ],
                );
              }}
            />
          </View>
        </View>
        <Text variant="label" upper muted style={{ marginTop: theme.spacing.sm }}>
          Inspections ({inspectionList.length})
        </Text>
      </View>

      <FlashList
        data={inspectionList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: theme.design.spacing.gutter, paddingBottom: theme.spacing.md }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
        renderItem={({ item, index }) => (
          <Card
            enterIndex={index}
            arrow
            style={{ paddingRight: 76 }}
            onPress={() => router.push(`/inspections/${item.id}`)}
            accessibilityLabel={item.title}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <Text variant="subtitle" style={{ flex: 1 }} numberOfLines={2}>
                {item.title}
              </Text>
              <Badge status={item.status} />
            </View>
            <Text variant="caption" muted style={{ marginTop: theme.spacing.xs }}>
              Updated {formatTimestamp(item.updatedAt)}
            </Text>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No inspections for this project"
            message="Create the first one above."
          />
        }
      />
    </Screen>
  );
}
