// What a screen reader hears for a book's spine on the halls (C72, C79).
import { finishedDate } from "./ledger";

const inline = (line: string) => line.charAt(0).toLowerCase() + line.slice(1);

// C99: `dueSoon` (due back within the day — the front hall slip's rule) is said after the due time.
export function spokenSpine(a: { author: string; canon: string; readingTime: string; due?: string; dueSoon?: boolean; bookLeft?: string; finished?: number }): string {
  let out = `by ${a.author}. ${a.canon}. ${a.readingTime} to read.`;
  if (a.due) out += ` On loan to you, due ${a.due}${a.dueSoon ? " — due back within the day" : ""}${a.bookLeft ? `; ${inline(a.bookLeft)}` : ""}.`;
  if (a.finished !== undefined) out += ` You read this to the end on ${finishedDate(a.finished)}.`;
  return out;
}
