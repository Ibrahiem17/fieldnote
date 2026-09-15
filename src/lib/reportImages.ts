// src/lib/reportImages.ts
//
// Phase 4, Day 1 — reads a local photo/signature file back out as base64, so
// it can be inlined directly into the report's HTML as
// `<img src="data:image/jpeg;base64,...">`. expo-print's rendering engine
// isn't a browser (src/lib/report.ts's neighbour docs/DESIGN.md D-026 has
// the full reasoning): it can't fetch a `file://` URI itself on every
// platform, so the bytes have to already be in the HTML string.
//
// This is the first place in the codebase that reads a file back out as
// base64 — everywhere else either writes base64 (SignaturePad, via
// EncodingType.Base64) or reads raw bytes for a network upload
// (attachmentUpload.ts's `file.bytes()`). expo-file-system's `File` class
// has no built-in base64 reader, so this encodes the bytes by hand.

// Standard base64 alphabet — the same 64 characters every base64 encoder
// uses (RFC 4648), used here instead of a library because this one function
// is all that's needed and it avoids a new dependency for ~15 lines of code.
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  let result = "";
  // Process three raw bytes at a time -> four base64 characters, the
  // standard 3:4 ratio (3 bytes = 24 bits = four 6-bit base64 groups).
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];

    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    result += b1 === undefined ? "=" : BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    result += b2 === undefined ? "=" : BASE64_CHARS[b2 & 0x3f];
  }
  return result;
}

/**
 * Reads a local file and returns it as a `data:` URI ready to drop straight
 * into an `<img src="...">`. Returns `null` (never throws) if the file can't
 * be read — a missing photo shouldn't fail the whole report, it should just
 * be skipped, same "don't let one bad row break everything" discipline the
 * sync engine uses.
 */
export async function localUriToDataUrl(
  localUri: string,
  mimeType: string | null,
): Promise<string | null> {
  try {
    const { File } = await import("expo-file-system");
    const file = new File(localUri);
    if (!file.exists) return null;
    const bytes = await file.bytes();
    const base64 = bytesToBase64(bytes);
    return `data:${mimeType ?? "image/jpeg"};base64,${base64}`;
  } catch (e) {
    console.warn("localUriToDataUrl failed:", (e as Error)?.message ?? e);
    return null;
  }
}

/** Plan Section 2.2's memory cap: thirty full-size images at once exhausts
 * memory; this project has no persisted thumbnail (see docs/DESIGN.md
 * D-026), so the cap applies to the full-size images actually available. */
export const MAX_INLINE_IMAGES = 20;
