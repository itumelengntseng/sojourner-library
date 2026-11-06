// Browsers refuse a cookie whose name + value pass ~4 KB, and then keep the OLD value without a word —
// so the preview desk/session cookies must stay under budget (found in run 5: the 11th preview loan
// couldn't be returned). Measured as sent: Next URL-encodes cookie values.
export const COOKIE_BUDGET = 3800;

export const encodedLength = (s: string) => encodeURIComponent(s).length;

/**
 * JSON for `items`, dropping entries (the one `dropIndex` picks, -1 = nothing more may go) until it fits.
 * Pure: the caller's array is untouched.
 */
export function fitJson<T>(items: T[], dropIndex: (items: T[]) => number, budget = COOKIE_BUDGET): string {
  let keep = [...items];
  let out = JSON.stringify(keep);
  while (encodedLength(out) > budget) {
    const i = dropIndex(keep);
    if (i < 0) break;
    keep = keep.filter((_, j) => j !== i);
    out = JSON.stringify(keep);
  }
  return out;
}
