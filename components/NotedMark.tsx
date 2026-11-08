"use client";
import { useEffect, useState } from "react";
import { countAnnotations } from "@/lib/notesCount";

/**
 * C198: a quiet "noted" mark on a work page chapter holding the reader's own notes or highlights.
 * `noted` from the server (library mode); `null` → counted from this browser's store after load (preview).
 */
export function NotedMark({ noted, slug, position }: { noted: boolean | null; slug: string; position: number }) {
  const [local, setLocal] = useState(false);
  useEffect(() => {
    if (noted !== null) return;
    let raw: string | null = null;
    try { raw = window.localStorage.getItem(`soj:ann:${slug}:${position}`); } catch { raw = null; }
    const c = countAnnotations([raw]);
    setLocal(c.notes + c.highlights > 0);
  }, [noted, slug, position]);
  if (!(noted ?? local)) return null;
  return (
    <span className="ml-2 inline-block rounded-sm border border-sandstone/50 px-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-sandstone">
      <span aria-hidden="true">noted</span><span className="sr-only">you have notes here</span>
    </span>
  );
}
