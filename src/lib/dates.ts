// src/lib/dates.ts
//
// Helpers for the `date` field type. A date answer is stored as the text
// "YYYY-MM-DD" — not a timestamp: a calendar date has no time zone, and turning
// "21 Sep" into a moment in time would shift it by a day for someone in another
// zone. (Timestamps elsewhere in the app are epoch milliseconds; a *date* an
// inspector writes down is a different kind of value.)
//
// Entry is typed, with hyphens inserted automatically, because a native date
// picker needs a new native module and therefore a new build (D-041).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Digits only, at most 8, hyphenated as YYYY-MM-DD while typing. */
export function formatDateInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

/** True only for a real calendar date written YYYY-MM-DD (rejects 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/** "2026-09-21" → "21 Sep 2026". Anything that isn't a valid date is returned as-is. */
export function formatIsoDateForDisplay(value: string): string {
  if (!isValidIsoDate(value)) return value;
  const [y, m, d] = value.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** Today's date as "YYYY-MM-DD" in the phone's own time zone (for a "Today" button). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
