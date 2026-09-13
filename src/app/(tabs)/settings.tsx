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
import { useAuth } from "@/auth/AuthProvider";
import { drainOutbox, type DrainResult } from "@/lib/syncEngine";

export default function SettingsScreen() {
  const theme = useTheme();
  const { session, signOut } = useAuth();
  const [counts, setCounts] = useState({ projects: 0, inspections: 0, outbox: 0 });
  const [reseeding, setReseeding] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<DrainResult | null>(null);

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
            Account
          </Text>
          <Text style={{ marginTop: theme.spacing.sm }}>{session?.user.email}</Text>
          <Text variant="caption" muted style={{ marginBottom: theme.spacing.sm }}>
            Signing out clears your session only — every inspection already on this phone stays
            right here (plan Section 3.1.3).
          </Text>
          <Button
            label="Sign Out"
            variant="secondary"
            loading={signingOut}
            onPress={async () => {
              setSigningOut(true);
              try {
                await signOut();
              } finally {
                setSigningOut(false);
              }
            }}
          />
        </Card>

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
            Sync
          </Text>
          <Text
            variant="caption"
            muted
            style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.sm }}
          >
            Manual for now — Day 2 scope. No automatic retry yet: a row that fails here stays in the
            outbox and is tried again the next time you tap this.
          </Text>
          <Button
            label="Sync Now"
            loading={syncing}
            onPress={async () => {
              setSyncing(true);
              try {
                const result = await drainOutbox();
                setLastSync(result);
                await refreshCounts();
              } catch (e) {
                console.error(e);
                Alert.alert("Sync failed", String(e));
              } finally {
                setSyncing(false);
              }
            }}
          />
          {lastSync ? (
            <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.xs }}>
              <Text variant="caption">
                Last run: {lastSync.synced} synced, {lastSync.failed} failed.
              </Text>
              {lastSync.errors.map((e, i) => (
                <Text key={i} variant="caption" style={{ color: theme.colors.danger }}>
                  {e.entityType} {e.entityId.slice(0, 8)}: {e.error}
                </Text>
              ))}
            </View>
          ) : null}
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
