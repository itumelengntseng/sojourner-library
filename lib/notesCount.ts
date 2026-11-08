// "Your notes in this book" on the work page (C43): counts only — the text stays in the ledger export.
export interface AnnotationCount { notes: number; highlights: number }

/** Counts preview-mode annotations from the per-chapter localStorage values (damaged entries skipped). */
export function countAnnotations(raws: (string | null)[]): AnnotationCount {
  let notes = 0;
  let highlights = 0;
  for (const raw of raws) {
    if (!raw) continue;
    try {
      const v = JSON.parse(raw) as { notes?: unknown; highlights?: unknown };
      if (Array.isArray(v.notes)) notes += v.notes.length;
      if (Array.isArray(v.highlights)) highlights += v.highlights.length;
    } catch { /* skip damaged */ }
  }
  return { notes, highlights };
}

/** "2 notes and 1 highlight" — or null when there are none. */
export function annotationLine(c: AnnotationCount): string | null {
  const parts = [
    c.notes ? `${c.notes} margin note${c.notes === 1 ? "" : "s"}` : "",
    c.highlights ? `${c.highlights} highlight${c.highlights === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" and ") : null;
}

export interface AnnotationTotals extends AnnotationCount { books: number }

/** C179: the ledger's "3 margin notes · 2 highlights across 2 books" — or null when there are none. */
export function notesAcrossLine(t: AnnotationTotals): string | null {
  const parts = [
    t.notes ? `${t.notes} margin note${t.notes === 1 ? "" : "s"}` : "",
    t.highlights ? `${t.highlights} highlight${t.highlights === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  if (!parts.length) return null;
  return `${parts.join(" · ")} across ${t.books} book${t.books === 1 ? "" : "s"}`;
}

/** C179: totals over several works from per-chapter preview values (slug → raw values per chapter). */
export function totalAnnotations(byWork: Record<string, (string | null)[]>): AnnotationTotals {
  const out: AnnotationTotals = { notes: 0, highlights: 0, books: 0 };
  for (const raws of Object.values(byWork)) {
    const c = countAnnotations(raws);
    out.notes += c.notes;
    out.highlights += c.highlights;
    if (c.notes + c.highlights > 0) out.books += 1;
  }
  return out;
}

/** C183: this book's own notes and highlights as this browser holds them (preview mode). */
export function previewBookCount(slug: string, positions: number[], read: (k: string) => string | null): AnnotationCount {
  return countAnnotations(positions.map((p) => read(`soj:ann:${slug}:${p}`)));
}

/** C186: the short form beside a book's time in Hours per book — "· 2 notes · 1 highlight"; null when none. */
export function shortNotesLine(c: AnnotationCount | undefined): string | null {
  if (!c) return null;
  const parts = [c.notes ? `${c.notes} note${c.notes === 1 ? "" : "s"}` : "", c.highlights ? `${c.highlights} highlight${c.highlights === 1 ? "" : "s"}` : ""].filter(Boolean);
  return parts.length ? parts.map((p) => ` · ${p}`).join("") : null;
}

/** C187: the reading room's status after a margin note is saved — "Note saved · 3 in this book". */
export function noteSavedStatus(notesInBook: number | undefined): string {
  return notesInBook && notesInBook > 0 ? `Note saved · ${notesInBook} in this book` : "Note saved";
}

/** C188: the reading room's status after a highlight is saved — "Highlight saved · 2 in this book". */
export function highlightSavedStatus(highlightsInBook: number | undefined): string {
  return highlightsInBook && highlightsInBook > 0 ? `Highlight saved · ${highlightsInBook} in this book` : "Highlight saved";
}

/**
 * C190: the reading room's live count in library mode — the server's count for the whole book at page load,
 * with this chapter's notes and highlights as they stand now (so one added or removed a moment ago is counted).
 */
export function liveBookCount(server: AnnotationCount, loaded: AnnotationCount, current: AnnotationCount): AnnotationCount {
  return {
    notes: Math.max(0, server.notes - loaded.notes + current.notes),
    highlights: Math.max(0, server.highlights - loaded.highlights + current.highlights),
  };
}

/** C191: the reading room's status after a note or highlight is removed — "Note removed · 2 left in this book". */
export function removedStatus(kind: "note" | "highlight", leftInBook: number | undefined): string {
  const head = kind === "note" ? "Note removed" : "Highlight removed";
  if (leftInBook === undefined) return head;
  return leftInBook > 0 ? `${head} · ${leftInBook} left in this book` : `${head} · none left in this book`;
}

/** C197: own notes and highlights per chapter (position → counts) from rows that name their chapter. */
export function countByChapter(notes: { chapter_id: string }[], highlights: { chapter_id: string }[], positions: Record<string, number>): Record<number, AnnotationCount> {
  const out: Record<number, AnnotationCount> = {};
  for (const r of notes) { const p = positions[r.chapter_id]; if (p !== undefined) (out[p] ??= { notes: 0, highlights: 0 }).notes += 1; }
  for (const r of highlights) { const p = positions[r.chapter_id]; if (p !== undefined) (out[p] ??= { notes: 0, highlights: 0 }).highlights += 1; }
  return out;
}

/** C197: this browser's notes and highlights per chapter of a book (preview mode). */
export function previewByChapter(slug: string, positions: number[], read: (k: string) => string | null): Record<number, AnnotationCount> {
  const out: Record<number, AnnotationCount> = {};
  for (const p of positions) {
    const c = countAnnotations([read(`soj:ann:${slug}:${p}`)]);
    if (c.notes + c.highlights > 0) out[p] = c;
  }
  return out;
}

/** C202: the reading room Contents line's " · notes in 3 chapters" — only once notes sit in more than one chapter. */
export function notesInChaptersLine(chaptersWithNotes: number): string | null {
  return chaptersWithNotes > 1 ? ` · notes in ${chaptersWithNotes} chapters` : null;
}

/** C204: the end card's "You made 3 margin notes and 1 highlight in this book." — null when none. */
export function madeLine(c: AnnotationCount | undefined): string | null {
  const line = c ? annotationLine(c) : null;
  return line ? `You made ${line} in this book.` : null;
}

/** C204: the book's own counts as the Contents drawer holds them (chapter by chapter). */
export function sumCounts(counts: (AnnotationCount | undefined)[]): AnnotationCount {
  return counts.reduce<AnnotationCount>((a, c) => ({ notes: a.notes + (c?.notes ?? 0), highlights: a.highlights + (c?.highlights ?? 0) }), { notes: 0, highlights: 0 });
}
