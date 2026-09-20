// src/lib/uploadStatus.ts
//
// One plain sentence about whether the person's work has reached their
// account, or nothing at all when everything has (no banner noise when there's
// nothing to say). Pure, so the wording is tested rather than eyeballed.

export type UploadStatus = {
  /** Changes still waiting to be sent (excluding ones that gave up). */
  pending: number;
  /** Changes that gave up after repeated refusals and need a manual retry. */
  deadLettered: number;
  /** Whether the phone currently has a usable connection. */
  online: boolean;
};

export type UploadMessage = { text: string; tone: "info" | "problem" };

const changes = (n: number) => `${n} ${n === 1 ? "change" : "changes"}`;

export function describeUpload(status: UploadStatus): UploadMessage | null {
  if (status.deadLettered > 0) {
    return {
      tone: "problem",
      text: `${changes(status.deadLettered)} couldn't upload. Tap to try again.`,
    };
  }
  if (status.pending > 0) {
    return status.online
      ? { tone: "info", text: `Uploading ${changes(status.pending)}…` }
      : {
          tone: "info",
          text: `You're offline. ${changes(status.pending)} will upload when you have a signal.`,
        };
  }
  return null;
}
