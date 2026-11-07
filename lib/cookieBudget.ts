// Browsers refuse a cookie whose name + value pass ~4 KB, and then keep the OLD value without a word —
// so the preview desk/session cookies must stay under budget (found in run 5: the 11th preview loan
// couldn't be returned). Measured as sent: Next URL-encodes cookie values.
export const COOKIE_BUDGET = 3800;

export const encodedLength = (s: string) => encodeURIComponent(s).length;

/**
 * `serialize(items)`, dropping entries (the one `dropIndex` picks, -1 = nothing more may go) until it fits.
 * Pure: the caller's array is untouched.
 */
export function fitCookie<T>(items: T[], serialize: (items: T[]) => string, dropIndex: (items: T[]) => number, budget = COOKIE_BUDGET): string {
  let keep = [...items];
  let out = serialize(keep);
  while (encodedLength(out) > budget) {
    const i = dropIndex(keep);
    if (i < 0) break;
    keep = keep.filter((_, j) => j !== i);
    out = serialize(keep);
  }
  return out;
}

/** JSON for `items`, dropping entries until it fits (see `fitCookie`). */
export function fitJson<T>(items: T[], dropIndex: (items: T[]) => number, budget = COOKIE_BUDGET): string {
  return fitCookie(items, (l) => JSON.stringify(l), dropIndex, budget);
}

// ── The compact shape (C48) ─────────────────────────────────────────────────
// "v2." then records joined by "!", fields by "~". Every character used is one encodeURIComponent
// leaves alone, so the cookie costs what it looks like (JSON's quotes, colons and commas cost 3× each).
// Times are base-36 milliseconds. Older cookies (JSON arrays) are still read.

export const COMPACT_PREFIX = "v2.";
const SAFE_FIELD = /^[A-Za-z0-9_.-]*$/;

/** True when every field can be written into the compact shape as-is. */
export const compactSafe = (fields: string[]) => fields.every((f) => SAFE_FIELD.test(f));

export function packRecords(records: string[][]): string {
  return COMPACT_PREFIX + records.map((r) => r.join("~")).join("!");
}

/** The records of a compact cookie, or null when `raw` isn't one. */
export function unpackRecords(raw: string): string[][] | null {
  if (!raw.startsWith(COMPACT_PREFIX)) return null;
  const body = raw.slice(COMPACT_PREFIX.length);
  return body === "" ? [] : body.split("!").map((r) => r.split("~"));
}

/** Base-36 for a non-negative whole number of milliseconds. */
export const b36 = (n: number) => Math.max(0, Math.round(n)).toString(36);

/** Reads a base-36 or decimal field; null for anything that isn't a clean non-negative whole number. */
export function readNum(s: string | undefined, radix: 10 | 36): number | null {
  if (s === undefined || s === "" || !(radix === 36 ? /^[0-9a-z]{1,12}$/ : /^[0-9]{1,15}$/).test(s)) return null;
  const n = parseInt(s, radix);
  return Number.isSafeInteger(n) ? n : null;
}
