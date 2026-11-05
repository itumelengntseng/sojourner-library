/** Only allow same-site relative paths, so a crafted link can't bounce readers elsewhere. */
export function safeNextPath(next: string | null | undefined, fallback = "/card"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
