// Membership cards: pure helpers shared by the sign-in pages and tests.

export type Role = "owner" | "guest";

export interface ReaderCard {
  id: string;
  role: Role;
  display_name: string;
  card_number: string;
  created_at: string;
}

export function roleLabel(role: Role): string {
  return role === "owner" ? "Keeper of the Library" : "Guest Reader";
}

/** "1A2B3C4D5E" → "1A2B 3C4D 5E" for printing on the card. */
export function formatCardNumber(n: string): string {
  return n.replace(/\s+/g, "").toUpperCase().replace(/(.{4})(?=.)/g, "$1 ");
}

/** Same rule as the database: letters and digits only, upper-cased. */
export function normalizeInviteCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Cheap client-side check before we bother the server: SOJ + 12 hex chars. */
export function isPlausibleInviteCode(code: string): boolean {
  return /^SOJ[0-9A-F]{12}$/.test(normalizeInviteCode(code));
}

export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Turns database exceptions from redeem_invite into words for the reader. */
export function friendlyRedeemError(message: string): string {
  const known = [
    "already hold a reader card",
    "not recognised",
    "already been used",
    "has expired",
    "sign in before",
  ];
  const hit = known.find((k) => message.includes(k));
  if (!hit) return "The desk couldn't issue your card just now. Please try again in a moment.";
  if (hit === "already hold a reader card") return "You already hold a reader card.";
  if (hit === "not recognised") return "That invite code isn't one the librarian recognises.";
  if (hit === "already been used") return "That invite has already been used.";
  if (hit === "has expired") return "That invite has expired. Ask for a fresh one.";
  return "Please sign in before redeeming an invite.";
}

export function issuedOn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export const WPM_MIN = 50;
export const WPM_MAX = 1500;

export type Prefs = { ok: true; displayName: string; wpmOverride: number | null } | { ok: false; message: string };

/** Checks the card's preferences form: a name (up to 60 characters) and an optional fixed pace. */
export function checkPrefs(name: unknown, pace: unknown, learn: unknown): Prefs {
  const displayName = String(name ?? "").replace(/\s+/g, " ").trim();
  if (displayName.length > 60) return { ok: false, message: "Keep your name under 60 characters." };
  if (learn === "on" || String(pace ?? "").trim() === "") return { ok: true, displayName, wpmOverride: null };
  const wpm = Number(String(pace).trim());
  if (!Number.isInteger(wpm) || wpm < WPM_MIN || wpm > WPM_MAX) return { ok: false, message: `A pace is a whole number of words a minute, ${WPM_MIN}–${WPM_MAX}.` };
  return { ok: true, displayName, wpmOverride: wpm };
}
