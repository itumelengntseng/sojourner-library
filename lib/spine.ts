// What a screen reader hears for a book's spine on the halls (C72, C79).
import { finishedDate } from "./ledger";

const inline = (line: string) => line.charAt(0).toLowerCase() + line.slice(1);

export function spokenSpine(a: { author: string; canon: string; readingTime: string; due?: string; bookLeft?: string; finished?: number }): string {
  let out = `by ${a.author}. ${a.canon}. ${a.readingTime} to read.`;
  if (a.due) out += ` On loan to you, due ${a.due}${a.bookLeft ? `; ${inline(a.bookLeft)}` : ""}.`;
  if (a.finished !== undefined) out += ` You read this to the end on ${finishedDate(a.finished)}.`;
  return out;
}
