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
import {
  retryDeadLetters,
  getOutboxSummary,
  type DrainResult,
  type OutboxSummary,
} from "@/lib/syncEngine";
import { runSync, type SyncResult } from "@/lib/sync";
import { listConflicts } from "@/repositories/conflicts";
import { resolveConflictChoice } from "@/lib/conflictResolutionActions";
import type { Conflict } from "@/db/schema";

export default function SettingsScreen() {
  const theme = useTheme();
  const { session, signOut } = useAuth();
  const [counts, setCounts] = useState({ projects: 0, inspections: 0, outbox: 0 });
  const [outboxSummary, setOutboxSummary] = useState<OutboxSummary>({
    pending: 0,
    deadLettered: 0,
  });
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [reseeding, setReseeding] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [lastRetry, setLastRetry] = useState<DrainResult | null>(null);

  const refreshCounts = useCallback(async () => {
    const [projects, inspections, outboxTotal, summary, conflictRows] = await Promise.all([
      listProjects(),
      listInspections(),
      countOutboxEntries(),
      getOutboxSummary(),
      listConflicts(),
    ]);
    setCounts({ projects: projects.length, inspections: inspections.length, outbox: outboxTotal });
    setOutboxSummary(summary);
    setConflicts(conflictRows);
  }, []);

  const handleResolveConflict = async (conflict: Conflict, choice: "local" | "server") => {
    setResolvingId(conflict.id);
    try {
      await resolveConflictChoice(conflict, choice);
      await refreshCounts();
    } catch (e) {
      console.error(e);
      Alert.alert("Couldn't resolve", String(e));
    } finally {
      setResolvingId(null);
    }
  };

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
            Also runs on its own when your connection returns or you reopen the app — this button is
            for right now, not the only way it happens.
          </Text>

          <View
            style={{ flexDirection: "row", gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}
          >
            <Text variant="caption">{outboxSummary.pending} pending</Text>
            <Text
              variant="caption"
              style={outboxSummary.deadLettered > 0 ? { color: theme.colors.danger } : undefined}
            >
              {outboxSummary.deadLettered} failed
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Sync Now"
                loading={syncing}
                onPress={async () => {
                  setSyncing(true);
                  try {
                    const result = await runSync();
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
            </View>
            {outboxSummary.deadLettered > 0 ? (
              <View style={{ flex: 1 }}>
                <Button
                  label="Retry Failed"
                  variant="secondary"
                  loading={retrying}
                  onPress={async () => {
                    setRetrying(true);
                    try {
                      const result = await retryDeadLetters();
                      setLastRetry(result);
                      await refreshCounts();
                    } catch (e) {
                      console.error(e);
                      Alert.alert("Retry failed", String(e));
                    } finally {
                      setRetrying(false);
                    }
                  }}
                />
              </View>
            ) : null}
          </View>

          {lastSync ? (
            <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.xs }}>
              <Text variant="caption">
                Pushed: {lastSync.push.synced} synced, {lastSync.push.failed} failed. Pulled:{" "}
                {lastSync.pull.merged} merged
                {lastSync.pull.autoResolved > 0
                  ? `, ${lastSync.pull.autoResolved} auto-resolved`
                  : ""}
                {lastSync.pull.flaggedForManualResolution > 0
                  ? `, ${lastSync.pull.flaggedForManualResolution} need your input below`
                  : ""}
                .
              </Text>
              {lastSync.push.errors.map((e, i) => (
                <Text key={i} variant="caption" style={{ color: theme.colors.danger }}>
                  {e.entityType} {e.entityId.slice(0, 8)}: {e.error}
                </Text>
              ))}
            </View>
          ) : null}

          {lastRetry ? (
            <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.xs }}>
              <Text variant="caption">
                Retry: {lastRetry.synced} synced, {lastRetry.failed} still failing.
              </Text>
              {lastRetry.errors.map((e, i) => (
                <Text key={i} variant="caption" style={{ color: theme.colors.danger }}>
                  {e.entityType} {e.entityId.slice(0, 8)}: {e.error}
                </Text>
              ))}
            </View>
          ) : null}
        </Card>

        {conflicts.length > 0 ? (
          <Card>
            <Text variant="label" muted>
              Needs your input ({conflicts.length})
            </Text>
            <Text
              variant="caption"
              muted
              style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.sm }}
            >
              You and someone else changed the same thing at almost the same time. Pick which one
              should stick — whichever you choose syncs onward like a normal edit.
            </Text>
            <View style={{ gap: theme.spacing.md }}>
              {conflicts.map((conflict) => {
                const localValue = JSON.parse(conflict.localValueJson);
                const serverValue = JSON.parse(conflict.serverValueJson);
                const busy = resolvingId === conflict.id;
                return (
                  <View
                    key={conflict.id}
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: theme.colors.border,
                      paddingTop: theme.spacing.sm,
                      gap: theme.spacing.xs,
                    }}
                  >
                    <Text variant="caption" muted>
                      {conflict.entityType} · {conflict.fieldKey}
                    </Text>
                    <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          label={`Yours: ${String(localValue)}`}
                          variant="secondary"
                          loading={busy}
                          onPress={() => handleResolveConflict(conflict, "local")}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          label={`Theirs: ${String(serverValue)}`}
                          variant="secondary"
                          loading={busy}
                          onPress={() => handleResolveConflict(conflict, "server")}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

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
