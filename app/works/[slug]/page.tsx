import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoanDesk } from "@/components/LoanDesk";
import { SceneCover } from "@/components/SceneCover";
import { getWork } from "@/lib/catalogue";
import { DEFAULT_WPM, formatDuration } from "@/lib/engine/readingTime";
import { loadDesk } from "@/lib/loanStore";
import { CANON_LABEL, formatWords, workStats } from "@/lib/workStats";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const work = getWork((await params).slug);
  return { title: work ? `${work.title} — ${work.author}` : "Not on the shelves" };
}

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const work = getWork((await params).slug);
  if (!work) notFound();
  const stats = workStats(work);
  const desk = await loadDesk(work.slug);
  const now = Date.now();

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 pt-16">
      <nav className="font-sans text-xs text-sandstone">
        <Link href="/" className="hover:text-lamplight">Front hall</Link> / <Link href="/halls" className="hover:text-lamplight">Halls</Link> / {work.title}
      </nav>
      <div className="mt-8 grid gap-8 sm:grid-cols-[minmax(0,18rem)_1fr]">
        <SceneCover work={work} size="lg" />
        <div>
          <p className={`inline-block rounded-sm border px-2 py-0.5 font-sans text-[0.65rem] uppercase tracking-wider ${
            work.canonStatus === "canon" ? "border-lamplight/60 text-lamplight" : "border-ember/60 text-ember"}`}>
            {CANON_LABEL[work.canonStatus]}
          </p>
          <h1 className="mt-3 text-3xl text-lamplight sm:text-4xl">{work.title}</h1>
          <p className="mt-1 font-sans text-sm uppercase tracking-[0.2em] text-sandstone">by {work.author}</p>
          <p className="mt-6 max-w-prose text-paper/90">{work.blurb}</p>

          <dl className="mt-6 grid max-w-sm grid-cols-2 gap-4 rounded-sm border border-timber-dark bg-ink/40 p-4">
            <div>
              <dt className="font-sans text-xs uppercase tracking-wider text-sandstone">Length</dt>
              <dd className="mt-1 text-lg">{formatWords(stats.words)}</dd>
            </div>
            <div>
              <dt className="font-sans text-xs uppercase tracking-wider text-sandstone">Reading time</dt>
              <dd className="mt-1 text-lg">{stats.readingTime}</dd>
              <dd className="font-sans text-[0.65rem] text-sandstone/80">at {DEFAULT_WPM} wpm until we learn your pace</dd>
            </div>
          </dl>
          {work.isPlaceholder && (
            <p className="mt-4 font-sans text-xs text-sandstone/80">Placeholder text — the manuscript has not arrived yet.</p>
          )}
        </div>
      </div>

      <section aria-labelledby="desk" className="mt-12 rounded-sm border border-timber-dark bg-stone-floor/60 p-5">
        <h2 id="desk" className="text-xl text-paper">The loan desk</h2>
        <div className="threshold my-3 opacity-60" aria-hidden="true" />
        <LoanDesk desk={desk} slug={work.slug} title={work.title} now={now} />
      </section>

      <section aria-labelledby="contents" className="mt-12">
        <h2 id="contents" className="text-xl text-paper">Contents</h2>
        <ol className="mt-4 divide-y divide-timber-dark/70 border-y border-timber-dark/70">
          {stats.chapters.map((c) => (
            <li key={c.position} className="flex items-baseline justify-between gap-4 py-3">
              <span>{c.title}</span>
              <span className="shrink-0 font-sans text-xs text-sandstone">{formatWords(c.words)} · {formatDuration(c.minutes)}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
