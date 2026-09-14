// src/lib/supabase.ts
//
// The one Supabase client for the whole app — Phase 3's equivalent of
// src/db/client.ts. Everything that talks to the server (auth today; push
// and pull from Day 2 onward) goes through this one configured client,
// never a fresh createClient() call somewhere else.

import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Fail loudly, at boot, in dev — a missing .env is a setup mistake, not
// something that should surface later as a mysterious network error deep
// inside a sync attempt. See .env.example for what's required.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env and fill in your Supabase project's values.",
  );
}

/**
 * Adapts `expo-secure-store` (async, encrypted-keychain-backed) to the
 * plain `{ getItem, setItem, removeItem }` shape Supabase's client expects
 * for session storage — see plan Section 2.2: "Where we store them:
 * expo-secure-store... Not AsyncStorage, which is plain readable text."
 *
 * Known limitation, not silently worked around: SecureStore caps a single
 * value at roughly 2KB on-device. A session this app stores (email/password
 * auth, no large custom user metadata) comfortably fits today. If a later
 * change ever grows the stored session past that limit, the fix is
 * Supabase's documented "hybrid" pattern — an AES key in SecureStore, the
 * (larger) encrypted session blob in AsyncStorage — not a silent fallback
 * to plaintext storage. Recorded here rather than pre-built, since it isn't
 * needed yet and would be unverifiable dead code until it is.
 */
const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

/**
 * `expo-secure-store` has no real implementation on web at all — every
 * method throws `... is not a function` there (confirmed live: it crashed
 * the whole app to a blank white screen, not a caught error, the moment
 * AuthProvider asked for a stored session). This is a genuine, permanent
 * web platform gap in the library, not something specific to this
 * project's sandboxed preview (D-010's SharedArrayBuffer issue) — it would
 * be exactly as broken in an ordinary desktop browser.
 *
 * `localStorage` is the standard, expected place for a web session to
 * live — every browser-based app does this, and it's what Supabase's own
 * web SDK uses by default. It is genuinely less protected than the native
 * keychain SecureStore uses (readable by any script on the page), but that
 * trade-off already exists for every web app; it isn't one this file is
 * introducing. Android and iOS are completely unaffected — they always
 * use the real, encrypted secureStoreAdapter above.
 */
const webStorageAdapter = {
  getItem: async (key: string) =>
    typeof localStorage === "undefined" ? null : localStorage.getItem(key),
  setItem: async (key: string, value: string) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === "web" ? webStorageAdapter : secureStoreAdapter,
    // The app itself decides when to navigate on auth changes (AuthProvider
    // below) — Supabase's own URL-based session detection is a web-only
    // concept (magic links, OAuth redirects) this app doesn't use.
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
