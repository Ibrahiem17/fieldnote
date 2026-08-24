// src/app/inspections/new.tsx  →  route "/inspections/new"
//
// Create-inspection form. Deliberately minimal for Phase 1 — a title, which
// project it belongs to, and an optional template/inspector name. Dynamic,
// per-template fields are Phase 2's form engine (Section 1.3.2).

import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen, Text, Input, Button } from "@/components";
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
      Alert.alert("Pick a project", "Every inspection needs a project.");
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

        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" muted>
            Project
          </Text>
          <ChipPicker
            options={projects.map((p) => ({ key: p.id, label: p.name }))}
            selected={projectId}
            onSelect={setProjectId}
          />
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" muted>
            Template (optional)
          </Text>
          <ChipPicker
            options={templates.map((t) => ({ key: t.id, label: t.name }))}
            selected={templateId}
            onSelect={(key) => setTemplateId(key === templateId ? undefined : key)}
          />
        </View>

        <Input
          label="Inspector name (optional)"
          value={inspectorName}
          onChangeText={setInspectorName}
          placeholder="e.g. J. Chen"
        />

        <Button label="Create Inspection" onPress={handleSave} loading={saving} />
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
