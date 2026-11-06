// Builds what the librarian needs to answer questions about one book.
import type { ReaderContext } from "./engine/ask";
import { locateBookmark, type ChapterLengths } from "./reader";

export interface LibrarianFacts {
  wpm: number;
  totalWords: number;
  wordsRead: number;
  chapterWordsRemaining: number;
  chapterPosition: number;
  usualMinutesPerDay: number;
}

export function librarianFacts(a: {
  chapters: ChapterLengths[];
  bookmarkOffset: number;
  wpm: number;
  usualMinutesPerDay: number;
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
  };
}

export function toReaderContext(f: LibrarianFacts, now: Date): ReaderContext {
  return {
    wpm: f.wpm, totalWords: f.totalWords, wordsRead: f.wordsRead,
    chapterWordsRemaining: f.chapterWordsRemaining, usualMinutesPerDay: f.usualMinutesPerDay, now,
  };
}

export const SUGGESTED_QUESTIONS = [
  "How long to finish?",
  "Can I finish by Friday?",
  "How much a day to finish in 2 weeks?",
  "Time left in this chapter?",
];
