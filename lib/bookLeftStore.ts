import "server-only";
// C74/C77/C78: "About N min left in this book" for each of the reader's open loans, keyed by slug.
import { bookLeftLine, type OnLoan } from "./loanDesk";
import { myLoanWords, myOpenLoans } from "./loanStore";
import { myPace } from "./sessionStore";

/** Lines for the given open loans (or the reader's own open loans when none are passed). Own loans only. */
export async function myBookLeft(given?: OnLoan[]): Promise<Record<string, string>> {
  const [loans, pace] = await Promise.all([given ?? myOpenLoans(), myPace()]);
  const words = await myLoanWords(loans);
  const out: Record<string, string> = {};
  for (const l of loans) {
    const line = bookLeftLine(words[l.slug] ?? 0, l.bookmark, pace.wpm);
    if (line) out[l.slug] = line;
  }
  return out;
}

/** Mid-sentence form: "about 25 min left in this book" / "at the end of this book". */
export function inline(line: string): string {
  return line.charAt(0).toLowerCase() + line.slice(1);
}
