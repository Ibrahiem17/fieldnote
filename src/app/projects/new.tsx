// src/app/projects/new.tsx  →  route "/projects/new"
//
// Create-project form: a name (required), and an optional client and address.
// Until this screen existed the app had no way to make a project at all —
// projects only came from the dev seed, which writes no outbox entries, so
// nothing inside one could ever sync (docs/DESIGN.md D-039). createProject
// writes the project AND its outbox entry in one transaction, like every
// other create in the app.

import { useState } from "react";
import { Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";

import { Screen, Input, Button } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { createProject } from "@/repositories/projects";

export default function NewProjectScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    // Same rule as an inspection's title: blocked with a clear message, not a
    // silent save and not a crash.
    if (name.trim().length === 0) {
      setNameError("Name is required.");
      return;
    }

    setSaving(true);
    try {
      const project = await createProject({
        name: name.trim(),
        clientName: clientName.trim() || null,
        address: address.trim() || null,
      });
      router.replace(`/projects/${project.id}`);
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
          label="Name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (nameError) setNameError(undefined);
          }}
          error={nameError}
          placeholder="e.g. Harborview Retail Fitout"
          autoFocus
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

        <Button label="Create Project" onPress={handleSave} loading={saving} />
      </ScrollView>
    </Screen>
  );
}
