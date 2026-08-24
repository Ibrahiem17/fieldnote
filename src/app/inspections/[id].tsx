// src/app/inspections/[id].tsx  →  route "/inspections/anything"
//
// View, edit and (soft) delete a single inspection. Exercises TC-13
// (edit persists), TC-14/TC-15 (delete soft-deletes, row survives with
// deleted_at set) and TC-16 (survives a force-quit) together.

import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { Screen, Text, Input, Button, Badge, EmptyState } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { getInspection, softDeleteInspection, updateInspection } from "@/repositories/inspections";
import { getProject } from "@/repositories/projects";
import { formatTimestamp } from "@/lib/time";
import {
  INSPECTION_STATUSES,
  type Inspection,
  type InspectionStatus,
  type Project,
} from "@/db/schema";

const STATUS_LABEL: Record<InspectionStatus, string> = {
  draft: "Draft",
  in_progress: "In progress",
  completed: "Completed",
  submitted: "Submitted",
};

export default function InspectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [titleError, setTitleError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await getInspection(id);
      setInspection(row);
      if (row) {
        setTitle(row.title);
        setNotes(row.notes ?? "");
        setDirty(false);
        const p = await getProject(row.projectId);
        setProject(p);
      }
    } finally {
      setLoading(false);
    }
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

  if (!loading && !inspection) {
    return (
      <Screen>
        <EmptyState title="Inspection not found" message="It may have been deleted." />
      </Screen>
    );
  }

  const handleSave = async () => {
    if (title.trim().length === 0) {
      setTitleError("Title is required.");
      return;
    }
    if (!inspection) return;
    setSaving(true);
    try {
      const updated = await updateInspection(inspection.id, {
        title: title.trim(),
        notes: notes.trim() || null,
      });
      setInspection(updated);
      setDirty(false);
    } catch (e) {
      console.error(e);
      Alert.alert("Couldn't save", String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status: InspectionStatus) => {
    if (!inspection) return;
    const updated = await updateInspection(inspection.id, { status });
    setInspection(updated);
  };

  const handleDelete = () => {
    if (!inspection) return;
    Alert.alert("Delete this inspection?", "This can't be undone from the app.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await softDeleteInspection(inspection.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
          {inspection ? <Badge status={inspection.status} /> : null}
          {project ? (
            <Text variant="caption" muted>
              {project.name}
            </Text>
          ) : null}
        </View>

        <Input
          label="Title"
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            setDirty(true);
            if (titleError) setTitleError(undefined);
          }}
          error={titleError}
        />

        <Input
          label="Notes"
          value={notes}
          onChangeText={(text) => {
            setNotes(text);
            setDirty(true);
          }}
          multiline
          numberOfLines={4}
          style={{ minHeight: 88, textAlignVertical: "top" }}
        />

        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" muted>
            Status
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
            {INSPECTION_STATUSES.map((status) => {
              const active = inspection?.status === status;
              return (
                <Pressable
                  key={status}
                  onPress={() => handleStatusChange(status)}
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
                    {STATUS_LABEL[status]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {inspection ? (
          <Text variant="caption" muted>
            Created {formatTimestamp(inspection.createdAt)} · Updated{" "}
            {formatTimestamp(inspection.updatedAt)}
          </Text>
        ) : null}

        <Button label="Save Changes" onPress={handleSave} loading={saving} disabled={!dirty} />
        <Button label="Delete Inspection" variant="danger" onPress={handleDelete} />
      </ScrollView>
    </Screen>
  );
}
