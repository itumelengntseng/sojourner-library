import Link from "next/link";
import { AUTHOR } from "@/lib/site";
import { finishedStamp } from "@/lib/ledger";

// C41: a short shelf of the books you've read to the end, newest first.
export function FinishedShelf({ items, title, href }: {
  items: { workKey: string; finishedAt: number }[];
  title: (k: string) => string;
  href: (k: string) => string | null;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="finished" className="mt-12">
      <h2 id="finished" className="text-xl text-paper">Read to the end</h2>
      <p className="font-sans text-xs text-sandstone">{items.length} book{items.length === 1 ? "" : "s"} by {AUTHOR}, newest first.</p>
      <ul className="mt-3 divide-y divide-timber-dark/70 border-y border-timber-dark/70">
        {items.map((f) => {
          const to = href(f.workKey);
          const when = new Date(f.finishedAt);
          return (
            <li key={f.workKey} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              {to ? <Link href={to} className="hover:text-lamplight">{title(f.workKey)}</Link> : <span>{title(f.workKey)}</span>}
              <time dateTime={when.toISOString()} className="inline-block -rotate-2 rounded-sm border border-lamplight/70 px-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-lamplight">
                {finishedStamp(f.finishedAt)}
              </time>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
