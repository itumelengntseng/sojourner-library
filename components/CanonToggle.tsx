import Link from "next/link";
import { canonHref } from "@/lib/canon";
import type { CanonView } from "@/lib/workStats";

// Two brass switches on the hall wall: canon only, or everything on the shelves.
// The choice is remembered across the library (see lib/canon.ts).
export function CanonToggle({ view, basePath }: { view: CanonView; basePath: string }) {
  const opt = (v: CanonView, label: string) => (
    <Link
      href={canonHref(basePath, v)}
      aria-current={view === v ? "true" : undefined}
      className={`rounded-sm px-3 py-1.5 font-sans text-xs uppercase tracking-wider ${
        view === v ? "bg-lamplight text-ink" : "text-sandstone hover:text-lamplight"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Canon filter" className="inline-flex gap-1 rounded border border-sandstone/40 p-1">
      {opt("canon", "Canon only")}
      {opt("all", "Include drafts")}
    </nav>
  );
}
