// Builds what the librarian needs to answer questions about one book.
import { hasNotes, hasNotesWhere, hasReadSoFar, NOTES_QUESTION, NOTES_WHERE_QUESTION, READ_SO_FAR_QUESTION, type ReaderContext } from "./engine/ask";
import { locateBookmark, type ChapterLengths } from "./reader";

export interface LibrarianFacts {
  wpm: number;
  totalWords: number;
  wordsRead: number;
  chapterWordsRemaining: number;
  chapterPosition: number;
  usualMinutesPerDay: number;
  /** C177: own reading time in this book (ms), when kept. */
  readMs?: number;
}

export function librarianFacts(a: {
  chapters: ChapterLengths[];
  bookmarkOffset: number;
  wpm: number;
  usualMinutesPerDay: number;
  readMs?: number;
}): LibrarianFacts {
  const totalWords = a.chapters.reduce((s, c) => s + c.words, 0);
  const wordsRead = Math.min(Math.max(0, a.bookmarkOffset), totalWords);
  const at = locateBookmark(a.chapters, wordsRead);
  const chapter = a.chapters.find((c) => c.position === at.position);
  return {
    wpm: a.wpm,
    totalWords,
    wordsRead,
    chapterWordsRemaining: Math.max(0, (chapter?.words ?? 0) - at.wordsIntoChapter),
    chapterPosition: at.position,
    usualMinutesPerDay: a.usualMinutesPerDay,
    ...(a.readMs !== undefined ? { readMs: a.readMs } : {}),
  };
}

export function toReaderContext(f: LibrarianFacts, now: Date): ReaderContext {
  return {
    wpm: f.wpm, totalWords: f.totalWords, wordsRead: f.wordsRead,
    chapterWordsRemaining: f.chapterWordsRemaining, usualMinutesPerDay: f.usualMinutesPerDay, now, readMs: f.readMs,
  };
}

export const SUGGESTED_QUESTIONS = [
  "How long to finish?",
  "Can I finish by Friday?",
  "How much a day to finish in 2 weeks?",
  "Time left in this chapter?",
];

/** C69: once the reader has a bookmark, the desk also offers the remaining-time question for the whole book. */
export const BOOK_LEFT_QUESTION = "How long is left in this book?";

/** C177: once the reader has time in this book, the desk offers to tell them how much. */
export { NOTES_QUESTION, NOTES_WHERE_QUESTION, READ_SO_FAR_QUESTION };

/** C185: `annotations` (own counts in this book) adds the notes question once there is one. */
/** C200: `where` (chapters holding own notes) adds "Where are my notes?" once there are two or more. */
export function suggestedQuestions(f: Pick<LibrarianFacts, "wordsRead" | "totalWords"> & { readMs?: number }, annotations?: { notes: number; highlights: number }, where?: string[]): string[] {
  const placed = f.wordsRead > 0 && f.wordsRead < f.totalWords;
  const base = placed ? [BOOK_LEFT_QUESTION, ...SUGGESTED_QUESTIONS] : [...SUGGESTED_QUESTIONS];
  return [...base, ...(hasReadSoFar(f.readMs) ? [READ_SO_FAR_QUESTION] : []), ...(hasNotes(annotations) ? [NOTES_QUESTION] : []), ...(hasNotes(annotations) && hasNotesWhere(where) ? [NOTES_WHERE_QUESTION] : [])];
}
