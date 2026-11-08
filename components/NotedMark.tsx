"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { countAnnotations } from "@/lib/notesCount";

/**
 * C198: a quiet "noted" mark on a work page chapter holding the reader's own notes or highlights.
 * `noted` from the server (library mode); `null` → counted from this browser's store after load (preview).
 * C201: with `href` (the book is on loan) the mark opens that chapter in the reading room, spoken "open your notes in <chapter>".
 */
export function NotedMark({ noted, slug, position, href, chapter }: { noted: boolean | null; slug: string; position: number; href?: string; chapter?: string }) {
  const [local, setLocal] = useState(false);
  useEffect(() => {
    if (noted !== null) return;
    let raw: string | null = null;
    try { raw = window.localStorage.getItem(`soj:ann:${slug}:${position}`); } catch { raw = null; }
    const c = countAnnotations([raw]);
    setLocal(c.notes + c.highlights > 0);
  }, [noted, slug, position]);
  if (!(noted ?? local)) return null;
  const cls = "ml-2 inline-block rounded-sm border border-sandstone/50 px-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-sandstone";
  if (href) {
    return (
      <Link href={href} className={`${cls} hover:border-lamplight hover:text-lamplight`}>
        <span aria-hidden="true">noted</span><span className="sr-only">open your notes in {chapter ?? "this chapter"}</span>
      </Link>
    );
  }
  return (
    <span className={cls}>
      <span aria-hidden="true">noted</span><span className="sr-only">you have notes here</span>
    </span>
  );
}
