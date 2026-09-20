// src/app/(tabs)/inspections.tsx  →  route "/inspections"
//
// The core screen of Phase 1: the full inspections list, filterable by
// project and status, backed by real SQLite data through the repository
// layer. This is what TC-19 through TC-22 exercise.

import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Swipeable } from "react-native-gesture-handler";
import { useFocusEffect, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import {
  Text,
  Card,
  Button,
  EmptyState,
  Badge,
  SyncStatusDot,
  UploadBanner,
} from "@/components";
import { PressableScale } from "@/components/PressableScale";
import { palette } from "@/theme/design";
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

  const { colors, radius, spacing, motion } = theme.design;

  return (
    // Full-bleed purple with a light rounded sheet holding a vertical timeline
    // (design/DESIGN.md §5, "list screens"). The header above is purple too (see
    // the tabs layout), and the filters are chips sitting on the purple.
    <View style={{ flex: 1, backgroundColor: colors.primary }}>
      <UploadBanner />
      <View
        style={{
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing.sm,
          paddingBottom: spacing.md,
          gap: spacing.sm,
        }}
      >
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

      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          overflow: "hidden",
        }}
      >
        {loading && inspectionList.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.primaryDeep} />
          </View>
        ) : error ? (
          <EmptyState title="Something went wrong" message={error}>
            <Button label="Try again" onPress={() => load()} />
          </EmptyState>
        ) : (
          <FlashList
            data={inspectionList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: spacing.gutter,
              paddingTop: spacing.lg,
              paddingBottom: spacing.md,
            }}
            renderItem={({ item, index }) => (
              // Rows rise in one after another. Swipeable reveals Delete by dragging the
              // row sideways (unchanged behaviour).
              <Animated.View
                entering={FadeInDown.delay(Math.min(index, 8) * motion.staggerMs)
                  .duration(motion.enterMs + 120)
                  .springify()
                  .damping(16)}
              >
                <Swipeable
                  renderRightActions={() => (
                    <Pressable
                      onPress={() => handleSwipeDelete(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${item.title}`}
                      style={{
                        backgroundColor: colors.danger,
                        justifyContent: "center",
                        alignItems: "center",
                        width: 88,
                        marginBottom: spacing.md,
                        borderRadius: radius.md,
                      }}
                    >
                      <Text style={{ color: colors.onPrimary }} variant="label">
                        Delete
                      </Text>
                    </Pressable>
                  )}
                >
                  <View style={{ flexDirection: "row", backgroundColor: colors.surface }}>
                    <TimelineRail
                      color={TIMELINE_COLOR[item.status]}
                      first={index === 0}
                      last={index === inspectionList.length - 1}
                    />
                    <View style={{ flex: 1, paddingBottom: spacing.md }}>
                      <Card
                        tone="neutral"
                        arrow
                        style={{ paddingRight: 76, padding: spacing.md }}
                        onPress={() => router.push(`/inspections/${item.id}`)}
                        accessibilityLabel={`${item.title}, ${projectNameById.get(item.projectId) ?? "unknown project"}`}
                      >
                        <Text variant="subtitle" numberOfLines={2}>
                          {item.title}
                        </Text>
                        <View style={{ marginTop: spacing.xs }}>
                          <Badge status={item.status} />
                        </View>
                        <Text muted variant="caption" style={{ marginTop: spacing.xs }}>
                          {projectNameById.get(item.projectId) ?? "Unknown project"}
                        </Text>
                        <Text muted variant="caption">
                          Updated {formatTimestamp(item.updatedAt)}
                        </Text>
                        <View style={{ marginTop: spacing.xs }}>
                          <SyncStatusDot status={item.syncStatus} />
                        </View>
                      </Card>
                    </View>
                  </View>
                </Swipeable>
              </Animated.View>
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

        <View style={{ padding: spacing.gutter, paddingTop: spacing.sm }}>
          <Button label="New Inspection" icon="plus" onPress={() => router.push("/inspections/new")} />
        </View>
      </View>
    </View>
  );
}

// The timeline's line and dot take the inspection's status colour, so a glance down
// the list shows where things stand.
const TIMELINE_COLOR: Record<InspectionStatus, string> = {
  draft: palette.purpleSoft,
  in_progress: palette.amber,
  completed: palette.olive,
  submitted: palette.purpleDeep,
};

function TimelineRail({ color, first, last }: { color: string; first: boolean; last: boolean }) {
  return (
    <View style={{ width: 30, alignItems: "center" }}>
      <View style={{ width: 4, height: 22, backgroundColor: first ? "transparent" : color, borderRadius: 2 }} />
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 4,
          borderColor: color,
          backgroundColor: palette.sheet,
        }}
      />
      <View style={{ width: 4, flex: 1, backgroundColor: last ? "transparent" : color, borderRadius: 2 }} />
    </View>
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
  const { colors, radius, spacing, fonts } = useTheme().design;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {options.map((opt) => {
          const active = opt.key === selected;
          return (
            <PressableScale
              key={opt.key}
              onPress={() => onSelect(opt.key)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: active }}
              style={{
                paddingHorizontal: spacing.md,
                height: 40,
                justifyContent: "center",
                borderRadius: radius.pill,
                backgroundColor: active ? colors.bg : "rgba(255,255,255,0.2)",
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.bodyBold,
                  fontSize: 14,
                  color: active ? colors.ink : colors.onPrimary,
                }}
              >
                {opt.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </ScrollView>
  );
}

