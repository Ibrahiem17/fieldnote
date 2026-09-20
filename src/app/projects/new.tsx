// src/app/projects/new.tsx  →  route "/projects/new" (and "/projects/new?id=…" to edit)
//
// One form for both creating and editing a project: a name (required), and an
// optional client and address. Until this screen existed the app had no way to
// make a project at all (docs/DESIGN.md D-039), and once one existed a typo in
// its name was permanent — so the same screen now edits (D-044).
// createProject / updateProject each write the change AND its outbox entry in
// one transaction, like every other write in the app.

import { useEffect, useState } from "react";
import { Alert, Keyboard, ScrollView } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { Screen, Input, Button, useToast } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { createProject, getProject, updateProject } from "@/repositories/projects";

export default function ProjectFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id);
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  // Editing: fill the form with what's saved.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getProject(id)
      .then((p) => {
        if (cancelled || !p) return;
        setName(p.name);
        setClientName(p.clientName ?? "");
        setAddress(p.address ?? "");
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = async () => {
    // Same rule as an inspection's title: a clear message, not a silent save.
    if (name.trim().length === 0) {
      setNameError("Give the project a name.");
      return;
    }

    Keyboard.dismiss();
    setSaving(true);
    try {
      const values = {
        name: name.trim(),
        clientName: clientName.trim() || null,
        address: address.trim() || null,
      };
      if (id) {
        await updateProject(id, values);
        toast.show("Project updated");
        router.back();
      } else {
        const project = await createProject(values);
        router.replace(`/projects/${project.id}`);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Couldn't save", "Something went wrong saving the project. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? "Edit project" : "New Project" }} />
      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <Input
          label="Name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (nameError) setNameError(undefined);
          }}
          error={nameError}
          placeholder="e.g. Harborview Retail Fitout"
          autoFocus={!editing}
        />
        <Input
          label="Client (optional)"
          value={clientName}
          onChangeText={setClientName}
          placeholder="e.g. Alden Logistics"
        />
        <Input
          label="Address (optional)"
          value={address}
          onChangeText={setAddress}
          placeholder="e.g. 12 Industrial Way"
        />

        <Button
          label={editing ? "Save changes" : "Create Project"}
          onPress={handleSave}
          loading={saving}
        />
      </ScrollView>
    </Screen>
  );
}
