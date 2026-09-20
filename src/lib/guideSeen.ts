// src/lib/guideSeen.ts
//
// Remembers, on this phone, that the "How to use" guide has been shown once, so it
// can open by itself the first time and never nag again. It uses Expo's small
// built-in key-value store (a tiny table inside the app's own storage, no extra
// package). If storage is unavailable, both functions fail quietly: `hasSeenGuide`
// then answers "yes" so the guide is NOT forced on someone — never trap a person on
// a screen because a flag couldn't be read.

import Storage from "expo-sqlite/kv-store";

const KEY = "guide_seen_v2";

export async function hasSeenGuide(): Promise<boolean> {
  try {
    return (await Storage.getItem(KEY)) === "1";
  } catch (e) {
    console.error("guideSeen: couldn't read the flag", e);
    return true;
  }
}

export async function markGuideSeen(): Promise<void> {
  try {
    await Storage.setItem(KEY, "1");
  } catch (e) {
    console.error("guideSeen: couldn't save the flag", e);
  }
}
