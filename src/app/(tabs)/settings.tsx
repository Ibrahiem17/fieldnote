// src/app/(tabs)/settings.tsx  →  route "/settings"
//
// Account, uploading, and (in development builds only) developer tools. The
// wording is for a person using the app, not a developer: "waiting to upload",
// not "outbox rows".

import { useCallback, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { Screen, Text, Card, Button } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { resetAndReseed, removeSampleData } from "@/db/seed";
import { TEMPLATE_DEFS } from "@/db/templateDefs";
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

/** One friendly sentence for what "Upload now" just did. */
function describeSync(result: SyncResult): string {
  if (result.push.offline) {
    return "No connection right now. Your work is safe on this phone and will upload when you're back online.";
  }
  if (result.push.failed > 0) {
    return `${result.push.failed} couldn't upload yet. We'll keep trying — check your connection.`;
  }
  const sent = result.push.synced;
  const received = result.pull.merged;
  if (sent === 0 && received === 0) return "You're all caught up ✓";
  const parts: string[] = [];
  if (sent > 0) parts.push(`uploaded ${sent} ${sent === 1 ? "change" : "changes"}`);
  if (received > 0) parts.push(`received ${received} ${received === 1 ? "update" : "updates"} from your account`);
  const sentence = parts.join(" and ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + " ✓";
}

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
  const [removingSamples, setRemovingSamples] = useState(false);
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

  const handleRemoveSamples = () => {
    Alert.alert(
      "Remove sample data?",
      "Deletes the fake projects and inspections made by Reset & Reseed. Anything you created yourself is kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRemovingSamples(true);
            try {
              const result = await removeSampleData();
              await refreshCounts();
              Alert.alert(
                "Done",
                `Removed ${result.inspections} sample inspections and ${result.projects} sample projects.`,
              );
            } catch (e) {
              console.error(e);
              Alert.alert("Couldn't remove sample data", String(e));
            } finally {
              setRemovingSamples(false);
            }
          },
        },
      ],
    );
  };

  const handleReseed = () => {
    Alert.alert(
      "Reset & reseed database?",
      `This deletes every project, template and inspection and replaces them with fresh fixture data (8 projects, ${TEMPLATE_DEFS.length} templates, 500 inspections).`,
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
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
        <Card tone="primary" enterIndex={0}>
          <Text variant="label" muted>
            Account
          </Text>
          <Text style={{ marginTop: theme.spacing.sm }}>{session?.user.email}</Text>
          <Text variant="caption" muted style={{ marginBottom: theme.spacing.sm }}>
            Signing out clears your session only — every inspection already on this phone stays
            right here.
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

        <Card tone="accent" enterIndex={1}>
          <Text variant="label" muted>
            On this phone
          </Text>
          <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.xs }}>
            <Text>
              {counts.projects} {counts.projects === 1 ? "project" : "projects"}
            </Text>
            <Text>
              {counts.inspections} {counts.inspections === 1 ? "inspection" : "inspections"}
            </Text>
            {__DEV__ ? <Text variant="caption" muted>Outbox rows: {counts.outbox}</Text> : null}
          </View>
        </Card>

        <Card enterIndex={2}>
          <Text variant="label" muted>
            Uploading
          </Text>
          <Text
            variant="caption"
            muted
            style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.sm }}
          >
            Your work saves on this phone first, then uploads to your account by itself whenever you
            have a signal. Use the button to upload right now.
          </Text>

          <View
            style={{ flexDirection: "row", gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}
          >
            <Text variant="caption">
              {outboxSummary.pending === 0
                ? "Everything is uploaded ✓"
                : `${outboxSummary.pending} waiting to upload`}
            </Text>
            <Text
              variant="caption"
              style={outboxSummary.deadLettered > 0 ? { color: theme.colors.danger } : undefined}
            >
              {outboxSummary.deadLettered > 0
                ? `${outboxSummary.deadLettered} couldn't upload`
                : ""}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Upload now"
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
                  label="Try again"
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
              <Text variant="caption">{describeSync(lastSync)}</Text>
              {lastSync.pull.flaggedForManualResolution > 0 ? (
                <Text variant="caption">
                  {lastSync.pull.flaggedForManualResolution} need your decision below.
                </Text>
              ) : null}
              {__DEV__
                ? lastSync.push.errors.map((e, i) => (
                    <Text key={i} variant="caption" style={{ color: theme.colors.danger }}>
                      {e.entityType} {e.entityId.slice(0, 8)}: {e.error}
                    </Text>
                  ))
                : null}
            </View>
          ) : null}

          {lastRetry ? (
            <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.xs }}>
              <Text variant="caption">
                {lastRetry.offline
                  ? "No connection right now — we'll try again when you're back online."
                  : lastRetry.failed === 0
                    ? "All caught up ✓"
                    : `${lastRetry.failed} still couldn't upload. Check your connection and try again.`}
              </Text>
            </View>
          ) : null}
        </Card>

        {conflicts.length > 0 ? (
          <Card enterIndex={3}>
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

        {__DEV__ ? (
        <Card enterIndex={4}>
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
          <View style={{ marginTop: theme.spacing.sm }}>
            <Button
              label="Remove sample data (keeps your work)"
              variant="secondary"
              loading={removingSamples}
              onPress={handleRemoveSamples}
            />
          </View>
        </Card>
        ) : null}

        <Card enterIndex={5}>
          <Text variant="label" muted>
            About
          </Text>
          <Text style={{ marginTop: theme.spacing.sm }}>Fieldnote — v1.0.0</Text>
          <Text variant="caption" muted>
            Offline-first field inspection app.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
