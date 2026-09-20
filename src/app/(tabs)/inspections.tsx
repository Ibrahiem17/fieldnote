// src/app/(tabs)/inspections.tsx  →  route "/inspections"
//
// The core screen of Phase 1: the full inspections list, filterable by
// project and status, backed by real SQLite data through the repository
// layer. This is what TC-19 through TC-22 exercise.

import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useFocusEffect, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import { Screen, Text, Card, Button, EmptyState, Badge, SyncStatusDot } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { listInspections, softDeleteInspection } from "@/repositories/inspections";
import { listProjects } from "@/repositories/projects";
import { formatTimestamp } from "@/lib/time";
import {
  INSPECTION_STATUSES,
  type Inspection,
  type InspectionStatus,
  type Project,
} from "@/db/schema";

type StatusFilter = "all" | InspectionStatus;

export default function InspectionsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [inspectionList, setInspectionList] = useState<Inspection[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  // Phase 4, Day 4: this screen used to only ever console.error a load
  // failure, with nothing shown on screen — a real "every state,
  // everywhere" gap (plan 3.4.3). `error` holds a message to show, or
  // `null` when the last load succeeded.
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return Promise.all([
      listInspections({
        projectId: projectFilter === "all" ? undefined : projectFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
      listProjects(),
    ])
      .then(([rows, projects]) => {
        setInspectionList(rows);
        setProjectList(projects);
      })
      .catch((e) => {
        console.error(e);
        setError("Couldn't load inspections.");
      })
      .finally(() => setLoading(false));
  }, [projectFilter, statusFilter]);

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

  const handleSwipeDelete = useCallback(
    (inspection: Inspection) => {
      Alert.alert("Delete this inspection?", "This can't be undone from the app.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await softDeleteInspection(inspection.id);
            load().catch((e) => console.error(e));
          },
        },
      ]);
    },
    [load],
  );

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projectList) map.set(p.id, p.name);
    return map;
  }, [projectList]);

  return (
    <Screen padded={false}>
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
        <FilterRow
          options={[
            { key: "all", label: "All projects" },
            ...projectList.map((p) => ({ key: p.id, label: p.name })),
          ]}
          selected={projectFilter}
          onSelect={(key) => setProjectFilter(key)}
        />
        <FilterRow
          options={[
            { key: "all", label: "All statuses" },
            ...INSPECTION_STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s] })),
          ]}
          selected={statusFilter}
          onSelect={(key) => setStatusFilter(key as StatusFilter)}
        />
      </View>

      {loading && inspectionList.length === 0 ? (
        // Phase 4, Day 4: the loading state this screen never had — the
        // same centered-spinner pattern src/app/_layout.tsx's own
        // MigrationGate already uses, reused rather than inventing a new
        // loading treatment for this one screen.
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <EmptyState title="Something went wrong" message={error}>
          <Button label="Try again" onPress={() => load()} />
        </EmptyState>
      ) : (
        <FlashList
          data={inspectionList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: theme.spacing.md, paddingTop: 0 }}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
          renderItem={({ item }) => (
            // Phase 4, Day 4: Swipeable (react-native-gesture-handler)
            // reveals this action by dragging the row itself sideways —
            // `renderRightActions` is called continuously while dragging,
            // handed the row's own drag progress so the revealed button
            // can (if wanted) animate in step with the swipe; here it's a
            // fixed-width button, kept simple.
            <Swipeable
              renderRightActions={() => (
                <Pressable
                  onPress={() => handleSwipeDelete(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.title}`}
                  style={{
                    backgroundColor: theme.colors.danger,
                    justifyContent: "center",
                    alignItems: "center",
                    width: 88,
                    borderRadius: theme.radius.md,
                  }}
                >
                  <Text style={{ color: theme.colors.primaryText }} variant="label">
                    Delete
                  </Text>
                </Pressable>
              )}
            >
              <Card
                onPress={() => router.push(`/inspections/${item.id}`)}
                accessibilityLabel={`${item.title}, ${projectNameById.get(item.projectId) ?? "unknown project"}`}
              >
                <View style={styles.rowTop}>
                  <Text variant="subtitle" style={{ flex: 1 }} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Badge status={item.status} />
                </View>
                <Text muted variant="caption" style={{ marginTop: theme.spacing.xs }}>
                  {projectNameById.get(item.projectId) ?? "Unknown project"}
                </Text>
                <Text muted variant="caption">
                  Updated {formatTimestamp(item.updatedAt)}
                </Text>
                <View style={{ marginTop: theme.spacing.xs }}>
                  <SyncStatusDot status={item.syncStatus} />
                </View>
              </Card>
            </Swipeable>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No inspections"
              message={
                projectFilter !== "all" || statusFilter !== "all"
                  ? "Nothing matches these filters."
                  : "Tap New Inspection below to start your first one."
              }
            />
          }
        />
      )}

      <View style={{ padding: theme.spacing.md }}>
        <Button label="New Inspection" onPress={() => router.push("/inspections/new")} />
      </View>
    </Screen>
  );
}

const STATUS_LABEL: Record<InspectionStatus, string> = {
  draft: "Draft",
  in_progress: "In progress",
  completed: "Completed",
  submitted: "Submitted",
};

function FilterRow<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { key: T; label: string }[];
  selected: T;
  onSelect: (key: T) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>
        {options.map((opt) => {
          const active = opt.key === selected;
          return (
            <Pressable
              key={opt.key}
              onPress={() => onSelect(opt.key)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: active }}
              style={{
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: theme.spacing.xs,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: active ? theme.colors.primary : theme.colors.border,
                backgroundColor: active ? theme.colors.primary + "22" : theme.colors.surface,
              }}
            >
              <Text
                variant="caption"
                style={{ color: active ? theme.colors.primary : theme.colors.textMuted }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
});
