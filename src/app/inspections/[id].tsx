// src/app/inspections/[id].tsx  →  route "/inspections/anything"
//
// View, edit and (soft) delete a single inspection. Exercises TC-13
// (edit persists), TC-14/TC-15 (delete soft-deletes, row survives with
// deleted_at set) and TC-16 (survives a force-quit) together.

import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { Screen, Text, Input, Button, Badge, EmptyState } from "@/components";
import FormRenderer from "@/components/FormRenderer";
import { useTheme } from "@/theme/ThemeProvider";
import { getInspection, softDeleteInspection, updateInspection } from "@/repositories/inspections";
import { getTemplate } from "@/repositories/templates";
import { getAnswers } from "@/repositories/answers";
import { buildValidator } from "@/lib/validation";
import { getProject } from "@/repositories/projects";
import { formatTimestamp } from "@/lib/time";
import { buildReportData } from "@/lib/report";
import { buildReportHtml } from "@/lib/reportHtml";
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
  const [generatingReport, setGeneratingReport] = useState(false);
  // Phase 4, Day 4: same gap as every other data screen — a load failure
  // used to only console.error, leaving the screen looking stuck loading.
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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
    } catch (e) {
      console.error(e);
      setError("Couldn't load this inspection.");
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

  if (loading && !inspection) {
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

    // If marking complete, validate template-driven answers first
    if (status === "completed" && inspection.templateId) {
      try {
        const template = await getTemplate(inspection.templateId);
        if (template) {
          const parsed = JSON.parse(template.schemaJson);
          const answers = await getAnswers(inspection.id);
          const answersMap: Record<string, any> = {};
          for (const a of answers) {
            if (a.valueText !== null) answersMap[a.fieldKey] = a.valueText;
            else if (a.valueNumber !== null) answersMap[a.fieldKey] = a.valueNumber;
            else if (a.valueJson !== null) answersMap[a.fieldKey] = JSON.parse(a.valueJson);
          }
          const validate = buildValidator(parsed);
          const errors = validate(answersMap);
          if (Object.keys(errors).length > 0) {
            Alert.alert("Validation failed", Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join("\n"));
            return;
          }
        }
      } catch (e) {
        console.error("Validation error", e);
        Alert.alert("Validation error", "Could not validate the form. Please try again.");
        return;
      }
    }

    const updated = await updateInspection(inspection.id, { status });
    setInspection(updated);
  };

  // Phase 4: builds the report HTML (src/lib/report.ts + reportHtml.ts),
  // hands it to expo-print to render a real PDF file, then hands THAT file
  // to expo-sharing's native share sheet (Day 2 — Day 1 only opened the OS
  // print dialog, which proved the PDF was real but wasn't yet "share this
  // with someone"). Dynamic imports — same reasoning as every other
  // native-package call in this codebase (src/lib/media.ts,
  // attachmentUpload.ts): a module touching native code must not crash to
  // *load* in the web preview, where it simply won't function (D-010).
  const handleGenerateReport = async () => {
    if (!inspection) return;
    setGeneratingReport(true);
    try {
      const data = await buildReportData(inspection.id);
      const html = await buildReportHtml(data);
      const Print = await import("expo-print");
      const { uri } = await Print.printToFileAsync({ html });

      const Sharing = await import("expo-sharing");
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: inspection.title,
        });
      } else {
        // Sharing genuinely isn't available on this device/platform (not
        // expected on a real phone, but this codebase never assumes a
        // native capability exists without checking — same pattern as
        // src/lib/media.ts's `{ error: "no-native" }` fallbacks) — the PDF
        // still exists on disk, so say where rather than fail silently.
        Alert.alert("Report generated", `Saved to: ${uri}`);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Couldn't generate report", String(e));
    } finally {
      setGeneratingReport(false);
    }
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

        {/* Dynamic form renderer (Phase 2) */}
        {inspection?.templateId ? (
          <FormRenderer inspectionId={inspection.id} templateId={inspection.templateId} />
        ) : null}

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
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel={STATUS_LABEL[status]}
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
        <Button
          label="Generate Report"
          onPress={handleGenerateReport}
          loading={generatingReport}
        />
        <Button label="Delete Inspection" variant="danger" onPress={handleDelete} />
      </ScrollView>
    </Screen>
  );
}
