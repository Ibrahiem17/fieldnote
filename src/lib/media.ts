// src/lib/media.ts
// Helpers for media and location in Phase 2. These use dynamic imports so the
// code degrades gracefully when native expo packages are not installed (web
// preview / CI). Each function returns structured results or throws/returns
// null on cancel.

import { Alert } from "react-native";

export type PhotoResult = {
  localUri: string;
  mimeType: string;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  thumbLocalUri?: string;
};

export async function takePhotoAndCompress(inspectionId: string, fieldKey: string): Promise<PhotoResult | null | { error: string }> {
  // Dynamic import so missing native deps don't crash the web preview.
  try {
    const ImagePicker = await import("expo-image-picker");
    const ImageManipulator = await import("expo-image-manipulator");
    const FileSystem = await import("expo-file-system");

    // Request camera permissions
    const perm = await ImagePicker.requestCameraPermissionsAsync?.();
    if (perm && perm.status !== "granted") {
      return { error: "permission-denied" };
    }

    // Launch system camera (returns a result or cancel)
    const res = await ImagePicker.launchCameraAsync({ quality: 1, base64: false });
    // older expo returns { cancelled, uri }
    if ((res as any).cancelled === true) return null;

    // normalize uri
    const uri = (res as any).uri ?? (res as any)?.assets?.[0]?.uri;
    if (!uri) return null;

    // Target long edge and quality per Phase 2
    const TARGET_LONG_EDGE = 1600;
    const QUALITY = 0.7;

    // read image dimensions (manipulate can resize but we want original dims too)
    // use manipulate to resize while keeping aspect
    // get asset info via FileSystem.getInfoAsync
    const info = await FileSystem.getInfoAsync(uri, { size: true });

    // Determine resize action: compute scale from width/height if possible by reading image metadata
    // We'll do a resize with max width or height = TARGET_LONG_EDGE
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: TARGET_LONG_EDGE } }],
      { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Save the compressed image into documentDirectory/attachments/{inspectionId}/
    const docDir = FileSystem.documentDirectory ?? "";
    const folder = `${docDir}attachments/${inspectionId}/`;
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => {});

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const ext = ".jpg";
    const dest = `${folder}${fieldKey}-${id}${ext}`;
    // move/copy the manipulated file to dest. manipulateAsync returns a uri
    await FileSystem.copyAsync({ from: manipResult.uri, to: dest });

    // create thumbnail
    const thumbsFolder = `${folder}thumbs/`;
    await FileSystem.makeDirectoryAsync(thumbsFolder, { intermediates: true }).catch(() => {});
    const thumbDest = `${thumbsFolder}${fieldKey}-${id}-thumb${ext}`;
    const thumb = await ImageManipulator.manipulateAsync(
      manipResult.uri,
      [{ resize: { width: 200 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    await FileSystem.copyAsync({ from: thumb.uri, to: thumbDest });

    // gather sizes
    const stat = await FileSystem.getInfoAsync(dest, { size: true });
    const thumbStat = await FileSystem.getInfoAsync(thumbDest, { size: true });

    // attempt to derive dimensions from manipulate result if available
    const width = (manipResult as any).width ?? null;
    const height = (manipResult as any).height ?? null;

    return {
      localUri: dest,
      mimeType: "image/jpeg",
      byteSize: stat.size ?? null,
      width,
      height,
      thumbLocalUri: thumbDest,
    };
  } catch (e: any) {
    console.warn("takePhotoAndCompress failed or expo packages missing:", e?.message ?? e);
    // if packages missing, return a special error so caller can fallback
    return { error: "no-native" };
  }
}

export async function getLocationWithTimeout(timeoutMs = 10000): Promise<{ latitude: number; longitude: number; accuracy: number } | { error: string }> {
  try {
    const Location = await import("expo-location");
    const perms = await Location.requestForegroundPermissionsAsync?.();
    if (perms && perms.status !== "granted") {
      return { error: "permission-denied" };
    }

    // set up a race between location and timeout
    const p = Location.getCurrentPositionAsync({ accuracy: Location.LocationAccuracy.Balanced });
    const t = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs));
    const pos = await Promise.race([p, t]);
    const coords = (pos as any).coords ?? (pos as any);
    return { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy ?? 9999 };
  } catch (e: any) {
    if ((e?.message ?? "").toLowerCase().includes("timeout")) return { error: "timeout" };
    console.warn("getLocationWithTimeout failed or expo-location missing:", e?.message ?? e);
    return { error: "no-native" };
  }
}
