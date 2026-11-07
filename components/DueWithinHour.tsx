"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dueClock, dueWithinHour } from "@/lib/dueNotice";

/**
 * C102: one quiet line under the reading-room toolbar when the loan is due back within the hour —
 * "Due back at 14:00 · renew at the desk". Checked after mount (no server/client clock mismatch)
 * and again every minute, so it appears as the hour begins and goes once the loan runs out.
 * Never rendered in the proof copy (the caller leaves it out; the Keeper has no loan there).
 */
export function DueWithinHour({ slug, dueAt }: { slug: string; dueAt: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (now === null || !dueAt || !dueWithinHour(dueAt, now)) return null;
  return (
    <p className="mb-4 font-sans text-xs opacity-90">
      Due back at {dueClock(dueAt)} ·{" "}
      <Link href={`/works/${slug}#desk`} className="underline underline-offset-2">renew at the desk</Link>
    </p>
  );
}
