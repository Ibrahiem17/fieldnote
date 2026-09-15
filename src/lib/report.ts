// src/lib/report.ts
//
// Phase 4, Day 1 — gathers everything a PDF report needs into one plain data
// object. No React, no HTML here: this file only answers "what does this
// inspection's report actually say?" — turning it into a web page is
// src/lib/reportHtml.ts's job. Keeping the two separate means Day 1's
// trickiest part (pagination, in reportHtml.ts) never has to touch how an
// answer's value gets decoded.
//
// Every read below reuses an existing repository function — no new SQL.

import { getInspection } from "@/repositories/inspections";
import { getProject } from "@/repositories/projects";
import { getTemplate } from "@/repositories/templates";
import { getAnswers } from "@/repositories/answers";
import { listAttachmentsForInspection } from "@/repositories/attachments";
import type { Attachment, Inspection, Project } from "@/db/schema";

// The template format has no formal types anywhere in this codebase yet
// (FormRenderer.tsx uses the same loose shape) — matching that style here
// rather than inventing a parallel type system for one file.
type TemplateField = {
  key: string;
  type: string;
  label: string;
  options?: { value: string; label: string }[];
  visibleIf?: { field: string; in: unknown[] };
};
type TemplateSection = { id: string; title: string; fields: TemplateField[] };
type TemplateSchema = { id: string; name: string; version: number; sections: TemplateSection[] };

/** Exact copy of FormRenderer.tsx's isFieldVisible — the report must agree
 * with what the user actually saw, not re-derive its own opinion of it. */
function isFieldVisible(field: TemplateField, answers: Record<string, unknown>): boolean {
  if (!field.visibleIf) return true;
  const other = answers[field.visibleIf.field];
  return Boolean(other) && Boolean(field.visibleIf.in?.includes(other as never));
}

/** The literal string the plan's Section 4.2 requires for an unanswered
 * field — never a blank, which reads as the report having failed. */
const NOT_RECORDED = "Not recorded";

function formatValue(field: TemplateField, value: unknown): string {
  if (value === undefined || value === null || value === "") return NOT_RECORDED;

  switch (field.type) {
    case "select": {
      const label = field.options?.find((o) => o.value === value)?.label;
      return label ?? String(value);
    }
    case "multiselect": {
      const values = Array.isArray(value) ? value : [value];
      return values
        .map((v) => field.options?.find((o) => o.value === v)?.label ?? String(v))
        .join(", ");
    }
    case "boolean":
      return Boolean(value) && value !== 0 && value !== "0" ? "Yes" : "No";
    case "date":
      return new Date(Number(value)).toLocaleDateString();
    case "number":
      return String(value);
    case "text":
    case "longtext":
    default:
      return String(value);
  }
}

export type ReportField = {
  key: string;
  label: string;
  type: string;
  displayValue: string;
};

export type ReportPhotoGroup = {
  fieldKey: string;
  label: string;
  attachments: Attachment[];
};

export type ReportGps = { latitude: number; longitude: number; accuracy: number };

export type ReportSection = {
  id: string;
  title: string;
  fields: ReportField[];
};

export type ReportData = {
  inspection: Inspection;
  project: Project | null;
  templateName: string;
  templateVersion: number;
  sections: ReportSection[];
  photoGroups: ReportPhotoGroup[];
  signatureAttachment: Attachment | null;
  gps: ReportGps | null;
  generatedAt: number;
};

/** Turns an inspection's answer rows into a `fieldKey -> value` map, the
 * same three-column decode FormRenderer.tsx already does inline. */
function buildAnswersMap(answers: Awaited<ReturnType<typeof getAnswers>>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const a of answers) {
    if (a.valueText !== null) map[a.fieldKey] = a.valueText;
    else if (a.valueNumber !== null) map[a.fieldKey] = a.valueNumber;
    else if (a.valueJson !== null) map[a.fieldKey] = JSON.parse(a.valueJson);
  }
  return map;
}

export async function buildReportData(inspectionId: string): Promise<ReportData> {
  const inspection = await getInspection(inspectionId);
  if (!inspection) throw new Error(`Inspection not found: ${inspectionId}`);

  const project = inspection.projectId ? await getProject(inspection.projectId) : null;

  let schema: TemplateSchema | null = null;
  let templateVersion = 1;
  if (inspection.templateId) {
    const template = await getTemplate(inspection.templateId);
    if (template) {
      schema = JSON.parse(template.schemaJson) as TemplateSchema;
      templateVersion = template.version;
    }
  }

  const answers = await getAnswers(inspectionId);
  const answersMap = buildAnswersMap(answers);

  const attachments = await listAttachmentsForInspection(inspectionId);
  const attachmentsByField = new Map<string, Attachment[]>();
  for (const att of attachments) {
    const list = attachmentsByField.get(att.fieldKey) ?? [];
    list.push(att);
    attachmentsByField.set(att.fieldKey, list);
  }

  const sections: ReportSection[] = [];
  const photoGroups: ReportPhotoGroup[] = [];
  let signatureAttachment: Attachment | null = null;
  let gps: ReportGps | null = null;

  for (const section of schema?.sections ?? []) {
    const visibleFields = section.fields.filter((f) => isFieldVisible(f, answersMap));
    const reportFields: ReportField[] = [];

    for (const field of visibleFields) {
      if (field.type === "photo") {
        const atts = attachmentsByField.get(field.key) ?? [];
        if (atts.length > 0) {
          photoGroups.push({ fieldKey: field.key, label: field.label, attachments: atts });
        }
        continue;
      }
      if (field.type === "signature") {
        const atts = attachmentsByField.get(field.key) ?? [];
        // A signature can only meaningfully be re-captured, not appended —
        // the most recent one is the one that counts.
        if (atts.length > 0) signatureAttachment = atts[atts.length - 1];
        continue;
      }
      if (field.type === "gps") {
        const value = answersMap[field.key];
        if (value && typeof value === "object") gps = value as ReportGps;
        continue;
      }

      reportFields.push({
        key: field.key,
        label: field.label,
        type: field.type,
        displayValue: formatValue(field, answersMap[field.key]),
      });
    }

    if (reportFields.length > 0) {
      sections.push({ id: section.id, title: section.title, fields: reportFields });
    }
  }

  return {
    inspection,
    project,
    templateName: schema?.name ?? "Untitled template",
    templateVersion,
    sections,
    photoGroups,
    signatureAttachment,
    gps,
    generatedAt: Date.now(),
  };
}
