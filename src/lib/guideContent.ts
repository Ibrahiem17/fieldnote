// src/lib/guideContent.ts
//
// Everything the "How to use" tab says, as plain data so it lives in one place and
// can be tested. It is written for someone who has never heard of the app: no
// developer words (no "outbox", "sync", "database"), and it only describes things
// the app really does. If a feature changes, change the words here.

import type { IconName } from "@/components/Icon";
import type { InspectionStatus } from "@/db/schema";

export type GuideStep = { icon: IconName; title: string; body: string };
export type GuideItem = { title: string; body: string };
export type GuideStatus = { status: InspectionStatus; body: string };

export const GUIDE = {
  purpose: {
    title: "What is Fieldnote?",
    paragraphs: [
      "Fieldnote is a notebook for inspections. You walk a site, answer a checklist on your phone, take photos, mark where you are and sign it off — then turn it into a PDF report you can send.",
      "It works even with no signal. Everything saves on your phone first, and uploads to your own account by itself when you're back online.",
    ],
  },
  steps: {
    title: "Four easy steps",
    items: [
      {
        icon: "folder",
        title: "Create a project",
        body: "A project is one job or site, like \"Harborview Retail Fitout\". Open the Projects tab, tap New Project, give it a name, and you're done.",
      },
      {
        icon: "inspections",
        title: "Start an inspection",
        body: "Open a project and tap New Inspection. Pick the type — Roof Inspection, Equipment Check or Site Safety Walk — and give it a title.",
      },
      {
        icon: "fill",
        title: "Fill it in",
        body: "Answer the questions; your answers save automatically. Questions marked * must be answered. You can add photos, capture your location and sign on the screen.",
      },
      {
        icon: "report",
        title: "Finish and share",
        body: "Tap Mark as complete, then Create PDF report. Your phone's share menu opens so you can send or save the report.",
      },
    ] satisfies GuideStep[],
  },
  offline: {
    title: "No signal? No problem",
    items: [
      {
        title: "When you're offline",
        body: "A strip at the top of the screen says how many changes are waiting. Keep working — nothing is lost.",
      },
      {
        title: "When the signal comes back",
        body: "Waiting changes upload by themselves. The strip disappears once everything has arrived.",
      },
      {
        title: "If something couldn't upload",
        body: "Tap the strip, then Upload now in Settings. Your work is still safe on this phone.",
      },
    ] satisfies GuideItem[],
  },
  labels: {
    title: "What the labels mean",
    items: [
      { status: "draft", body: "Just started." },
      { status: "in_progress", body: "You're still working on it." },
      { status: "completed", body: "Finished and ready for a report." },
      { status: "submitted", body: "Handed in." },
    ] satisfies GuideStatus[],
  },
  trouble: {
    title: "If something doesn't work",
    items: [
      {
        title: "The camera or location won't start",
        body: "Allow Camera or Location for Fieldnote in your phone's Settings, under Apps, then Fieldnote, then Permissions. Then try again.",
      },
      {
        title: "I can't sign in",
        body: "The first sign-in needs an internet connection. After that, Fieldnote works without a signal.",
      },
      {
        title: "It won't let me finish",
        body: "Mark as complete lists what's left. Answer the questions marked * and try again.",
      },
    ] satisfies GuideItem[],
  },
  data: {
    title: "Your data",
    paragraphs: [
      "Your inspections are stored on this phone and uploaded only to your own account. Nobody else can see them. Signing out doesn't delete anything from the phone.",
      "To remove an inspection, swipe it left on the Inspections tab. To remove a project, open it and tap Delete project.",
    ],
  },
  start: "Get started",
} as const;

/** Words a first-time user shouldn't meet. The guide's tests fail if any appear. */
export const BANNED_GUIDE_WORDS = ["outbox", "sync", "database", "sqlite", "supabase", "rls", "api", "json"];
