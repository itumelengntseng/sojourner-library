// What a screen reader hears for a book's spine on the halls (C72, C79).
import { finishedDate } from "./ledger";

const inline = (line: string) => line.charAt(0).toLowerCase() + line.slice(1);

// C99: `dueSoon` (due back within the day — the front hall slip's rule) is said after the due time.
// C108: `noRenewals` (every renewal used — C104's rule) is said after that.
export function spokenSpine(a: { author: string; canon: string; readingTime: string; due?: string; dueSoon?: boolean; noRenewals?: boolean; bookLeft?: string; finished?: number; justReturned?: string; justBorrowed?: string }): string {
  let out = `by ${a.author}. ${a.canon}. ${a.readingTime} to read.`;
  if (a.due) out += ` On loan to you, due ${a.due}${a.dueSoon ? " — due back within the day" : ""}${a.noRenewals ? ", no renewals left" : ""}${a.bookLeft ? `; ${inline(a.bookLeft)}` : ""}.`;
  // C144: taken out within the hour (the borrow stamp), said after the loan line.
  if (a.due && a.justBorrowed) out += ` Just borrowed, ${a.justBorrowed}.`;
  // C132: handed back within the hour (only when it isn't out again).
  if (!a.due && a.justReturned) out += ` Just returned, ${a.justReturned}.`;
  if (a.finished !== undefined) out += ` You read this to the end on ${finishedDate(a.finished)}.`;
  return out;
}

/** C142: the ✓ key's words for one or several books handed back within the hour. */
export function justBackLegend(n: number): string {
  return n === 1 ? "a book you returned in the last hour — borrow it again any time." : `the ${n} books you returned in the last hour — borrow them again any time.`;
}
