// src/app/projects/[id].tsx  →  route "/projects/anything"
//
// The square brackets in the filename (Section 2.4) mean this screen
// handles any project ID. `useLocalSearchParams()` reads which one out of
// the URL.

import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import { Screen, Text, Card, Button, EmptyState, Badge } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { getProject } from "@/repositories/projects";
import { listInspections } from "@/repositories/inspections";
import { formatTimestamp } from "@/lib/time";
import type { Inspection, Project } from "@/db/schema";

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [inspectionList, setInspectionList] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      Promise.all([getProject(id), listInspections({ projectId: id })])
        .then(([p, rows]) => {
          if (cancelled) return;
          setProject(p);
          setInspectionList(rows);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  if (!loading && !project) {
    return (
      <Screen>
        <EmptyState title="Project not found" message="It may have been deleted." />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
        <Text variant="title">{project?.name ?? "…"}</Text>
        {project?.clientName ? <Text muted>{project.clientName}</Text> : null}
        {project?.address ? (
          <Text variant="caption" muted>
            {project.address}
          </Text>
        ) : null}
        {project?.notes ? <Text>{project.notes}</Text> : null}
        <Button
          label="New Inspection for this project"
          onPress={() => router.push({ pathname: "/inspections/new", params: { projectId: id } })}
        />
        <Text variant="label" muted style={{ marginTop: theme.spacing.sm }}>
          Inspections ({inspectionList.length})
        </Text>
      </View>

      <FlashList
        data={inspectionList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.md, paddingTop: 0 }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/inspections/${item.id}`)}>
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
          loading ? null : (
            <EmptyState
              title="No inspections for this project"
              message="Create the first one above."
            />
          )
        }
      />
    </Screen>
  );
}
