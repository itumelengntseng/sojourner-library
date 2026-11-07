// "Continue reading" on the front hall (C34): the open loan the reader read most recently,
// the chapter they were in, and how long that chapter has left at their pace.
// Titles and word counts only — never chapter text.
import { formatDuration, minutesFor } from "./engine/readingTime";
import { FINISH_SHARE, type WorkSession } from "./ledger";
import { locateBookmark } from "./reader";

export interface ContinueLoan {
  workKey: string; // slug (preview) or work id (library)
  slug: string;
  title: string;
  bookmarkOffset: number; // work-level word offset (0 = none)
}

export interface ContinueChapter { key: string; position: number; title: string; words: number }

export interface ContinueCard {
  slug: string;
  title: string;
  chapterPosition: number;
  chapterTitle: string;
  wordsLeft: number;
  minutesLeft: number;
  left: string; // "12 min left in this chapter" / "this chapter is read through"
  lastRead: number;
  href: string;
}

/**
 * Picks the open loan with the most recent session of the reader's own, then the chapter of that
 * session. Words already read in it = the bookmark if it sits in that chapter, otherwise the words
 * the reader's sessions there add up to (capped at the chapter). No sessions on any open loan →
 * nothing (the front desk's "On loan now" covers books not yet opened).
 */
export function continueReading(
  loans: ContinueLoan[],
  sessions: WorkSession[],
  chapters: Record<string, ContinueChapter[]>,
  wpm: number,
): ContinueCard | null {
  let best: { loan: ContinueLoan; session: WorkSession } | null = null;
  for (const loan of loans) {
    if (!(chapters[loan.workKey]?.length)) continue;
    for (const s of sessions) {
      if (s.workKey !== loan.workKey) continue;
      if (!best || s.endedAt > best.session.endedAt) best = { loan, session: s };
    }
  }
  if (!best) return null;
  const { loan, session } = best;
  const list = [...chapters[loan.workKey]].sort((a, b) => a.position - b.position);
  const mark = loan.bookmarkOffset > 0 ? locateBookmark(list, loan.bookmarkOffset) : null;
  let ch = list.find((c) => c.key === session.chapterKey)
    ?? (mark ? list.find((c) => c.position === mark.position) : undefined)
    ?? list[0];
  const readIn = (c: ContinueChapter) => (mark && mark.position === c.position)
    ? mark.wordsIntoChapter
    : sessions.filter((s) => s.workKey === loan.workKey && s.chapterKey === c.key).reduce((a, s) => a + s.wordsRead, 0);
  const left = (c: ContinueChapter) => {
    const r = Math.min(readIn(c), c.words);
    // Read through (the C13/C28 rule: 90% of its words) counts as nothing left.
    return c.words > 0 && r >= c.words * FINISH_SHARE ? 0 : Math.max(0, c.words - r);
  };
  let wordsLeft = left(ch);
  // Read through and there's a next chapter → point at the next one instead.
  const next = list.find((c) => c.position > ch.position);
  if (wordsLeft === 0 && next) {
    ch = next;
    wordsLeft = left(ch);
  }
  const minutesLeft = minutesFor(wordsLeft, wpm);
  const atBookmark = !!mark && mark.position === ch.position;
  return {
    slug: loan.slug, title: loan.title, chapterPosition: ch.position, chapterTitle: ch.title,
    wordsLeft, minutesLeft,
    left: wordsLeft === 0 ? "this chapter is read through" : `about ${formatDuration(minutesLeft)} left in this chapter`,
    lastRead: session.endedAt,
    // Opening the reading room without a chapter resumes at the bookmark.
    href: atBookmark ? `/works/${loan.slug}/read` : `/works/${loan.slug}/read?ch=${ch.position}`,
  };
}

/** "Chapter 2: The title" — or the title alone when it already says "Chapter …". */
export function chapterLabel(card: Pick<ContinueCard, "chapterPosition" | "chapterTitle">): string {
  return /^chapter\b/i.test(card.chapterTitle) ? card.chapterTitle : `Chapter ${card.chapterPosition}: ${card.chapterTitle}`;
}
