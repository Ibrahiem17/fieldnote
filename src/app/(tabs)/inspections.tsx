// src/app/(tabs)/inspections.tsx  →  route "/inspections"
//
// The core screen of Phase 1: the full inspections list, filterable by
// project and status, backed by real SQLite data through the repository
// layer. This is what TC-19 through TC-22 exercise.

import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import { Screen, Text, Card, Button, EmptyState, Badge } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { listInspections } from "@/repositories/inspections";
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

  const load = useCallback(() => {
    setLoading(true);
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

      <FlashList
        data={inspectionList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.md, paddingTop: 0 }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/inspections/${item.id}`)}>
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
          </Card>
        )}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              title="No inspections"
              message={
                projectFilter !== "all" || statusFilter !== "all"
                  ? "Nothing matches these filters."
                  : "Create your first inspection, or seed the database from Settings."
              }
            />
          )
        }
      />

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
