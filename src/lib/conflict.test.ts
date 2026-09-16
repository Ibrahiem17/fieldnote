// src/lib/conflict.test.ts
//
// Phase 4, Day 5 — the plan's own highest-priority test target (Section
// 3.5.2: "Conflict resolution — every rule R1-R7. The most valuable tests
// in the project."). `resolveConflict` is a pure function (CLAUDE.md's own
// rule for why it's built this way) — every test here calls it directly,
// no mocking, no database, no async.

import { resolveConflict } from "./conflict";

// Every test shares this base and only overrides what it actually cares
// about — keeps each test's own intent visible instead of buried in
// boilerplate that's identical across all seven.
function baseArgs() {
  return {
    localRow: { id: "x", title: "Local title", notes: "Local notes" },
    serverRow: { id: "x", title: "Local title", notes: "Local notes" },
    dirtyFields: new Set<string>(),
    hasPendingDelete: false,
    localPendingChangedAt: 1_000_000,
    serverUpdatedAtMs: 1_000_000,
    ignoreFields: ["id"],
  };
}

test("R1: a field this device never touched takes the server's value", () => {
  const result = resolveConflict({
    ...baseArgs(),
    serverRow: { id: "x", title: "Local title", notes: "Server's updated notes" },
    dirtyFields: new Set(["title"]), // this device only ever touched title, not notes
  });

  expect(result.kind).toBe("fields");
  if (result.kind !== "fields") throw new Error("expected fields");
  const notesResolution = result.resolutions.find((r) => r.field === "notes");
  expect(notesResolution).toEqual({
    field: "notes",
    action: "take-server",
    value: "Server's updated notes",
  });
});

test("R2: one side empty, the real value wins regardless of which side", () => {
  const result = resolveConflict({
    ...baseArgs(),
    localRow: { id: "x", title: "", notes: "Local notes" },
    serverRow: { id: "x", title: "Server title", notes: "Local notes" },
    dirtyFields: new Set(["title"]),
  });

  expect(result.kind).toBe("fields");
  if (result.kind !== "fields") throw new Error("expected fields");
  const titleResolution = result.resolutions.find((r) => r.field === "title");
  expect(titleResolution).toEqual({ field: "title", action: "take-server", value: "Server title" });
});

test("R3 (adapted): both sides changed the same field, more than 60s apart, not close in time -> keep local (about to push and win)", () => {
  const result = resolveConflict({
    ...baseArgs(),
    localRow: { id: "x", title: "Local's newer title", notes: "Local notes" },
    serverRow: { id: "x", title: "Server's older title", notes: "Local notes" },
    dirtyFields: new Set(["title"]),
    localPendingChangedAt: 2_000_000,
    serverUpdatedAtMs: 1_000_000, // 1,000,000ms = ~16.7min apart, well outside the 60s window
  });

  expect(result.kind).toBe("fields");
  if (result.kind !== "fields") throw new Error("expected fields");
  const titleResolution = result.resolutions.find((r) => r.field === "title");
  expect(titleResolution).toEqual({ field: "title", action: "keep-local" });
});

test("R4/R5: an incoming tombstone beats a pending local edit", () => {
  const result = resolveConflict({
    ...baseArgs(),
    serverRow: { id: "x", title: "Local title", notes: "Local notes", deletedAt: 5_000_000 },
    dirtyFields: new Set(["title"]),
    hasPendingDelete: false,
  });

  expect(result).toEqual({ kind: "delete-wins" });
});

test("this device's OWN pending delete proceeds, regardless of the server row", () => {
  const result = resolveConflict({
    ...baseArgs(),
    hasPendingDelete: true,
  });

  expect(result).toEqual({ kind: "own-delete-proceeds" });
});

test("R7: both sides changed the same field, both real, both non-empty, within 60s -> flag for manual resolution", () => {
  const result = resolveConflict({
    ...baseArgs(),
    localRow: { id: "x", title: "Local's urgent note", notes: "Local notes" },
    serverRow: { id: "x", title: "Server's urgent note", notes: "Local notes" },
    dirtyFields: new Set(["title"]),
    localPendingChangedAt: 1_000_000,
    serverUpdatedAtMs: 1_000_010, // 10ms apart, well inside the 60s window
  });

  expect(result.kind).toBe("fields");
  if (result.kind !== "fields") throw new Error("expected fields");
  const titleResolution = result.resolutions.find((r) => r.field === "title");
  expect(titleResolution).toEqual({
    field: "title",
    action: "manual",
    localValue: "Local's urgent note",
    serverValue: "Server's urgent note",
  });
});

test("both sides agreeing on a dirty field's value resolves as keep-local, not a conflict", () => {
  const result = resolveConflict({
    ...baseArgs(),
    localRow: { id: "x", title: "Same title everywhere", notes: "Local notes" },
    serverRow: { id: "x", title: "Same title everywhere", notes: "Local notes" },
    dirtyFields: new Set(["title"]),
  });

  expect(result.kind).toBe("fields");
  if (result.kind !== "fields") throw new Error("expected fields");
  const titleResolution = result.resolutions.find((r) => r.field === "title");
  expect(titleResolution).toEqual({ field: "title", action: "keep-local" });
});
