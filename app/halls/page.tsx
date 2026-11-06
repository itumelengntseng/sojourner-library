import type { Metadata } from "next";
import Link from "next/link";
import { CanonToggle } from "@/components/CanonToggle";
import { getWorks, HALLS, seedOf } from "@/lib/catalogue";
import { canonView } from "@/lib/canonServer";
import { CANON_LABEL, filterByCanon, workStats } from "@/lib/workStats";

export const metadata: Metadata = { title: "The halls" };

// Timber shelves; each book stands as a spine you can pull out.
export default async function Halls({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = await canonView((await searchParams).canon);
  const works = filterByCanon(getWorks(), view);

  return (
    <main id="main" className="mx-auto max-w-5xl px-4 pt-16">
      <nav className="font-sans text-xs text-sandstone"><Link href="/" className="hover:text-lamplight">Front hall</Link> / Halls</nav>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl text-lamplight sm:text-4xl">The halls</h1>
        <CanonToggle view={view} basePath="/halls" />
      </div>

      {HALLS.map((hall) => {
        const shelf = works.filter((w) => w.hall === hall.id);
        return (
          <section key={hall.id} aria-labelledby={`hall-${hall.id}`} className="mt-10">
            <h2 id={`hall-${hall.id}`} className="text-xl text-paper">{hall.name}</h2>
            <p className="font-sans text-xs text-sandstone/80">{hall.note}</p>
            <div className="mt-4 rounded-sm bg-timber-dark/60 px-3 pt-6 shadow-inner">
              {shelf.length === 0 ? (
                <p className="pb-6 font-sans text-sm text-sandstone">This shelf is empty for now.</p>
              ) : (
                <ul className="flex items-end gap-2 overflow-x-auto pb-0">
                  {shelf.map((w) => {
                    const s = workStats(w);
                    const height = 230 + Math.min(60, Math.round(s.words / 500));
                    return (
                      <li key={w.slug} className="shrink-0">
                        <Link
                          href={`/works/${w.slug}`}
                          style={{ height, filter: `hue-rotate(${seedOf(w.slug) / 8}deg)` }}
                          className="flex w-16 flex-col items-center justify-between rounded-t-sm border border-b-0 border-timber-dark bg-gradient-to-r from-timber via-[#7d5233] to-timber px-1 py-3 text-paper transition-transform hover:-translate-y-2 focus-visible:-translate-y-2"
                        >
                          <span className="line-clamp-2 text-[0.75rem] leading-tight [writing-mode:vertical-rl] rotate-180">{w.title}</span>
                          <span className="font-sans text-[0.55rem] uppercase tracking-wider text-lamplight [writing-mode:vertical-rl] rotate-180">{w.author}</span>
                          {w.canonStatus !== "canon" && <span aria-hidden="true" title="Not canon" className="mt-1 h-2 w-2 rounded-full bg-ember" />}
                          <span className="sr-only">
                            by {w.author}. {CANON_LABEL[w.canonStatus]}. {s.readingTime} to read.
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="h-3 rounded-b-sm bg-timber" aria-hidden="true" />
            </div>
          </section>
        );
      })}
    </main>
  );
}
