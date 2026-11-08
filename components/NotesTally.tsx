"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getWorks } from "@/lib/catalogue";
import { namedBookLinks, notesAcrossLine, totalAnnotations, type AnnotationTotals } from "@/lib/notesCount";

/**
 * C179: "3 margin notes · 2 highlights across 2 books" above the ledger's export (own annotations only).
 * Library mode passes the totals; preview mode counts what this browser holds. Nothing when there are none.
 * C203: with `link` (the card page) it adds "· see them in the ledger" → /ledger#export.
 * C206: with `name` (the ledger) two or three books are named by title instead of counted.
 */
export function NotesTally({ totals, link = false, name = false }: { totals: AnnotationTotals | null; link?: boolean; name?: boolean }) {
  const [local, setLocal] = useState<AnnotationTotals | null>(null);
  useEffect(() => {
    if (totals) return;
    const read = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
    const byWork: Record<string, (string | null)[]> = {};
    const titles: Record<string, string> = {};
    for (const w of getWorks()) { byWork[w.slug] = w.chapters.map((c) => read(`soj:ann:${w.slug}:${c.position}`)); titles[w.slug] = w.title; }
    setLocal(totalAnnotations(byWork, titles));
  }, [totals]);
  const line = notesAcrossLine(totals ?? local ?? { notes: 0, highlights: 0, books: 0 }, name);
  if (!line) return null;
  if (link) {
    return (
      <p className="font-sans text-xs text-sandstone">
        You have {line} · <Link href="/ledger#export" className="text-lamplight underline underline-offset-2 hover:text-ember">see them in the ledger</Link>
      </p>
    );
  }
  // C212: on the ledger, named books link to their work pages.
  const t = totals ?? local;
  const links = name && t ? namedBookLinks(t) : null;
  if (links) {
    const head = line.slice(0, line.lastIndexOf(" across ") + " across ".length);
    return (
      <p className="mt-2 font-sans text-xs text-sandstone">
        You have {head}{links.map((b, i) => (
          <span key={b.href}>{i > 0 && (i === links.length - 1 ? " and " : ", ")}<Link href={b.href} className="text-lamplight underline underline-offset-2 hover:text-ember">{b.title}</Link></span>
        ))}.
      </p>
    );
  }
  return <p className="mt-2 font-sans text-xs text-sandstone">You have {line}.</p>;
}
