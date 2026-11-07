"use client";

import { useEffect, useState } from "react";
import { dueWithinHour } from "@/lib/dueNotice";
import { justBorrowed, stampDate } from "@/lib/loanDesk";

/** C147: show the line for a loan taken out within the hour, before the first bookmark, unless C102's due line is up. */
export function showJustBorrowed(a: { borrowedAt?: number; dueAt: number; hasBookmark: boolean }, now: number): boolean {
  return !a.hasBookmark && a.dueAt > 0 && justBorrowed(a, now) && !dueWithinHour(a.dueAt, now);
}

/**
 * C147: one quiet line under the reading-room toolbar on a fresh loan — "Just borrowed · due back <stamp>".
 * Checked after mount (no server/client clock mismatch) and each minute. The caller leaves it out of the proof copy.
 */
export function JustBorrowedLine({ borrowedAt, dueAt, hasBookmark }: { borrowedAt?: number; dueAt: number; hasBookmark: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (now === null || !showJustBorrowed({ borrowedAt, dueAt, hasBookmark }, now)) return null;
  return (
    <p className="mb-4 font-sans text-xs opacity-90">
      <span aria-hidden="true">Just borrowed</span><span className="sr-only">Just borrowed, {stampDate(borrowedAt!)}</span> · due back {stampDate(dueAt)}
    </p>
  );
}
