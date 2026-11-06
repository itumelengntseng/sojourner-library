import type { PitchKit } from "@/lib/pitch";

// The pitch as a single sheet of good paper: title, authorship, the hook, the sample.
export function PitchSheet({ kit, work }: { kit: PitchKit; work: { title: string; author: string; words: number; readingTime: string } }) {
  const list = (items: string[]) => <ul className="list-disc pl-5">{items.map((t) => <li key={t}>{t}</li>)}</ul>;
  return (
    <article className="pitch-sheet mx-auto max-w-2xl rounded-sm bg-paper px-6 py-8 text-ink shadow-[0_18px_40px_-12px_rgb(0_0_0/0.7)] sm:px-10">
      {kit.isPlaceholder && <p className="mb-4 rounded-sm border border-ochre px-3 py-1 font-sans text-xs text-[#8a4a12]">Placeholder pitch — the author&apos;s own words will replace this.</p>}
      <h1 className="text-3xl">{work.title}</h1>
      <p className="mt-1 font-sans text-sm uppercase tracking-[0.2em] text-timber">by {work.author}</p>
      <div className="threshold my-5 opacity-70" aria-hidden="true" />
      <p className="text-xl leading-snug">{kit.logline}</p>
      <h2 className="mt-6 font-sans text-xs uppercase tracking-wider text-timber">Synopsis</h2>
      <p className="mt-1 whitespace-pre-line">{kit.synopsis}</p>
      {kit.themes.length > 0 && (<><h2 className="mt-6 font-sans text-xs uppercase tracking-wider text-timber">Themes</h2>{list(kit.themes)}</>)}
      {kit.comparables.length > 0 && (<><h2 className="mt-6 font-sans text-xs uppercase tracking-wider text-timber">Comparable titles</h2>{list(kit.comparables)}</>)}
      {kit.audience && (<><h2 className="mt-6 font-sans text-xs uppercase tracking-wider text-timber">Audience</h2><p>{kit.audience}</p></>)}
      {kit.formats.length > 0 && (<><h2 className="mt-6 font-sans text-xs uppercase tracking-wider text-timber">Formats</h2><p>{kit.formats.join(" · ")}</p></>)}
      <p className="mt-6 font-sans text-sm text-timber">{work.words > 0 ? `${work.words.toLocaleString("en-ZA")} words · about ${work.readingTime} to read` : "Length to come"}</p>
      <section className="sheet-keep"><h2 className="mt-6 font-sans text-xs uppercase tracking-wider text-timber">From the work</h2>
      <blockquote className="mt-1 whitespace-pre-line border-l-2 border-ochre pl-4 italic">{kit.sample}</blockquote></section>
      <h2 className="mt-6 font-sans text-xs uppercase tracking-wider text-timber">From the author</h2>
      <p className="mt-1 whitespace-pre-line">{kit.authorNote}</p>
      {kit.contact && (<><h2 className="mt-6 font-sans text-xs uppercase tracking-wider text-timber">Contact</h2><p className="mt-1">{kit.contact}</p></>)}
      <p className="mt-8 border-t border-timber/30 pt-3 font-sans text-[0.7rem] text-timber">© {work.author}. Shared privately; please don&apos;t forward.</p>
    </article>
  );
}
