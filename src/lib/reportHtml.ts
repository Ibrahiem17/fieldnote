// src/lib/reportHtml.ts
//
// Phase 4, Day 1 — turns a ReportData object (src/lib/report.ts) into one
// complete HTML string for expo-print's printToFileAsync. Kept separate
// from report.ts so this file's job is purely "layout," not "what does the
// report say" — pagination changes only ever touch this file.
//
// Constraints from the plan (Section 4.3), all followed here:
//  - all CSS inline, in one <style> block — no external stylesheet, no web
//    font fetched from the internet (expo-print isn't a browser)
//  - images inlined as base64 data: URIs (src/lib/reportImages.ts)
//  - `page-break-inside: avoid` on every section and photo block, so a
//    section doesn't split awkwardly mid-page
//  - must render fully offline — nothing in this file makes a network call

import type { ReportData } from "./report";
import { localUriToDataUrl, MAX_INLINE_IMAGES } from "./reportImages";
import { formatTimestamp } from "./time";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  completed: "Completed",
  submitted: "Submitted",
};

const SYNC_LABEL: Record<string, string> = {
  local: "Not yet synced",
  pending: "Sync pending",
  syncing: "Syncing",
  synced: "Synced",
  failed: "Sync failed",
  conflict: "Sync conflict",
};

/** Escapes text that came from user input before it goes into the HTML
 * string — this report is built from a raw string template, not JSX, so
 * nothing else here protects against a project/inspector name that happens
 * to contain `<` or `&`. */
function esc(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 12px; margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px 0; }
  h2 { font-size: 15px; margin: 20px 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid #ddd; page-break-inside: avoid; }
  .muted { color: #666; }
  .header { border-bottom: 2px solid #2b5fa8; padding-bottom: 12px; margin-bottom: 16px; }
  .meta-grid { display: flex; flex-wrap: wrap; gap: 4px 24px; margin-bottom: 4px; }
  .meta-item { min-width: 200px; }
  .meta-label { font-size: 10px; text-transform: uppercase; color: #888; }
  .field-row { display: flex; padding: 4px 0; border-bottom: 1px solid #f0f0f0; page-break-inside: avoid; }
  .field-label { width: 40%; color: #444; }
  .field-value { width: 60%; white-space: pre-wrap; }
  .not-recorded { color: #999; font-style: italic; }
  .photo-group { margin-bottom: 16px; page-break-inside: avoid; }
  .photo-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .photo-grid img { width: 160px; height: 160px; object-fit: cover; border: 1px solid #ddd; border-radius: 4px; }
  .signature-block { margin-top: 16px; page-break-inside: avoid; }
  .signature-block img { max-width: 260px; border: 1px solid #ddd; }
  .truncation-note { font-size: 10px; color: #b45309; margin-top: 6px; }
  .footer { margin-top: 32px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 10px; color: #888; display: flex; justify-content: space-between; }
  @page { margin: 24px; }
  .page-number:after { content: counter(page); }
`;

export async function buildReportHtml(data: ReportData): Promise<string> {
  const { inspection, project, templateName, templateVersion } = data;

  // Collect every image this report wants to inline (photos, then the
  // signature last, so a truncated report still keeps the signature only
  // if photos genuinely leave room — signatures are added after the cap
  // check below instead, since a report missing its signature is a worse
  // failure than one missing a low-priority photo).
  const allPhotoRefs = data.photoGroups.flatMap((g) =>
    g.attachments.map((a) => ({ groupLabel: g.label, attachment: a })),
  );
  const truncated = allPhotoRefs.length > MAX_INLINE_IMAGES;
  const photoRefsToInline = allPhotoRefs.slice(0, MAX_INLINE_IMAGES);

  const photoDataUrls = await Promise.all(
    photoRefsToInline.map((ref) =>
      ref.attachment.localUri
        ? localUriToDataUrl(ref.attachment.localUri, ref.attachment.mimeType)
        : Promise.resolve(null),
    ),
  );

  const signatureDataUrl = data.signatureAttachment?.localUri
    ? await localUriToDataUrl(data.signatureAttachment.localUri, data.signatureAttachment.mimeType)
    : null;

  const sectionsHtml = data.sections
    .map(
      (section) => `
        <h2>${esc(section.title)}</h2>
        ${section.fields
          .map(
            (field) => `
              <div class="field-row">
                <div class="field-label">${esc(field.label)}</div>
                <div class="field-value ${field.displayValue === "Not recorded" ? "not-recorded" : ""}">${esc(field.displayValue)}</div>
              </div>`,
          )
          .join("")}
      `,
    )
    .join("");

  // Group the already-fetched data URLs back by their original photo group,
  // in the same order they were inlined.
  const byGroup = new Map<string, string[]>();
  photoRefsToInline.forEach((ref, i) => {
    const url = photoDataUrls[i];
    if (!url) return;
    const list = byGroup.get(ref.groupLabel) ?? [];
    list.push(url);
    byGroup.set(ref.groupLabel, list);
  });

  const photosHtml =
    byGroup.size === 0
      ? ""
      : `<h2>Photos</h2>${Array.from(byGroup.entries())
          .map(
            ([label, urls]) => `
              <div class="photo-group">
                <div class="meta-label">${esc(label)}</div>
                <div class="photo-grid">
                  ${urls.map((url) => `<img src="${url}" />`).join("")}
                </div>
              </div>`,
          )
          .join("")}
        ${truncated ? `<div class="truncation-note">${photoRefsToInline.length} of ${allPhotoRefs.length} photos shown — see the app for the full set.</div>` : ""}`;

  const locationHtml = data.gps
    ? `<h2>Location</h2>
       <div class="meta-grid">
         <div class="meta-item"><div class="meta-label">Coordinates</div>${data.gps.latitude.toFixed(6)}, ${data.gps.longitude.toFixed(6)}</div>
         <div class="meta-item"><div class="meta-label">Accuracy</div>&plusmn;${Math.round(data.gps.accuracy)}m</div>
       </div>`
    : "";

  const signatureHtml = signatureDataUrl
    ? `<div class="signature-block">
         <h2>Signature</h2>
         <img src="${signatureDataUrl}" />
         <div class="muted">${esc(inspection.inspectorName)}${inspection.completedAt ? " &middot; " + esc(formatTimestamp(inspection.completedAt)) : ""}</div>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>${STYLE}</style>
</head>
<body>
  <div class="header">
    <h1>${esc(inspection.title)}</h1>
    <div class="muted">${esc(templateName)} &middot; v${templateVersion} &middot; ${STATUS_LABEL[inspection.status] ?? inspection.status}</div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><div class="meta-label">Project</div>${esc(project?.name ?? "Not recorded")}</div>
    <div class="meta-item"><div class="meta-label">Client</div>${esc(project?.clientName ?? "Not recorded")}</div>
    <div class="meta-item"><div class="meta-label">Address</div>${esc(project?.address ?? "Not recorded")}</div>
    <div class="meta-item"><div class="meta-label">Inspector</div>${esc(inspection.inspectorName ?? "Not recorded")}</div>
    <div class="meta-item"><div class="meta-label">Date</div>${inspection.completedAt ? esc(formatTimestamp(inspection.completedAt)) : esc(formatTimestamp(inspection.updatedAt))}</div>
    <div class="meta-item"><div class="meta-label">Inspection ID</div>${esc(inspection.id)}</div>
  </div>

  ${locationHtml}
  ${sectionsHtml}
  ${photosHtml}
  ${signatureHtml}

  <div class="footer">
    <div>Generated ${esc(formatTimestamp(data.generatedAt))} &middot; ${SYNC_LABEL[inspection.syncStatus] ?? inspection.syncStatus}</div>
    <div>Page <span class="page-number"></span></div>
  </div>
</body>
</html>`;
}
