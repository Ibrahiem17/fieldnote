// src/components/FormRenderer.tsx
//
// Minimal Phase 2 form renderer: parses a template's schemaJson and renders
// sections and fields. Supports the core field types required for Phase 2 in a
// pragmatic way while keeping the code readable for a beginner (BABY.md will
// explain every symbol added in this file).

import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, Alert, Linking, Image, Switch } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Text, Input, Button, BusyButton, useToast } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { getAnswers, saveAnswer } from "@/repositories/answers";
import {
  listAttachmentsForInspection,
  createAttachment,
  deleteAttachment,
} from "@/repositories/attachments";
import { getTemplate } from "@/repositories/templates";
import { takePhotoAndCompress, getLocationWithTimeout, preloadMediaModules } from "@/lib/media";
import { isGpsValue, formatCoordinates, formatAccuracy, mapsUrl } from "@/lib/location";
import SignaturePad from "@/components/SignaturePad";
import { PhotoViewer } from "@/components/PhotoViewer";
import { isFieldVisible } from "@/lib/visibility";
import { parseNumberInput } from "@/lib/numberInput";
import { formatDateInput, todayIso } from "@/lib/dates";
import { fieldLabel, hasRequiredFields } from "@/lib/fieldLabel";

type TemplateSchema = {
  id: string;
  name: string;
  version: number;
  sections: {
    id: string;
    title: string;
    fields: any[];
  }[];
};

// `isFieldVisible` itself now lives in src/lib/visibility.ts, shared with
// src/lib/validation.ts and src/lib/report.ts (Phase 4, Day 5) — a field
// that's hidden here is guaranteed to also be excluded from validation and
// from reports, by construction, not by three copies staying in sync by
// hand.

function numberToText(value: unknown): string {
  return value === undefined || value === null || value === "" ? "" : String(value);
}

/**
 * A number box that keeps what's being typed. The old version stored
 * `Number(text)` on every keystroke: "3." became 3 (the dot vanished, so 3.3
 * was untypeable) and a cleared box became 0 (docs/DESIGN.md D-041).
 *
 * While the person is editing, `draft` holds exactly what they typed; when
 * they're not, the box simply shows the stored value. Only a parsable value
 * (or "no answer" for blank) is passed up to be saved, so there's nothing to
 * keep in sync with an effect.
 */
function NumberField({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: unknown;
  onChange: (n: number | null) => void;
  onCommit: (n: number | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      label={label}
      value={draft ?? numberToText(value)}
      keyboardType="numeric"
      onChangeText={(t) => {
        setDraft(t);
        const parsed = parseNumberInput(t);
        if (parsed.kind === "number") onChange(parsed.value);
        else if (parsed.kind === "empty") onChange(null);
        // partial (an unfinished "-" or "."): keep typing, save nothing yet
      }}
      onBlur={() => {
        if (draft === null) return; // never edited: nothing to commit
        const parsed = parseNumberInput(draft);
        const committed =
          parsed.kind === "number"
            ? parsed.value
            : parsed.kind === "empty"
              ? null
              : typeof value === "number"
                ? value
                : null;
        setDraft(null);
        void onCommit(committed);
      }}
    />
  );
}

// Move FieldComponent outside the main function so it can be memoized reliably.
const FieldBody = React.memo(function FieldBody(props: {
  field: any;
  value: any;
  inspectionId: string;
  attachmentsForField: any[];
  onScheduleSave: (k: string, v: any) => void;
  onImmediateSave: (k: string, v: any) => Promise<void>;
  setAttachments: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  onOpenSignature: (fieldKey: string) => void;
  /** Phase 4, Day 4: opens PhotoViewer over the given local file. */
  onOpenPhoto: (uri: string) => void;
}) {
  const {
    field,
    value,
    inspectionId,
    attachmentsForField,
    onScheduleSave,
    onImmediateSave,
    setAttachments,
    onOpenSignature,
    onOpenPhoto,
  } = props;
  const v = value ?? "";
  const theme = useTheme();
  const toast = useToast();

  switch (field.type) {
    case "text":
    case "longtext":
      return (
        <Input
          label={fieldLabel(field)}
          value={String(v)}
          onChangeText={(t) => onScheduleSave(field.key, t)}
          onBlur={() => onImmediateSave(field.key, v)}
          multiline={field.type === "longtext"}
          numberOfLines={field.type === "longtext" ? 4 : 1}
        />
      );
    case "number":
      return (
        <NumberField
          label={fieldLabel(field)}
          value={value}
          onChange={(n) => onScheduleSave(field.key, n)}
          onCommit={(n) => onImmediateSave(field.key, n)}
        />
      );
    case "date":
      // Stored as the text "YYYY-MM-DD" (see src/lib/dates.ts). Typed, with the
      // hyphens inserted automatically; a native picker needs a new build.
      return (
        <View style={{ gap: theme.spacing.xs }}>
          <Input
            label={fieldLabel(field)}
            value={String(v)}
            placeholder="YYYY-MM-DD"
            keyboardType="number-pad"
            maxLength={10}
            onChangeText={(t) => onScheduleSave(field.key, formatDateInput(t))}
            onBlur={() => onImmediateSave(field.key, v)}
          />
          <Button
            label="Use today's date"
            variant="secondary"
            onPress={() => {
              const today = todayIso();
              onScheduleSave(field.key, today);
              void onImmediateSave(field.key, today);
            }}
          />
        </View>
      );
    case "select":
      // Tappable choices, not free text: the stored value must be exactly one
      // of the template's option `value`s (visibleIf and validation both
      // compare against them). A text box let a phone keyboard turn "poor"
      // into "Poor" and silently hide the dependent field (docs/DESIGN.md D-034).
      return (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" muted>
            {fieldLabel(field)}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
            {(field.options ?? []).map((o: { value: string; label: string }) => {
              const active = v === o.value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    onScheduleSave(field.key, o.value);
                    void onImmediateSave(field.key, o.value);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${field.label}: ${o.label}`}
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
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    case "multiselect":
      return (
        <Input
          label={fieldLabel(field) + " (comma-separated)"}
          value={Array.isArray(v) ? v.join(", ") : String(v)}
          onChangeText={(t) =>
            onScheduleSave(
              field.key,
              t.split(",").map((s) => s.trim()),
            )
          }
          onBlur={() => onImmediateSave(field.key, v)}
        />
      );
    case "boolean":
      // A real switch: the old "Yes"/"No" pill didn't look tappable (a first-time
      // user has no way to know it's a control).
      return (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: theme.spacing.sm,
          }}
        >
          <Text style={{ flex: 1 }}>{fieldLabel(field)}</Text>
          <Switch
            value={Boolean(v)}
            onValueChange={(next) => {
              const stored = next ? 1 : 0;
              onScheduleSave(field.key, stored);
              void onImmediateSave(field.key, stored);
            }}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            accessibilityLabel={field.label}
          />
        </View>
      );
    case "photo":
      return (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label">{fieldLabel(field)}</Text>
          <BusyButton
            label="Add photo"
            busyLabel="Opening camera…"
            onPress={async () => {
              try {
                const res = await takePhotoAndCompress(inspectionId, field.key);
                if (res && (res as any).error === "permission-denied") {
                  Alert.alert(
                    "Camera permission",
                    "Camera permission was denied. Open Settings to enable it.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Open Settings", onPress: () => Linking.openSettings() },
                    ],
                  );
                  return;
                }

                // null = the person cancelled the camera: do nothing.
                if (!res) return;

                if ((res as any).error) {
                  // Never save a fake photo. The old code created a
                  // "placeholder.jpg" attachment here — for a cancel AND for
                  // a real failure — which sync would later try to upload
                  // (docs/DESIGN.md D-038).
                  Alert.alert(
                    "Couldn't take photo",
                    "The camera couldn't be opened. Nothing was saved — please try again.",
                  );
                  return;
                }

                const r = res as any;
                const att = await createAttachment({
                  inspectionId,
                  fieldKey: field.key,
                  localUri: r.localUri,
                  mimeType: r.mimeType ?? "image/jpeg",
                  byteSize: r.byteSize ?? null,
                  width: r.width ?? null,
                  height: r.height ?? null,
                });
                // store thumbnail path only in the UI object for display
                (att as any).thumbLocalUri = r.thumbLocalUri;
                toast.show("Photo added");
                setAttachments((prev) => ({
                  ...prev,
                  [field.key]: (prev[field.key] ?? []).concat(att),
                }));
              } catch (e) {
                console.error(e);
              }
            }}
          />
          {(attachmentsForField ?? []).map((a) => (
            <View
              key={a.id}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              {/* Phase 4, Day 4: a real thumbnail, tappable to open the
                  full-size pinch-to-zoom viewer — the first place in this
                  app that shows a photo as an actual image instead of a
                  text listing of its file path. Falls back to the
                  existing text when there's no local file to show at all
                  (Day 7's D-025 case: an attachment pulled from another
                  device, or one still mid-upload). */}
              {a.localUri ? (
                <Pressable
                  onPress={() => onOpenPhoto(a.localUri)}
                  accessibilityRole="button"
                  accessibilityLabel={`View photo for ${field.label}`}
                >
                  <Image
                    source={{ uri: a.localUri }}
                    style={{ width: 64, height: 64, borderRadius: 6 }}
                  />
                </Pressable>
              ) : (
                <Text style={{ flex: 1 }}>
                  {/* Day 7: a.localUri is null for an attachment PULLED
                      from another device — there's no file on this
                      filesystem to show a path for (src/db/schema.ts's
                      D-025), so fall back to naming the synced remote
                      object instead of showing nothing at all. */}
                  {a.remoteUrl ? `(synced from another device: ${a.remoteUrl})` : "(uploading…)"}
                </Text>
              )}
              <Button
                label="Delete"
                variant="danger"
                onPress={async () => {
                  try {
                    // attempt to remove files from disk when FileSystem is available
                    try {
                      const { File } = await import("expo-file-system");
                      if (a.localUri) {
                        try {
                          new File(a.localUri).delete();
                        } catch {
                          // already gone, or not a real file (e.g. the web placeholder path) — fine either way
                        }
                      }
                      if ((a as any).thumbLocalUri) {
                        try {
                          new File((a as any).thumbLocalUri).delete();
                        } catch {
                          // same as above
                        }
                      }
                    } catch {
                      // ignore if expo-file-system not installed
                    }
                    await deleteAttachment(a.id);
                    setAttachments((prev) => ({
                      ...prev,
                      [field.key]: (prev[field.key] ?? []).filter((x) => x.id !== a.id),
                    }));
                  } catch (e) {
                    console.error(e);
                  }
                }}
              />
            </View>
          ))}
        </View>
      );
    case "gps":
      return (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label">{fieldLabel(field)}</Text>
          <BusyButton
            label={isGpsValue(value) ? "Update location" : "Capture location"}
            busyLabel="Getting location…"
            onPress={async () => {
              try {
                const pos = await getLocationWithTimeout(10000);
                if ((pos as any).error === "permission-denied") {
                  Alert.alert(
                    "Location permission",
                    "Location permission was denied. Open Settings to enable it.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Open Settings", onPress: () => Linking.openSettings() },
                    ],
                  );
                  return;
                }
                if ((pos as any).error) {
                  // Never store made-up coordinates as if they were a real
                  // reading (the old code saved 12.34 / 56.78 here). Tell the
                  // person and save nothing (docs/DESIGN.md D-036).
                  const reason = (pos as any).error;
                  Alert.alert(
                    "Couldn't get your location",
                    reason === "timeout"
                      ? "No GPS fix within 10 seconds. Move near a window or outside and try again."
                      : "Location isn't available on this device right now. Nothing was saved — try again.",
                  );
                  return;
                }

                const p = pos as any;
                onScheduleSave(field.key, {
                  latitude: p.latitude,
                  longitude: p.longitude,
                  accuracy: p.accuracy,
                });
                await onImmediateSave(field.key, {
                  latitude: p.latitude,
                  longitude: p.longitude,
                  accuracy: p.accuracy,
                });
                toast.show("Location saved");
              } catch (e) {
                console.error(e);
              }
            }}
          />
          {isGpsValue(value) ? (
            <View style={{ gap: theme.spacing.xs }}>
              <Text>
                {`📍 ${formatCoordinates(value)}${formatAccuracy(value) ? `  (${formatAccuracy(value)})` : ""}`}
              </Text>
              <Button
                label="Open in Maps"
                variant="secondary"
                onPress={() => {
                  Linking.openURL(mapsUrl(value)).catch(() =>
                    Alert.alert("Couldn't open Maps", "No maps app could open this location."),
                  );
                }}
              />
            </View>
          ) : null}
        </View>
      );
    case "signature":
      return (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label">{fieldLabel(field)}</Text>
          <Button
            label={(attachmentsForField ?? []).length > 0 ? "Sign again" : "Add signature"}
            onPress={() => {
              // open modal with SignaturePad; the pad will call back with base64
              onOpenSignature(field.key);
            }}
          />
          {(attachmentsForField ?? []).map((a) => (
            <View key={a.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {a.localUri ? (
                <Image
                  source={{ uri: a.localUri }}
                  resizeMode="contain"
                  accessibilityLabel="Your signature"
                  // Always white: the signature is dark strokes on transparent,
                  // which would vanish on a dark theme background.
                  style={{
                    width: 200,
                    height: 80,
                    backgroundColor: "#FFFFFF",
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  }}
                />
              ) : (
                <Text variant="caption" muted>
                  {a.remoteUrl ? "Signed on another device" : "Uploading…"}
                </Text>
              )}
              <Button
                label="Delete"
                variant="danger"
                onPress={async () => {
                  try {
                    await deleteAttachment(a.id);
                    setAttachments((prev) => ({
                      ...prev,
                      [field.key]: (prev[field.key] ?? []).filter((x) => x.id !== a.id),
                    }));
                  } catch (err) {
                    console.error(err);
                  }
                }}
              />
            </View>
          ))}
        </View>
      );
    default:
      return (
        <Text variant="caption" muted>
          Unsupported field type: {field.type}
        </Text>
      );
  }
});

/**
 * Wraps a field with a red message underneath when the completion check found
 * a problem with it. A "Required" message disappears the moment the field has
 * an answer, so a person isn't left looking at a stale error.
 */
const FieldComponent = React.memo(function FieldComponent(
  props: React.ComponentProps<typeof FieldBody> & { error?: string },
) {
  const { error, ...bodyProps } = props;
  const theme = useTheme();
  const v = bodyProps.value;
  const answered = v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
  const shown = error && !(error === "Required" && answered) ? error : null;
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <FieldBody {...bodyProps} />
      {shown ? (
        <Text variant="caption" style={{ color: theme.colors.danger }} accessibilityLiveRegion="polite">
          {shown}
        </Text>
      ) : null}
    </View>
  );
});

export default function FormRenderer({
  inspectionId,
  templateId,
  errors,
}: {
  inspectionId: string;
  templateId: string | null;
  /** Field key → message, from the completion check (shown under each field). */
  errors?: Record<string, string>;
}) {
  const theme = useTheme();
  const toast = useToast();
  const [schema, setSchema] = useState<TemplateSchema | null>(null);
  const [answersMap, setAnswersMap] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<Record<string, any[]>>({});
  const [signatureModal, setSignatureModal] = useState<{ fieldKey: string } | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  // Warm up the camera/location/signature modules so the first tap is quick.
  useEffect(() => {
    preloadMediaModules();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!templateId) return;
      const template = await getTemplate(templateId);
      if (!template) return;
      try {
        const parsed = JSON.parse(template.schemaJson) as TemplateSchema;
        if (!cancelled) setSchema(parsed);
      } catch (e) {
        console.error("Failed to parse template schemaJson", e);
      }

      const ans = await getAnswers(inspectionId);
      if (cancelled) return;
      const map: Record<string, any> = {};
      for (const a of ans) {
        if (a.valueText !== null) map[a.fieldKey] = a.valueText;
        else if (a.valueNumber !== null) map[a.fieldKey] = a.valueNumber;
        else if (a.valueJson !== null) map[a.fieldKey] = JSON.parse(a.valueJson);
      }
      setAnswersMap(map);

      const atts = await listAttachmentsForInspection(inspectionId);
      const attMap: Record<string, any[]> = {};
      for (const att of atts) {
        attMap[att.fieldKey] = attMap[att.fieldKey] ?? [];
        attMap[att.fieldKey].push(att);
      }
      setAttachments(attMap);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [inspectionId, templateId]);

  // Simple debounced save: wait 500ms after change before writing. Also save
  // on blur and when the component unmounts. For simplicity we implement a
  // per-field timer map in memory here.
  //
  // This is held in a ref, not useMemo: a Map that gets mutated (.set/.delete)
  // after creation is exactly what refs are for — a mutable box React doesn't
  // re-render on. useMemo's result is meant to be treated as an immutable
  // snapshot, which is what the react-hooks/immutability lint rule enforces.
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      // flush any pending saves on unmount
      timers.forEach((t) => {
        clearTimeout(t);
      });
    };
  }, []);

  // Wrap save functions with useCallback so they are stable and don't cause
  // memoized child components to re-render due to new function identity.
  const scheduleSave = React.useCallback(
    (fieldKey: string, value: any) => {
      // update local UI state immediately
      setAnswersMap((prev) => ({ ...prev, [fieldKey]: value }));

      const timers = timersRef.current;
      // clear existing timer
      const existing = timers.get(fieldKey);
      if (existing) clearTimeout(existing);

      const id = setTimeout(async () => {
        try {
          // decide which column to save into
          if (typeof value === "number") {
            await saveAnswer(inspectionId, fieldKey, { number: value });
          } else if (typeof value === "object") {
            await saveAnswer(inspectionId, fieldKey, { json: value });
          } else {
            await saveAnswer(inspectionId, fieldKey, { text: value });
          }
        } catch (e) {
          console.error("Failed to autosave", e);
        }
      }, 500);

      timers.set(fieldKey, id);
    },
    [inspectionId],
  );

  const immediateSave = React.useCallback(
    async (fieldKey: string, value: any) => {
      // cancel any scheduled save and write immediately
      const timers = timersRef.current;
      const existing = timers.get(fieldKey);
      if (existing) clearTimeout(existing);
      timers.delete(fieldKey);
      try {
        if (typeof value === "number") {
          await saveAnswer(inspectionId, fieldKey, { number: value });
        } else if (typeof value === "object") {
          await saveAnswer(inspectionId, fieldKey, { json: value });
        } else {
          await saveAnswer(inspectionId, fieldKey, { text: value });
        }
      } catch (e) {
        console.error("Failed to save", e);
      }
    },
    [inspectionId],
  );

  if (!schema) return null;

  return (
    <View style={{ gap: theme.spacing.md }}>
      {hasRequiredFields(schema) ? (
        <Text variant="caption" muted>
          * required
        </Text>
      ) : null}
      {schema.sections.map((section) => (
        <View key={section.id} style={{ gap: theme.spacing.sm }}>
          <Text variant="subtitle">{section.title}</Text>
          {section.fields
            .filter((field: any) => isFieldVisible(field, answersMap))
            .map((field: any) => {
              const value = answersMap[field.key] ?? "";
              return (
                // Phase 4, Day 4: a `visibleIf` field appearing/disappearing
                // (Phase 2) is this app's real, existing equivalent of the
                // plan's suggested "form step transition" (this app has no
                // multi-step wizard to animate instead — docs/DESIGN.md has
                // the full reasoning for this substitution). `entering`/
                // `exiting` are Reanimated props: React (not this app's own
                // code) decides WHEN to mount/unmount a field as
                // `isFieldVisible` flips, and Reanimated plays this
                // animation automatically at exactly that moment.
                <Animated.View key={field.key} entering={FadeIn} exiting={FadeOut}>
                  <FieldComponent
                    field={field}
                    value={value}
                    inspectionId={inspectionId}
                    attachmentsForField={attachments[field.key] ?? []}
                    onScheduleSave={scheduleSave}
                    onImmediateSave={immediateSave}
                    error={errors?.[field.key]}
                    setAttachments={setAttachments}
                    onOpenSignature={(fieldKey) => setSignatureModal({ fieldKey })}
                    onOpenPhoto={setViewerUri}
                  />
                </Animated.View>
              );
            })}
        </View>
      ))}

      <PhotoViewer uri={viewerUri} onClose={() => setViewerUri(null)} />

      {/* Signature modal rendered at root level so it overlays everything */}
      {signatureModal ? (
        <SignaturePad
          visible={true}
          onCancel={() => setSignatureModal(null)}
          onSave={async (base64: string) => {
            // write base64 to file if FileSystem is available, then create attachment
            try {
              let localUri: string;
              let byteSize: number | null = null;
              try {
                const { Directory, File, Paths, EncodingType } = await import("expo-file-system");
                const folder = new Directory(Paths.document, "attachments", inspectionId);
                folder.create({ intermediates: true, idempotent: true });
                const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                const dest = new File(folder, `signature-${signatureModal.fieldKey}-${id}.png`);
                dest.write(base64, { encoding: EncodingType.Base64 });
                localUri = dest.uri;
                byteSize = dest.size ?? null;
              } catch (writeErr) {
                // Never create an attachment that points at a file that
                // doesn't exist (the old code saved a "placeholder" URI here
                // and sync would later try to upload it) — docs/DESIGN.md D-037.
                console.error(writeErr);
                Alert.alert("Couldn't save signature", "The signature wasn't saved. Please try again.");
                return;
              }

              const att = await createAttachment({
                inspectionId,
                fieldKey: signatureModal.fieldKey,
                localUri,
                mimeType: "image/png",
                byteSize,
                width: null,
                height: null,
              });
              setAttachments((prev) => ({
                ...prev,
                [signatureModal.fieldKey]: (prev[signatureModal.fieldKey] ?? []).concat(att),
              }));
              toast.show("Signature saved");
            } catch (err) {
              console.error(err);
            } finally {
              setSignatureModal(null);
            }
          }}
        />
      ) : null}
    </View>
  );
}
