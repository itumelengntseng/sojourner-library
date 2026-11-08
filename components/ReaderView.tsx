"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { actionForKey, shortcutsFor, type ReaderKeyAction } from "@/lib/readerKeys";
import { bookmarkAction, highlightAction, noteAction, removeAction } from "@/app/works/[slug]/read/actions";
import {
  bookmarkOffset, cleanNote, DEFAULT_SETTINGS, FONT_MAX, FONT_MIN, HIGHLIGHT_CLASSES, HIGHLIGHT_COLOURS,
  normaliseSelection, notesByParagraph, paragraphAtWord, parseSettings, segmentParagraph, splitParagraphs,
  FOCUS_RING, THEME_CLASSES, type Highlight, type HighlightColour, type MarginNote, type ReaderSettings,
} from "@/lib/reader";
import type { ReadingData } from "@/lib/readingRoom";
import { formatDuration, minutesFor } from "@/lib/engine/readingTime";
import { useSessionTracker } from "./useSessionTracker";
import { AskLibrarian } from "./AskLibrarian";
import { highlightSavedStatus, liveBookCount, noteSavedStatus, previewBookCount, removedStatus } from "@/lib/notesCount";
import { librarianFacts } from "@/lib/librarian";
import { wordsBeforeChapter } from "@/lib/reader";
import { outsideCanonNote } from "@/lib/canon";
import { EndOfChapter } from "./EndOfChapter";
import { ChapterProgress } from "./ChapterProgress";
import { DueWithinHour } from "./DueWithinHour";
import { JustBorrowedLine } from "./JustBorrowedLine";
import { stampDate } from "@/lib/loanDesk";

const SETTINGS_KEY = "soj:reader-settings";
const annKey = (slug: string, pos: number) => `soj:ann:${slug}:${pos}`;

function readLocal(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeLocal(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* private mode: keep in memory */ }
}

const btn = "rounded px-2.5 py-1.5 font-sans text-xs uppercase tracking-wider";

export function ReaderView({ slug, data, wpm, minutesPerDay, readPositions = [], finishedAt, firstRead, readMs, bookAnnotations }: { slug: string; data: ReadingData; wpm: number; minutesPerDay: number; readPositions?: number[]; finishedAt?: number; firstRead?: number; readMs?: number; bookAnnotations?: { notes: number; highlights: number } | null }) {
  const { chapter, chapters } = data;
  const paras = useMemo(() => splitParagraphs(chapter.body), [chapter.body]);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [notes, setNotes] = useState<MarginNote[]>(data.notes);
  const [highlights, setHighlights] = useState<Highlight[]>(data.highlights);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [drafting, setDrafting] = useState<{ anchor: number; text: string } | null>(null);
  const [status, setStatus] = useState("");
  const textRef = useRef<HTMLDivElement>(null);
  const preview = data.mode === "preview";
  const proof = data.mode === "proof";
  const base = proof ? `/works/${slug}/proof` : `/works/${slug}/read`;
  const behind = useSessionTracker({ slug, position: chapter.position, paras, textRef, record: !proof });
  const chapterWords = chapters.find((c) => c.position === chapter.position)?.words ?? 0;
  const left = minutesFor(Math.max(0, chapterWords - behind), wpm);
  // C57: what's left of the whole book — the rest of this chapter plus every chapter after it.
  const bookLeft = minutesFor(Math.max(0, chapterWords - behind) + chapters.filter((c) => c.position > chapter.position).reduce((a, c) => a + c.words, 0), wpm);

  // Settings and (in preview) annotations live in this browser.
  useEffect(() => {
    setSettings(parseSettings(readLocal(SETTINGS_KEY)));
    if (preview && !proof) {
      try {
        const saved = JSON.parse(readLocal(annKey(slug, chapter.position)) ?? "{}") as { notes?: MarginNote[]; highlights?: Highlight[] };
        if (Array.isArray(saved.notes)) setNotes(saved.notes);
        if (Array.isArray(saved.highlights)) setHighlights(saved.highlights);
      } catch { /* ignore a damaged entry */ }
    }
  }, [preview, proof, slug, chapter.position]);

  const updateSettings = (patch: Partial<ReaderSettings>) =>
    setSettings((s) => {
      const next = parseSettings(JSON.stringify({ ...s, ...patch }));
      writeLocal(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });

  // C190: library mode's live count for this book (the server's count, with this chapter as it stands now).
  const liveCount = (n: MarginNote[], h: Highlight[]) => bookAnnotations
    ? liveBookCount(bookAnnotations, { notes: data.notes.length, highlights: data.highlights.length }, { notes: n.length, highlights: h.length })
    : undefined;
  const persistPreview = (n: MarginNote[], h: Highlight[]) => {
    if (preview) writeLocal(annKey(slug, chapter.position), JSON.stringify({ notes: n, highlights: h }));
  };

  // Resume at the bookmark when it falls in this chapter (and C52: "Go to your bookmark" in Contents).
  const showBookmark = useCallback(() => {
    if (!data.bookmark || data.bookmark.position !== chapter.position) return;
    const idx = paragraphAtWord(paras, data.bookmark.wordsIntoChapter);
    const box = textRef.current;
    const target = box?.querySelector<HTMLElement>(`[data-para="${idx}"]`);
    if (!box || !target) return;
    if (settings.layout === "paged") {
      // Turn to the page holding the paragraph without scrolling the window sideways.
      const w = box.clientWidth;
      box.scrollLeft = Math.floor(target.offsetLeft / w) * w;
    } else {
      target.scrollIntoView({ block: "start" });
    }
  }, [data.bookmark, chapter.position, paras, settings.layout]);
  useEffect(() => { showBookmark(); }, [showBookmark]);

  /** First paragraph whose top edge is on screen (or page, when paged). */
  const currentParagraph = useCallback(() => {
    const box = textRef.current?.getBoundingClientRect();
    const els = Array.from(textRef.current?.querySelectorAll<HTMLElement>("[data-para]") ?? []);
    const hit = els.find((el) => {
      const r = el.getBoundingClientRect();
      return settings.layout === "paged" ? r.left >= (box?.left ?? 0) - 2 && r.right > 0 : r.bottom > 80;
    });
    return paras[Number(hit?.dataset.para ?? 0)] ?? paras[0];
  }, [paras, settings.layout]);

  const placeBookmark = async () => {
    const p = currentParagraph();
    if (!p) return;
    const ok = await bookmarkAction(slug, chapter.position, bookmarkOffset(chapters, chapter.position, p));
    setStatus(ok ? "Bookmark placed." : "Couldn't place the bookmark — is the loan still open?");
  };

  // Turn a DOM selection into chapter character offsets.
  useEffect(() => {
    const onSelect = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !textRef.current) return setSelection(null);
      const at = (node: Node | null, off: number) => {
        const el = (node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element | null))?.closest<HTMLElement>("[data-start]");
        return el && textRef.current?.contains(el) ? Number(el.dataset.start) + (node?.nodeType === Node.TEXT_NODE ? off : 0) : null;
      };
      const a = at(sel.anchorNode, sel.anchorOffset);
      const b = at(sel.focusNode, sel.focusOffset);
      setSelection(a === null || b === null ? null : normaliseSelection(chapter.body, a, b));
    };
    document.addEventListener("selectionchange", onSelect);
    return () => document.removeEventListener("selectionchange", onSelect);
  }, [chapter.body]);

  const highlight = async (colour: HighlightColour) => {
    if (!selection) return;
    const h = preview
      ? { id: crypto.randomUUID(), ...selection, colour }
      : await highlightAction(slug, chapter.position, selection.start, selection.end, colour);
    if (!h) return setStatus("Couldn't save that highlight.");
    const next = [...highlights, h];
    setHighlights(next);
    persistPreview(notes, next);
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    // C188: say so, with the book's own highlight count (as C187 does for notes).
    const inBook = preview
      ? previewBookCount(slug, chapters.map((c) => c.position), readLocal).highlights
      : liveCount(notes, next)?.highlights;
    setStatus(highlightSavedStatus(inBook));
  };

  const removeHighlight = async (id: string) => {
    if (!preview && !(await removeAction("highlights", id))) return setStatus("Couldn't remove that highlight.");
    const next = highlights.filter((h) => h.id !== id);
    setHighlights(next);
    persistPreview(notes, next);
    // C191: say so, with what's left in the book.
    setStatus(removedStatus("highlight", preview ? previewBookCount(slug, chapters.map((c) => c.position), readLocal).highlights : liveCount(notes, next)?.highlights));
  };

  const startNote = () => {
    const at = selection?.start ?? currentParagraph()?.start ?? 0;
    const p = paras.find((x) => at >= x.start && at < x.end) ?? paras[0];
    setDrafting({ anchor: p?.start ?? 0, text: "" });
  };

  const saveNote = async () => {
    if (!drafting) return;
    const body = cleanNote(drafting.text);
    if (!body) return setStatus("A note needs a few words (up to 10 000 characters).");
    const n = preview
      ? { id: crypto.randomUUID(), anchor: drafting.anchor, body, createdAt: Date.now() }
      : await noteAction(slug, chapter.position, drafting.anchor, body);
    if (!n) return setStatus("Couldn't save that note.");
    const next = [...notes, n];
    setNotes(next);
    persistPreview(next, highlights);
    setDrafting(null);
    // C187: say so, with the book's own note count (this browser's in preview; the server's count plus this chapter's in library mode).
    const inBook = preview
      ? previewBookCount(slug, chapters.map((c) => c.position), readLocal).notes
      : liveCount(next, highlights)?.notes;
    setStatus(noteSavedStatus(inBook));
  };

  const removeNote = async (id: string) => {
    if (!preview && !(await removeAction("notes", id))) return setStatus("Couldn't remove that note.");
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    persistPreview(next, highlights);
    // C191: say so, with what's left in the book.
    setStatus(removedStatus("note", preview ? previewBookCount(slug, chapters.map((c) => c.position), readLocal).notes : liveCount(next, highlights)?.notes));
  };

  const turnPage = useCallback((dir: 1 | -1) => {
    const el = textRef.current;
    if (el && settings.layout === "paged") el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  }, [settings.layout]);

  const contentsRef = useRef<HTMLDetailsElement>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const keyActions = useRef<(a: ReaderKeyAction) => void>(() => {});
  keyActions.current = (a) => {
    if (a === "prevPage") turnPage(-1);
    else if (a === "nextPage") turnPage(1);
    else if (a === "contents" && contentsRef.current) contentsRef.current.open = !contentsRef.current.open;
    else if (a === "layout") updateSettings({ layout: settings.layout === "paged" ? "scroll" : "paged" });
    else if (a === "larger" && settings.fontSize < FONT_MAX) updateSettings({ fontSize: settings.fontSize + 1 });
    else if (a === "smaller" && settings.fontSize > FONT_MIN) updateSettings({ fontSize: settings.fontSize - 1 });
    else if (a === "bookmark") void placeBookmark();
    else if (a === "note") startNote();
    else if (a === "help" && helpRef.current && !helpRef.current.open) helpRef.current.showModal();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && contentsRef.current?.open) { contentsRef.current.open = false; return; }
      if ((e.target as HTMLElement)?.closest("textarea, input, select, [contenteditable], dialog")) return;
      const a = actionForKey(e, proof);
      if (!a) return;
      e.preventDefault();
      keyActions.current(a);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [proof]);

  const byPara = notesByParagraph(paras, notes);
  const idx = chapters.findIndex((c) => c.position === chapter.position);
  const prev = chapters[idx - 1];
  const next = chapters[idx + 1];
  const paged = settings.layout === "paged";
  const themeBtn = (t: ReaderSettings["theme"], label: string) => (
    <button type="button" onClick={() => updateSettings({ theme: t })} aria-pressed={settings.theme === t}
      className={`${btn} ${settings.theme === t ? "bg-lamplight text-ink" : "text-sandstone hover:text-lamplight"}`}>{label}</button>
  );

  return (
    <div className={`min-h-dvh overflow-x-clip ${THEME_CLASSES[settings.theme]}`}>
      <header className="sticky top-0 z-20 border-b border-timber-dark/60 bg-stone-wall/95 px-3 py-2 text-paper backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2">
          <a href="#chapter-text" className="sr-only rounded bg-ink px-2 py-1 font-sans text-xs text-lamplight focus:not-sr-only">Skip to the text</a>
          <Link href={`/works/${slug}`} className="font-sans text-xs text-sandstone hover:text-lamplight">← {data.title}</Link>
          <details ref={contentsRef} className="font-sans text-xs">
            <summary className={`${btn} cursor-pointer list-none border border-sandstone/40 text-paper`}>Contents</summary>
            <nav aria-label="Contents" className="absolute inset-x-3 top-full z-30 mt-1 max-h-[60dvh] overflow-auto sm:inset-x-auto sm:w-80 rounded-sm border border-timber-dark bg-stone-wall p-2 shadow-lg">
              {!proof && <p className="mb-1 px-2 py-1 text-sandstone">{bookLeft > 0 ? `About ${formatDuration(bookLeft)} left in this book` : "You're at the end of this book"}</p>}
              {/* C112: the loan's due stamp, under the time left in the book. */}
              {!proof && data.dueAt > 0 && <p className="-mt-1 mb-1 px-2 pb-1 font-mono text-[0.7rem] uppercase tracking-wider text-sandstone">Due back {stampDate(data.dueAt)}</p>}
              {!proof && data.bookmark && (
                data.bookmark.position === chapter.position ? (
                  <button type="button" onClick={() => { if (contentsRef.current) contentsRef.current.open = false; showBookmark(); }}
                    className="mb-1 block w-full rounded border border-lamplight/40 px-2 py-1.5 text-left text-lamplight hover:bg-timber/40">
                    Go to your bookmark <span className="text-sandstone">· this chapter</span>
                  </button>
                ) : (
                  <Link href={base} className="mb-1 block rounded border border-lamplight/40 px-2 py-1.5 text-lamplight hover:bg-timber/40">
                    Go to your bookmark <span className="text-sandstone">· {chapters.find((c) => c.position === data.bookmark!.position)?.title ?? `chapter ${data.bookmark.position}`}</span>
                  </Link>
                )
              )}
              <ol>
                {chapters.map((c) => {
                  const here = c.position === chapter.position;
                  const marked = data.bookmark?.position === c.position;
                  return (
                    <li key={c.position}>
                      <Link href={`${base}?ch=${c.position}`} aria-current={here ? "page" : undefined}
                        className={`flex items-baseline justify-between gap-3 rounded px-2 py-1.5 ${here ? "bg-timber/60 text-lamplight" : "text-paper hover:text-lamplight"}`}>
                        <span>{c.title}{readPositions.includes(c.position) && <span className="ml-1.5 text-sandstone" title="Read through"><span aria-hidden="true">✓</span><span className="sr-only">, read</span></span>}{marked && <span className="ml-1.5 text-lamplight" title="Your bookmark">· bookmark</span>}</span>
                        <span className="shrink-0 text-sandstone">{formatDuration(minutesFor(c.words, wpm))}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </details>
          <div role="group" aria-label="Page colour" className="flex gap-0.5">{themeBtn("dark", "Dark")}{themeBtn("sepia", "Sepia")}{themeBtn("light", "Light")}</div>
          <button type="button" className={`${btn} border border-sandstone/40 text-paper`} aria-pressed={paged}
            onClick={() => updateSettings({ layout: paged ? "scroll" : "paged" })}>{paged ? "Paged" : "Scroll"}</button>
          <div role="group" aria-label="Text size" className="flex items-center gap-0.5">
            <button type="button" className={`${btn} text-paper`} aria-label="Smaller text" disabled={settings.fontSize <= FONT_MIN}
              onClick={() => updateSettings({ fontSize: settings.fontSize - 1 })}>A−</button>
            <button type="button" className={`${btn} text-paper`} aria-label="Larger text" disabled={settings.fontSize >= FONT_MAX}
              onClick={() => updateSettings({ fontSize: settings.fontSize + 1 })}>A+</button>
          </div>
          {!proof && <button type="button" onClick={placeBookmark} className={`${btn} bg-timber text-paper hover:bg-ochre`}>Bookmark here</button>}
          {!proof && <button type="button" onClick={startNote} className={`${btn} border border-sandstone/40 text-paper`}>Note</button>}
          <button type="button" aria-haspopup="dialog" onClick={() => helpRef.current?.showModal()} className={`${btn} text-sandstone hover:text-lamplight`}>Keys <span aria-hidden="true">?</span></button>
        </div>
        <dialog ref={helpRef} aria-labelledby="keys-title" className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-sm border border-timber-dark bg-stone-wall p-5 font-sans text-sm text-paper shadow-xl backdrop:bg-ink/70">
          <h2 id="keys-title" className="font-serif text-lg text-lamplight">Keys in the reading room</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            {shortcutsFor(proof).map((s) => (
              <Fragment key={s.label}>
                <dt className="flex gap-1">{s.keys.map((k) => <kbd key={k} className="rounded-sm border border-sandstone/50 px-1.5 text-xs text-lamplight">{k}</kbd>)}</dt>
                <dd className="text-paper/90">{s.label}</dd>
              </Fragment>
            ))}
          </dl>
          <form method="dialog" className="mt-4 text-right"><button className="rounded-sm border border-lamplight/60 px-3 py-1 text-xs text-lamplight hover:bg-lamplight/10">Close</button></form>
        </dialog>
        <p role="status" aria-live="polite" className="mx-auto max-w-5xl font-sans text-[0.7rem] text-lamplight empty:hidden">{status}</p>
      </header>

      <main id="main" data-ring="" style={{ ["--ring" as string]: FOCUS_RING[settings.theme] }} className="mx-auto max-w-3xl px-5 pb-24 pt-8">
        {!proof && <DueWithinHour slug={slug} dueAt={data.dueAt} renewalsLeft={data.renewalsLeft} />}
        {/* C147: a fresh loan, not yet bookmarked — when it was taken out and when it's due. */}
        {!proof && <JustBorrowedLine borrowedAt={data.borrowedAt} dueAt={data.dueAt} hasBookmark={!!data.bookmark} />}
        <p className="font-sans text-xs uppercase tracking-[0.25em] opacity-80">{data.author}</p>
        <h1 className="mt-1 text-2xl">{chapter.title}</h1>
        <p className="mt-1 font-sans text-xs opacity-80">
          {left > 0 ? `About ${formatDuration(left)} left in this chapter` : "End of the chapter"} · at {wpm} wpm
        </p>
        {!proof && <ChapterProgress wordsBehind={behind} chapterWords={chapterWords} />}
        {outsideCanonNote(data.canonStatus) && <p className="mt-2 font-sans text-xs font-semibold">{outsideCanonNote(data.canonStatus)}</p>}
        {proof && <p className="mt-2 rounded-sm border border-current/40 px-2 py-1 font-sans text-[0.7rem]">Proof copy — only the Keeper sees this. No loan, bookmark, notes or reading time are recorded.</p>}
        {preview && !proof && <p className="mt-2 font-sans text-[0.7rem] opacity-80">Placeholder text · notes and highlights are kept in this browser until the library is connected.</p>}

        <div
          ref={textRef}
          id="chapter-text"
          tabIndex={0}
          aria-label="Chapter text"
          style={{
            fontSize: settings.fontSize,
            ...(paged ? { columnWidth: "100vw", columnGap: 0, height: "calc(100dvh - 12rem)", overflow: "hidden" } : {}),
          }}
          className={`relative mt-6 scroll-mt-32 leading-relaxed ${paged ? "[column-fill:auto]" : ""}`}
        >
          {paras.map((p) => (
            <div key={p.index} data-para={p.index} className="mb-5 scroll-mt-32 pr-1 sm:relative">
              <p>
                {segmentParagraph(p, highlights).map((s) =>
                  s.highlight ? (
                    <mark key={s.start} data-start={s.start} className={`rounded-sm text-inherit ${HIGHLIGHT_CLASSES[s.highlight.colour]}`}>
                      {s.text}
                      <button type="button" onClick={() => removeHighlight(s.highlight!.id)} className="sr-only focus:not-sr-only focus:ml-1 focus:font-sans focus:text-xs">
                        Remove highlight
                      </button>
                    </mark>
                  ) : (
                    <span key={s.start} data-start={s.start}>{s.text}</span>
                  ),
                )}
              </p>
              {(byPara.get(p.index) ?? []).map((n) => (
                <aside key={n.id} aria-label="Margin note"
                  className="mt-2 border-l-2 border-ochre/70 pl-3 font-sans text-sm italic opacity-90 lg:absolute lg:left-full lg:top-0 lg:ml-6 lg:mt-0 lg:w-56">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <button type="button" onClick={() => removeNote(n.id)} className="mt-1 text-[0.7rem] not-italic underline">Remove note</button>
                </aside>
              ))}
              {drafting?.anchor === p.start && (
                <div className="mt-2 flex flex-col gap-2 font-sans text-sm">
                  <label htmlFor="note-draft" className="text-xs uppercase tracking-wider opacity-80">Note in the margin</label>
                  <textarea id="note-draft" autoFocus rows={3} maxLength={10_000} value={drafting.text}
                    onChange={(e) => setDrafting({ ...drafting, text: e.target.value })}
                    className="rounded border border-sandstone/50 bg-transparent p-2" />
                  <div className="flex gap-2">
                    <button type="button" onClick={saveNote} className="rounded bg-lamplight px-3 py-1 text-ink">Save note</button>
                    <button type="button" onClick={() => setDrafting(null)} className="rounded px-3 py-1 underline">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {paged && (
          <div className="mt-4 flex justify-between font-sans text-sm">
            <button type="button" onClick={() => turnPage(-1)} className="underline-offset-4 hover:underline">← Previous page</button>
            <button type="button" onClick={() => turnPage(1)} className="underline-offset-4 hover:underline">Next page →</button>
          </div>
        )}

        <EndOfChapter slug={slug} title={data.title} chapters={chapters} position={chapter.position} wpm={wpm} base={base} proof={proof} loanId={data.loanId} noRenewals={data.renewalsLeft === 0} finishedAt={finishedAt} firstRead={firstRead} readMs={readMs} />

        <div className="mt-10 rounded-sm bg-stone-wall text-paper">
          <AskLibrarian
            title={data.title}
            // C183: own notes in this book — this browser's (preview), or the server's count with this chapter's live changes (library); none in the proof copy.
            annotations={proof ? undefined : preview ? { slug, positions: chapters.map((c) => c.position) }
              : bookAnnotations ? () => liveCount(notes, highlights) : undefined}
            facts={librarianFacts({ chapters, bookmarkOffset: wordsBeforeChapter(chapters, chapter.position) + behind, wpm, usualMinutesPerDay: minutesPerDay, ...(proof ? {} : { readMs: readMs ?? 0 }) })}
          />
        </div>

        <nav aria-label="Chapters" className="mt-10 flex justify-between gap-4 border-t border-current/20 pt-4 font-sans text-sm">
          {prev ? <Link href={`${base}?ch=${prev.position}`}>← {prev.title}</Link> : <span />}
          {next ? <Link href={`${base}?ch=${next.position}`}>{next.title} →</Link> : <Link href={`/works/${slug}`}>Back to the desk</Link>}
        </nav>
      </main>

      {selection && !proof && (
        <div role="toolbar" aria-label="Selection" className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-fit items-center gap-2 rounded-full border border-timber-dark bg-stone-wall px-3 py-2 font-sans text-xs text-paper shadow-lg">
          <span className="opacity-80">Highlight</span>
          {HIGHLIGHT_COLOURS.map((c) => (
            <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => highlight(c)} aria-label={`Highlight in ${c}`}
              className={`h-6 w-6 rounded-full border border-paper/40 ${HIGHLIGHT_CLASSES[c]}`} />
          ))}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={startNote} className="ml-1 underline">Add note</button>
        </div>
      )}
    </div>
  );
}
