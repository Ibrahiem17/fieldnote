// src/lib/location.ts
//
// A GPS answer is stored as { latitude, longitude, accuracy }. These helpers
// turn it into something a person can read and act on, instead of the raw JSON
// the screen used to show.

export type GpsValue = { latitude: number; longitude: number; accuracy?: number | null };

/** Type guard: is this stored value a usable GPS reading? */
export function isGpsValue(value: unknown): value is GpsValue {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.latitude === "number" &&
    typeof v.longitude === "number" &&
    Number.isFinite(v.latitude) &&
    Number.isFinite(v.longitude)
  );
}

/** "31.4646° N, 74.2397° E" — hemisphere letters instead of minus signs. */
export function formatCoordinates(gps: GpsValue): string {
  const lat = `${Math.abs(gps.latitude).toFixed(4)}° ${gps.latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(gps.longitude).toFixed(4)}° ${gps.longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

/** "±100 m" — how far off the reading might be, if the phone said. */
export function formatAccuracy(gps: GpsValue): string | null {
  if (typeof gps.accuracy !== "number" || !Number.isFinite(gps.accuracy)) return null;
  return `±${Math.round(gps.accuracy)} m`;
}

/** A link Android/iOS open in the user's maps app. */
export function mapsUrl(gps: GpsValue): string {
  const { latitude, longitude } = gps;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
