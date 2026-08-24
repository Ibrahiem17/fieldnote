// src/app/(tabs)/settings.tsx  →  route "/settings"
//
// Dev tools live here for Phase 1: reseeding the database (Section 3.5.3,
// "you'll use it constantly") and a quick read of what's actually in the
// database right now, useful when eyeballing TC-11 and TC-17.

import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { Screen, Text, Card, Button } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { resetAndReseed } from "@/db/seed";
import { listProjects } from "@/repositories/projects";
import { listInspections } from "@/repositories/inspections";
import { countOutboxEntries } from "@/repositories/outbox";

export default function SettingsScreen() {
  const theme = useTheme();
  const [counts, setCounts] = useState({ projects: 0, inspections: 0, outbox: 0 });
  const [reseeding, setReseeding] = useState(false);

  const refreshCounts = useCallback(async () => {
    const [projects, inspections, outboxTotal] = await Promise.all([
      listProjects(),
      listInspections(),
      countOutboxEntries(),
    ]);
    setCounts({ projects: projects.length, inspections: inspections.length, outbox: outboxTotal });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshCounts().catch((e) => console.error(e));
    }, [refreshCounts]),
  );

  const handleReseed = () => {
    Alert.alert(
      "Reset & reseed database?",
      "This deletes every project, template and inspection and replaces them with fresh fixture data (8 projects, 3 templates, 500 inspections).",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset & Reseed",
          style: "destructive",
          onPress: async () => {
            setReseeding(true);
            try {
              const result = await resetAndReseed();
              await refreshCounts();
              Alert.alert(
                "Done",
                `Seeded ${result.projects} projects, ${result.templates} templates, ${result.inspections} inspections.`,
              );
            } catch (e) {
              console.error(e);
              Alert.alert("Reseed failed", String(e));
            } finally {
              setReseeding(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="title">Settings</Text>

        <Card>
          <Text variant="label" muted>
            Current database
          </Text>
          <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.xs }}>
            <Text>Projects: {counts.projects}</Text>
            <Text>Inspections: {counts.inspections}</Text>
            <Text>Outbox rows: {counts.outbox}</Text>
          </View>
        </Card>

        <Card>
          <Text variant="label" muted>
            Developer tools
          </Text>
          <Text
            variant="caption"
            muted
            style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.sm }}
          >
            Dev-only. Not part of the shipped app.
          </Text>
          <Button
            label="Reset & Reseed Database"
            variant="danger"
            loading={reseeding}
            onPress={handleReseed}
          />
        </Card>

        <Card>
          <Text variant="label" muted>
            About
          </Text>
          <Text style={{ marginTop: theme.spacing.sm }}>Fieldnote — Phase 1</Text>
          <Text variant="caption" muted>
            Offline-first field inspection app. Foundation, navigation & offline data layer.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
