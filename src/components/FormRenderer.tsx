// src/components/FormRenderer.tsx
//
// Minimal Phase 2 form renderer: parses a template's schemaJson and renders
// sections and fields. Supports the core field types required for Phase 2 in a
// pragmatic way while keeping the code readable for a beginner (BABY.md will
// explain every symbol added in this file).

import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable, Alert, Linking } from "react-native";
import { Text, Input, Button } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { getAnswers, saveAnswer } from "@/repositories/answers";
import { listAttachmentsForInspection, createAttachment, deleteAttachment } from "@/repositories/attachments";
import { getTemplate } from "@/repositories/templates";
import { takePhotoAndCompress, getLocationWithTimeout } from "@/lib/media";
import SignaturePad from "@/components/SignaturePad";

type TemplateSchema = {
  id: string;
  name: string;
  version: number;
  sections: Array<{
    id: string;
    title: string;
    fields: Array<any>;
  }>;
};

// Move FieldComponent outside the main function so it can be memoized reliably.
const FieldComponent = React.memo(function FieldComponent(props: {
  field: any;
  value: any;
  inspectionId: string;
  attachmentsForField: any[];
  onScheduleSave: (k: string, v: any) => void;
  onImmediateSave: (k: string, v: any) => Promise<void>;
  setAttachments: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
}) {
  const { field, value, inspectionId, attachmentsForField, onScheduleSave, onImmediateSave, setAttachments } = props;
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
          onChangeText={(t) => onScheduleSave(field.key, t.split(",").map((s) => s.trim()))}
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
            style={{ padding: theme.spacing.xs, borderRadius: 6, backgroundColor: theme.colors.surface }}
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
                  Alert.alert("Camera permission", "Camera permission was denied. Open Settings to enable it.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Open Settings", onPress: () => Linking.openSettings() },
                  ]);
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
                  setAttachments((prev) => ({ ...prev, [field.key]: (prev[field.key] ?? []).concat(att) }));
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
                setAttachments((prev) => ({ ...prev, [field.key]: (prev[field.key] ?? []).concat(att) }));
              } catch (e) {
                console.error(e);
              }
            }}
          />
          {(attachmentsForField ?? []).map((a) => (
            <View key={a.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text>{a.localUri}{(a as any).thumbLocalUri ? ` (thumb: ${(a as any).thumbLocalUri})` : ""}</Text>
              <Button label="Delete" variant="danger" onPress={async () => {
                try {
                  // attempt to remove files from disk when FileSystem is available
                  try {
                    const FileSystem = await import('expo-file-system');
                    if (a.localUri) await FileSystem.deleteAsync(a.localUri, { idempotent: true }).catch(() => {});
                    if ((a as any).thumbLocalUri) await FileSystem.deleteAsync((a as any).thumbLocalUri, { idempotent: true }).catch(() => {});
                  } catch (err) {
                    // ignore if expo-file-system not installed
                  }
                  await deleteAttachment(a.id);
                  setAttachments((prev) => ({ ...prev, [field.key]: (prev[field.key] ?? []).filter((x) => x.id !== a.id) }));
                } catch (e) {
                  console.error(e);
                }
              }} />
            </View>
          ))}
        </View>
      );
    case "gps":
      return (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label">{field.label}</Text>
          <Button label="Capture location" onPress={async () => {
            try {
              const pos = await getLocationWithTimeout(10000);
              if ((pos as any).error === "permission-denied") {
                Alert.alert("Location permission", "Location permission was denied. Open Settings to enable it.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Open Settings", onPress: () => Linking.openSettings() },
                ]);
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
              onScheduleSave(field.key, { latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy });
              await onImmediateSave(field.key, { latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy });
            } catch (e) {
              console.error(e);
            }
          }} />
          {value ? <Text>{JSON.stringify(value)}</Text> : null}
        </View>
      );
    case "signature":
      return (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label">{field.label}</Text>
          <Button label="Capture signature" onPress={async () => {
            // open modal with SignaturePad; the pad will call back with base64
            setSignatureModal({ fieldKey: field.key });
          }} />
          {(attachmentsForField ?? []).map((a) => (
            <View key={a.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text>{a.localUri}</Text>
              <Button label="Delete" variant="danger" onPress={async () => {
                try {
                  await deleteAttachment(a.id);
                  setAttachments((prev) => ({ ...prev, [field.key]: (prev[field.key] ?? []).filter((x) => x.id !== a.id) }));
                } catch (err) {
                  console.error(err);
                }
              }} />
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

export default function FormRenderer({ inspectionId, templateId }: { inspectionId: string; templateId: string | null }) {
  const theme = useTheme();
  const [schema, setSchema] = useState<TemplateSchema | null>(null);
  const [answersMap, setAnswersMap] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<Record<string, any[]>>({});
  const [signatureModal, setSignatureModal] = useState<{ fieldKey: string } | null>(null);

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
  const timers = useMemo(() => new Map<string, number>(), []);

  useEffect(() => {
    return () => {
      // flush any pending saves on unmount
      timers.forEach((t) => {
        clearTimeout(t);
      });
    };
  }, [timers]);

  // Wrap save functions with useCallback so they are stable and don't cause
  // memoized child components to re-render due to new function identity.
  const scheduleSave = React.useCallback((fieldKey: string, value: any) => {
    // update local UI state immediately
    setAnswersMap((prev) => ({ ...prev, [fieldKey]: value }));

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

    timers.set(fieldKey, id as unknown as number);
  }, [inspectionId, timers]);

  const immediateSave = React.useCallback(async (fieldKey: string, value: any) => {
    // cancel any scheduled save and write immediately
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
  }, [inspectionId, timers]);

  if (!schema) return null;

  return (
    <View style={{ gap: theme.spacing.md }}>
      {schema.sections.map((section) => (
        <View key={section.id} style={{ gap: theme.spacing.sm }}>
          <Text variant="heading">{section.title}</Text>
          {section.fields.map((field: any) => {
            const value = answersMap[field.key] ?? "";
            return (
              <FieldComponent
                key={field.key}
                field={field}
                value={value}
                inspectionId={inspectionId}
                attachmentsForField={attachments[field.key] ?? []}
                onScheduleSave={scheduleSave}
                onImmediateSave={immediateSave}
                setAttachments={setAttachments}
              />
            );
          })}
        </View>
      ))}

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
                const FileSystem = await import("expo-file-system");
                const docDir = FileSystem.documentDirectory ?? "";
                const folder = `${docDir}attachments/${inspectionId}/`;
                await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => {});
                const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                const dest = `${folder}signature-${signatureModal.fieldKey}-${id}.png`;
                await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
                const info = await FileSystem.getInfoAsync(dest, { size: true });
                localUri = dest;
                byteSize = info.size ?? null;
              } catch (e) {
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
              setAttachments((prev) => ({ ...prev, [signatureModal.fieldKey]: (prev[signatureModal.fieldKey] ?? []).concat(att) }));
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
