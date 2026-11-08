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

export interface AnnotationTotals extends AnnotationCount {
  books: number;
  /** C206: the titles of the books holding own notes, in shelf order (optional; only used when they match `books`). */
  titles?: string[];
  /** C212: the slugs of those books, in the same order (for links). */
  slugs?: string[];
}

/** C206: "Placeholder Work One and Placeholder Work Two" / "A, B and C" — null unless 2–3 titles that match the count. */
export function bookNames(t: AnnotationTotals): string | null {
  const ts = t.titles;
  if (!ts || ts.length !== t.books || ts.length < 2 || ts.length > 3) return null;
  return ts.length === 2 ? `${ts[0]} and ${ts[1]}` : `${ts[0]}, ${ts[1]} and ${ts[2]}`;
}

/**
 * C179: the ledger's "3 margin notes · 2 highlights across 2 books" — or null when there are none.
 * C206: with `name`, two or three books are named instead ("across Placeholder Work One and Placeholder Work Two").
 */
export function notesAcrossLine(t: AnnotationTotals, name = false): string | null {
  const parts = [
    t.notes ? `${t.notes} margin note${t.notes === 1 ? "" : "s"}` : "",
    t.highlights ? `${t.highlights} highlight${t.highlights === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  if (!parts.length) return null;
  const names = name ? bookNames(t) : null;
  return `${parts.join(" · ")} across ${names ?? `${t.books} book${t.books === 1 ? "" : "s"}`}`;
}

/** C179: totals over several works from per-chapter preview values (slug → raw values per chapter). */
export function totalAnnotations(byWork: Record<string, (string | null)[]>, titles?: Record<string, string>): AnnotationTotals {
  const out: AnnotationTotals = { notes: 0, highlights: 0, books: 0 };
  const named: string[] = [];
  const slugs: string[] = [];
  for (const [slug, raws] of Object.entries(byWork)) {
    const c = countAnnotations(raws);
    out.notes += c.notes;
    out.highlights += c.highlights;
    if (c.notes + c.highlights > 0) { out.books += 1; if (titles?.[slug]) { named.push(titles[slug]); slugs.push(slug); } }
  }
  // C206: titles in the order the works were given (shelf order), only when given; C212: with their slugs.
  if (titles) { out.titles = named; out.slugs = slugs; }
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

/** C206: library-mode titles in shelf order (series, series order, title) from the works rows the reader can see. */
export function annotatedTitles(rows: { title: string; series?: string | null; series_order?: number | null }[]): string[] {
  return annotatedBooks(rows.map((r) => ({ ...r, slug: "" }))).map((b) => b.title);
}

/** C212: the same rows as { title, slug } in shelf order, so the ledger can link each named book. */
export function annotatedBooks(rows: { title: string; slug: string; series?: string | null; series_order?: number | null }[]): { title: string; slug: string }[] {
  return [...rows]
    .sort((a, b) => (a.series ?? "").localeCompare(b.series ?? "") || (a.series_order ?? 0) - (b.series_order ?? 0) || a.title.localeCompare(b.title))
    .map((r) => ({ title: r.title, slug: r.slug }));
}

/** C212: the named books as links (title + href) when `bookNames` would name them; null otherwise. */
export function namedBookLinks(t: AnnotationTotals): { title: string; href: string }[] | null {
  if (!bookNames(t) || !t.titles || !t.slugs || t.slugs.length !== t.titles.length) return null;
  return t.titles.map((title, i) => ({ title, href: `/works/${t.slugs![i]}` }));
}

/**
 * C207: the reading room's quiet line when this chapter holds none of the reader's notes but others do —
 * "No notes in this chapter yet · 2 elsewhere in this book" (notes and highlights together); null otherwise.
 */
export function elsewhereLine(here: AnnotationCount | undefined, others: (AnnotationCount | undefined)[]): string | null {
  if (here && here.notes + here.highlights > 0) return null;
  const n = others.reduce((a, c) => a + (c ? c.notes + c.highlights : 0), 0);
  return n > 0 ? `No notes in this chapter yet · ${n} elsewhere in this book` : null;
}
