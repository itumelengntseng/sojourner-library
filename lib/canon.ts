// The canon switch: one choice that follows the reader through the whole library.
// A ?canon= link sets it (the proxy remembers it in a cookie); otherwise the cookie decides.
import type { CanonView } from "./workStats";

export const CANON_COOKIE = "soj_canon";
export const CANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isCanonView(v: unknown): v is CanonView {
  return v === "canon" || v === "all";
}

/** The link wins, then the remembered choice, then canon only. */
export function resolveCanonView(param: string | string[] | undefined, cookie: string | undefined): CanonView {
  const p = Array.isArray(param) ? param[0] : param;
  if (isCanonView(p)) return p;
  if (isCanonView(cookie)) return cookie;
  return "canon";
}

export function canonHref(basePath: string, view: CanonView): string {
  return `${basePath}?canon=${view}`;
}

/** What to say on a work outside the reader's current view. */
export function outsideCanonNote(status: "canon" | "draft" | "apocrypha"): string | null {
  if (status === "draft") return "This is a draft — not part of the canon. It may change or be set aside.";
  if (status === "apocrypha") return "This sits outside the canon — a side road, not the main way.";
  return null;
}
