import Link from "next/link";
import type { Returned } from "@/lib/loanDesk";
import { finishedStamp } from "@/lib/ledger";

/**
 * The reader's last few returns at the front desk, stamped, with a way to borrow again. Nothing returned → nothing shown.
 * `finished` (slug → time, C70) marks the books the reader read to the end.
 */
export function RecentlyReturned({ items, finished = {} }: { items: Returned[]; finished?: Record<string, number> }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recently-returned" className="w-full max-w-md text-left">
      <h2 id="recently-returned" className="font-sans text-xs uppercase tracking-[0.25em] text-sandstone">Recently returned</h2>
      <ul className="mt-2 divide-y divide-timber-dark/60 rounded-sm border border-timber-dark bg-ink/40">
        {items.map((r) => (
          <li key={r.workKey} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-paper">
                {r.title}
                {finished[r.slug] !== undefined && (
                  <span className="ml-2 inline-block -rotate-2 rounded-sm border border-ochre px-1.5 py-0.5 align-middle font-mono text-[0.65rem] uppercase tracking-wider text-lamplight">
                    {finishedStamp(finished[r.slug])}
                  </span>
                )}
              </p>
              <p className="font-mono text-[0.7rem] uppercase tracking-wider text-sandstone">
                Out {r.borrowed} · {r.onTime ? "returned" : "back on the shelf when due"} {r.returned}
              </p>
            </div>
            <Link href={`/works/${r.slug}`} className="rounded border border-timber px-3 py-1.5 font-sans text-xs font-semibold text-paper hover:border-ochre hover:text-lamplight">
              Borrow again<span className="sr-only">: {r.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
