// What a screen reader hears for a book's spine on the halls (C72, C79).
import { finishedDate } from "./ledger";

const inline = (line: string) => line.charAt(0).toLowerCase() + line.slice(1);

// C99: `dueSoon` (due back within the day — the front hall slip's rule) is said after the due time.
// C108: `noRenewals` (every renewal used — C104's rule) is said after that.
export function spokenSpine(a: { author: string; canon: string; readingTime: string; due?: string; dueSoon?: boolean; noRenewals?: boolean; bookLeft?: string; finished?: number; justReturned?: string; justBorrowed?: string; readFor?: string }): string {
  let out = `by ${a.author}. ${a.canon}. ${a.readingTime} to read.`;
  if (a.due) out += ` On loan to you, due ${a.due}${a.dueSoon ? " — due back within the day" : ""}${a.noRenewals ? ", no renewals left" : ""}${a.bookLeft ? `; ${inline(a.bookLeft)}` : ""}.`;
  // C144: taken out within the hour (the borrow stamp), said after the loan line.
  if (a.due && a.justBorrowed) out += ` Just borrowed, ${a.justBorrowed}.`;
  // C132: handed back within the hour (only when it isn't out again).
  if (!a.due && a.justReturned) out += ` Just returned, ${a.justReturned}.`;
  if (a.finished !== undefined) out += ` You read this to the end on ${finishedDate(a.finished)}.`;
  // C167: under "Most read by you", how long the reader has spent in it.
  if (a.readFor) out += ` You've read for ${a.readFor}.`;
  return out;
}

/** C142: the ✓ key's words for one or several books handed back within the hour. */
export function justBackLegend(n: number): string {
  return n === 1 ? "a book you returned in the last hour — borrow it again any time." : `the ${n} books you returned in the last hour — borrow them again any time.`;
}

/** C118 + C150: the "out" key — how many books are out to the reader, and how many were taken out within the hour. */
export function outLegend(n: number, fresh = 0): string {
  const what = n === 1 ? "the book" : `the ${n} books`;
  const note = fresh > 0 ? (n === 1 ? " (just borrowed)" : ` (${fresh} just borrowed)`) : "";
  return `${what} out to you${note} — renew or return ${n === 1 ? "it" : "them"}`;
}

/** C208: said after the rest of a spine's label when the book holds the reader's own notes (nothing visible). */
export const SPINE_NOTES = " You have notes in it.";

/** C213: the halls legend's spoken-only line, when any spine on the page holds the reader's notes. */
export const SPINE_NOTES_LEGEND = "Books holding your notes say so when read aloud.";
