// src/app/inspections/new.tsx  →  route "/inspections/new"
//
// Create-inspection form. Deliberately minimal for Phase 1 — a title, which
// project it belongs to, and an optional template/inspector name. Dynamic,
// per-template fields are Phase 2's form engine (Section 1.3.2).

import { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen, Text, Chip, Rise, Input, Button } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { listProjects } from "@/repositories/projects";
import { listTemplates } from "@/repositories/templates";
import { createInspection } from "@/repositories/inspections";
import type { Project, Template } from "@/db/schema";

export default function NewInspectionScreen() {
  const { projectId: projectIdParam } = useLocalSearchParams<{ projectId?: string }>();
  const theme = useTheme();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string | undefined>(projectIdParam);
  const [templateId, setTemplateId] = useState<string | undefined>(undefined);
  const [inspectorName, setInspectorName] = useState("");
  const [titleError, setTitleError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([listProjects(), listTemplates()]).then(([p, t]) => {
      setProjects(p);
      setTemplates(t);
      // If we weren't handed a project (came from the Inspections tab, not
      // a project's own screen), default to the first one so the picker is
      // never left in an invalid "nothing selected" state.
      setProjectId((current) => current ?? p[0]?.id);
      // Likewise preselect the first template: an inspection with no template
      // opens as a blank form with no fields, which is almost never what
      // someone wants (docs/DESIGN.md D-040). They can still tap it to clear it.
      setTemplateId((current) => current ?? t[0]?.id);
    });
  }, []);

  const handleSave = async () => {
    // TC-23: an empty title is blocked with a clear message, not a silent
    // save and not a crash.
    if (title.trim().length === 0) {
      setTitleError("Title is required.");
      return;
    }
    if (!projectId) {
      Alert.alert("Choose a project", "Tap the project this inspection belongs to.");
      return;
    }

    setSaving(true);
    try {
      const inspection = await createInspection({
        title: title.trim(),
        projectId,
        templateId,
        inspectorName: inspectorName.trim() || undefined,
      });
      router.replace(`/inspections/${inspection.id}`);
    } catch (e) {
      console.error(e);
      Alert.alert("Couldn't save", String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <Rise index={0}>
        <Input
          label="Title"
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            if (titleError) setTitleError(undefined);
          }}
          error={titleError}
          placeholder="e.g. North wing roof check"
          autoFocus
        />
        </Rise>

        <Rise index={1} style={{ gap: theme.spacing.xs }}>
          <Text variant="label" upper muted>
            Project
          </Text>
          {projects.length === 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text muted>
                An inspection belongs to a project (a job or a site). You don&apos;t have one yet.
              </Text>
              <Button
                label="Create a project first"
                variant="secondary"
                onPress={() => router.replace("/projects/new")}
              />
            </View>
          ) : (
            <ChipPicker
              options={projects.map((p) => ({ key: p.id, label: p.name }))}
              selected={projectId}
              onSelect={setProjectId}
            />
          )}
        </Rise>

        <Rise index={2} style={{ gap: theme.spacing.xs }}>
          <Text variant="label" upper muted>
            Type of inspection
          </Text>
          <ChipPicker
            options={templates.map((t) => ({ key: t.id, label: t.name }))}
            selected={templateId}
            onSelect={(key) => setTemplateId(key === templateId ? undefined : key)}
          />
        </Rise>

        <Input
          label="Inspector name (optional)"
          value={inspectorName}
          onChangeText={setInspectorName}
          placeholder="e.g. J. Chen"
        />

        <Button label="Start inspection" onPress={handleSave} loading={saving} />
      </ScrollView>
    </Screen>
  );
}

function ChipPicker({
  options,
  selected,
  onSelect,
}: {
  options: { key: string; label: string }[];
  selected?: string;
  onSelect: (key: string) => void;
}) {
  const theme = useTheme();
  return (
    // Wraps onto new lines (rather than scrolling sideways) so every choice is
    // visible at once — a clipped chip looks like it isn't there.
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
      {options.map((opt) => (
        <Chip
          key={opt.key}
          label={opt.label}
          selected={opt.key === selected}
          onPress={() => onSelect(opt.key)}
        />
      ))}
    </View>
  );
}
