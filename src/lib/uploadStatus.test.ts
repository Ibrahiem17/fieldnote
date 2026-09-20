import { describeUpload } from "./uploadStatus";

test("says nothing when everything has uploaded", () => {
  expect(describeUpload({ pending: 0, deadLettered: 0, online: true })).toBeNull();
  expect(describeUpload({ pending: 0, deadLettered: 0, online: false })).toBeNull();
});

test("offline with work waiting reassures rather than alarms", () => {
  const m = describeUpload({ pending: 3, deadLettered: 0, online: false })!;
  expect(m.tone).toBe("info");
  expect(m.text).toBe("You're offline. 3 changes will upload when you have a signal.");
});

test("online with work waiting says it is uploading", () => {
  expect(describeUpload({ pending: 1, deadLettered: 0, online: true })!.text).toBe("Uploading 1 change…");
});

test("uploads that gave up are shown as a problem and take priority", () => {
  const m = describeUpload({ pending: 5, deadLettered: 2, online: false })!;
  expect(m.tone).toBe("problem");
  expect(m.text).toBe("2 changes couldn't upload. Tap to try again.");
});
