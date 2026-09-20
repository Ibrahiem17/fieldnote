// src/app/inspections/[id].tsx  →  route "/inspections/anything"
//
// The screen a person spends most of their time on: fill in an inspection,
// finish it, and send a report. Everything saves by itself as you go (no Save
// button to forget), the screen says so, and "Mark as complete" tells you
// exactly what's still missing, by name, right under the field.

import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { Screen, Text, TwoToneText, Input, Button, Badge, EmptyState, useToast } from "@/components";
import FormRenderer from "@/components/FormRenderer";
import { useTheme } from "@/theme/ThemeProvider";
import { getInspection, softDeleteInspection, updateInspection } from "@/repositories/inspections";
import { getTemplate } from "@/repositories/templates";
import { getAnswers } from "@/repositories/answers";
import { buildValidator } from "@/lib/validation";
import { listProblems, summarizeProblems } from "@/lib/completion";
import { getProject } from "@/repositories/projects";
import { formatTimestamp } from "@/lib/time";
import { buildReportData } from "@/lib/report";
import { buildReportHtml } from "@/lib/reportHtml";
import type { Inspection, InspectionStatus, Project } from "@/db/schema";

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 700;

export default function InspectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [titleError, setTitleError] = useState<string | undefined>();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [completing, setCompleting] = useState(false);
  // Field key → message, filled by "Mark as complete" and shown under each field.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Phase 4, Day 4: a load failure used to only console.error, leaving the
  // screen looking stuck loading.
  const [error, setError] = useState<string | null>(null);

  // --- autosave for the title and general notes ---------------------------------
  // (The template's own answers are saved by FormRenderer the same way.)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title: "", notes: "" });

  const saveNow = useCallback(async () => {
    const { title: t, notes: n } = latest.current;
    if (!id) return;
    if (t.trim().length === 0) {
      setTitleError("Give this inspection a title.");
      setSaveState("idle");
      return;
    }
    try {
      const updated = await updateInspection(id, { title: t.trim(), notes: n.trim() || null });
      setInspection(updated);
      setSaveState("saved");
    } catch (e) {
      console.error(e);
      setSaveState("error");
    }
  }, [id]);

  const scheduleSave = (nextTitle: string, nextNotes: string) => {
    latest.current = { title: nextTitle, notes: nextNotes };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void saveNow();
    }, SAVE_DELAY_MS);
  };

  // Leaving the screen mid-typing must not lose the last edit.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void saveNow();
      }
    };
  }, [saveNow]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await getInspection(id);
      setInspection(row);
      if (row) {
        setTitle(row.title);
        setNotes(row.notes ?? "");
        latest.current = { title: row.title, notes: row.notes ?? "" };
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

  const setStatus = async (status: InspectionStatus, message: string) => {
    if (!inspection) return;
    try {
      const updated = await updateInspection(inspection.id, { status });
      setInspection(updated);
      toast.show(message);
    } catch (e) {
      console.error(e);
      Alert.alert("Couldn't update", "Something went wrong saving that. Please try again.");
    }
  };

  /** Checks the form against its template, by name, then marks it complete. */
  const handleComplete = async () => {
    if (!inspection) return;
    setCompleting(true);
    try {
      // Make sure the title/notes typed a moment ago are saved first.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        await saveNow();
      }

      if (inspection.templateId) {
        const template = await getTemplate(inspection.templateId);
        if (template) {
          const schema = JSON.parse(template.schemaJson);
          const answers = await getAnswers(inspection.id);
          const answersMap: Record<string, unknown> = {};
          for (const a of answers) {
            if (a.valueText !== null) answersMap[a.fieldKey] = a.valueText;
            else if (a.valueNumber !== null) answersMap[a.fieldKey] = a.valueNumber;
            else if (a.valueJson !== null) answersMap[a.fieldKey] = JSON.parse(a.valueJson);
          }
          const errors = buildValidator(schema)(answersMap);
          setFieldErrors(errors);
          const problems = listProblems(schema, errors);
          if (problems.length > 0) {
            Alert.alert(
              "Almost there",
              `Please fix ${problems.length === 1 ? "this" : "these"} before finishing:\n\n${summarizeProblems(problems)}`,
            );
            return;
          }
        }
      }
      setFieldErrors({});
      await setStatus("completed", "Marked as complete ✓");
    } catch (e) {
      console.error("Completion check failed", e);
      Alert.alert("Couldn't check the form", "Something went wrong. Please try again.");
    } finally {
      setCompleting(false);
    }
  };

  // Builds the report HTML (src/lib/report.ts + reportHtml.ts), has expo-print
  // render a real PDF, then hands that file to the native share sheet. Dynamic
  // imports — a module touching native code must not crash to *load* in the web
  // preview (D-010).
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
        // Sharing isn't available on this device — the PDF still exists, so
        // say where rather than fail silently.
        Alert.alert("Report created", `Saved to: ${uri}`);
      }
    } catch (e) {
      console.error(e);
      Alert.alert(
        "Couldn't create the report",
        "Something went wrong making the PDF. Please try again.",
      );
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleDelete = () => {
    if (!inspection) return;
    Alert.alert("Delete this inspection?", "It will be removed from this phone and your account.", [
      { text: "Keep it", style: "cancel" },
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

  const status = inspection?.status;
  const saveLine =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "All changes saved ✓"
        : saveState === "error"
          ? "Couldn't save — check your entries and try again"
          : "Your changes save automatically";

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
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
            if (titleError) setTitleError(undefined);
            scheduleSave(text, notes);
          }}
          error={titleError}
        />

        <Input
          label="General notes (optional)"
          value={notes}
          onChangeText={(text) => {
            setNotes(text);
            scheduleSave(title, text);
          }}
          multiline
          numberOfLines={4}
          style={{ minHeight: 88, textAlignVertical: "top" }}
        />

        <Text variant="caption" muted accessibilityLiveRegion="polite">
          {saveLine}
        </Text>

        {/* Dynamic form renderer: the questions come from the template */}
        {inspection?.templateId ? (
          <FormRenderer
            inspectionId={inspection.id}
            templateId={inspection.templateId}
            errors={fieldErrors}
          />
        ) : (
          <Text muted>
            This inspection has no checklist. Use the notes above, or create a new inspection and
            pick a template.
          </Text>
        )}

        {/* Finishing: one obvious next step instead of four status chips */}
        <View
          style={{
            gap: theme.spacing.sm,
            paddingTop: theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          <TwoToneText size={28}>Finish up</TwoToneText>

          {status === "completed" ? (
            <>
              <Text muted>This inspection is marked complete.</Text>
              <Button
                label="Mark as submitted"
                onPress={() => setStatus("submitted", "Marked as submitted ✓")}
              />
              <Button
                label="Reopen to make changes"
                variant="secondary"
                onPress={() => setStatus("in_progress", "Reopened")}
              />
            </>
          ) : status === "submitted" ? (
            <>
              <Text muted>This inspection has been submitted.</Text>
              <Button
                label="Reopen to make changes"
                variant="secondary"
                onPress={() => setStatus("in_progress", "Reopened")}
              />
            </>
          ) : (
            <>
              <Text muted>
                When every answer is in, mark it complete. We&apos;ll point out anything that&apos;s
                missing.
              </Text>
              <Button label="Mark as complete" onPress={handleComplete} loading={completing} />
            </>
          )}

          <Text muted style={{ marginTop: theme.spacing.sm }}>
            Make a PDF of this inspection to send or save.
          </Text>
          <Button
            label="Create PDF report"
            variant="secondary"
            onPress={handleGenerateReport}
            loading={generatingReport}
          />
        </View>

        {inspection ? (
          <Text variant="caption" muted>
            Started {formatTimestamp(inspection.createdAt)} · Last changed{" "}
            {formatTimestamp(inspection.updatedAt)}
          </Text>
        ) : null}

        <Button label="Delete inspection" variant="danger" onPress={handleDelete} />
      </ScrollView>
    </Screen>
  );
}
