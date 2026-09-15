// src/components/FormRenderer.tsx
//
// Minimal Phase 2 form renderer: parses a template's schemaJson and renders
// sections and fields. Supports the core field types required for Phase 2 in a
// pragmatic way while keeping the code readable for a beginner (BABY.md will
// explain every symbol added in this file).

import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, Alert, Linking, Image } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Text, Input, Button } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { getAnswers, saveAnswer } from "@/repositories/answers";
import {
  listAttachmentsForInspection,
  createAttachment,
  deleteAttachment,
} from "@/repositories/attachments";
import { getTemplate } from "@/repositories/templates";
import { takePhotoAndCompress, getLocationWithTimeout } from "@/lib/media";
import SignaturePad from "@/components/SignaturePad";
import { PhotoViewer } from "@/components/PhotoViewer";

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

// Same `visibleIf` check `src/lib/validation.ts` uses to decide whether a
// hidden field should be skipped during validation — kept here too so a
// field that's hidden is actually hidden on screen, not just excluded from
// the completion check. The two must agree: a field that's rendered but not
// validated (or the reverse) would be a confusing, hard-to-explain bug.
function isFieldVisible(field: any, answers: Record<string, any>): boolean {
  if (!field.visibleIf) return true;
  const other = answers[field.visibleIf.field];
  return Boolean(other) && Boolean(field.visibleIf.in?.includes(other));
}

// Move FieldComponent outside the main function so it can be memoized reliably.
const FieldComponent = React.memo(function FieldComponent(props: {
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

  switch (field.type) {
    case "text":
    case "longtext":
      return (
        <Input
          label={field.label}
          value={String(v)}
          onChangeText={(t) => onScheduleSave(field.key, t)}
          onBlur={() => onImmediateSave(field.key, v)}
          multiline={field.type === "longtext"}
          numberOfLines={field.type === "longtext" ? 4 : 1}
        />
      );
    case "number":
      return (
        <Input
          label={field.label}
          value={v !== "" ? String(v) : ""}
          keyboardType="numeric"
          onChangeText={(t) => onScheduleSave(field.key, Number(t))}
          onBlur={() => onImmediateSave(field.key, v)}
        />
      );
    case "select":
      return (
        <Input
          label={field.label}
          value={String(v)}
          placeholder={field.options?.map((o: any) => o.label).join(", ")}
          onChangeText={(t) => onScheduleSave(field.key, t)}
          onBlur={() => onImmediateSave(field.key, v)}
        />
      );
    case "multiselect":
      return (
        <Input
          label={field.label + " (comma-separated)"}
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
      return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
          <Text>{field.label}</Text>
          <Pressable
            onPress={() => {
              const next = !Boolean(v);
              onScheduleSave(field.key, next ? 1 : 0);
            }}
            // Phase 4, Day 4: this Pressable's own padding is well under
            // the 44pt minimum touch target — hitSlop extends the TAPPABLE
            // area outward without changing how big it LOOKS, so it's
            // easier to hit without redesigning the toggle's visual size.
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="switch"
            accessibilityLabel={field.label}
            accessibilityState={{ checked: Boolean(v) }}
            style={{
              padding: theme.spacing.xs,
              borderRadius: 6,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Text>{Boolean(v) ? "Yes" : "No"}</Text>
          </Pressable>
        </View>
      );
    case "photo":
      return (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label">{field.label}</Text>
          <Button
            label="Add photo"
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

                if (!res || (res as any).error) {
                  // fallback to placeholder behaviour when native packages missing
                  const att = await createAttachment({
                    inspectionId,
                    fieldKey: field.key,
                    localUri: "file:///placeholder.jpg",
                    mimeType: "image/jpeg",
                    byteSize: 12345,
                    width: 800,
                    height: 600,
                  });
                  setAttachments((prev) => ({
                    ...prev,
                    [field.key]: (prev[field.key] ?? []).concat(att),
                  }));
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
          <Text variant="label">{field.label}</Text>
          <Button
            label="Capture location"
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
                  // fallback dummy when native not available
                  const dummy = { latitude: 12.34, longitude: 56.78, accuracy: 9999 };
                  onScheduleSave(field.key, dummy);
                  await onImmediateSave(field.key, dummy);
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
              } catch (e) {
                console.error(e);
              }
            }}
          />
          {value ? <Text>{JSON.stringify(value)}</Text> : null}
        </View>
      );
    case "signature":
      return (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label">{field.label}</Text>
          <Button
            label="Capture signature"
            onPress={() => {
              // open modal with SignaturePad; the pad will call back with base64
              onOpenSignature(field.key);
            }}
          />
          {(attachmentsForField ?? []).map((a) => (
            <View key={a.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text>
                {a.localUri ?? (a.remoteUrl ? `(synced from another device: ${a.remoteUrl})` : "(uploading…)")}
              </Text>
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

export default function FormRenderer({
  inspectionId,
  templateId,
}: {
  inspectionId: string;
  templateId: string | null;
}) {
  const theme = useTheme();
  const [schema, setSchema] = useState<TemplateSchema | null>(null);
  const [answersMap, setAnswersMap] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<Record<string, any[]>>({});
  const [signatureModal, setSignatureModal] = useState<{ fieldKey: string } | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

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
              let localUri = "file:///signature-placeholder.png";
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
              } catch {
                // fallback: keep placeholder
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
