import Link from "next/link";
import { SceneCover } from "@/components/SceneCover";
import { getWorks } from "@/lib/catalogue";
import { AUTHOR, SITE_NAME } from "@/lib/site";

// The front hall: you step over the threshold and the covers are lit along the wall.
export default function FrontHall() {
  const works = getWorks();
  return (
    <main id="main" className="mx-auto max-w-5xl px-4 pt-16 sm:pt-24">
      <header className="flex flex-col items-center text-center">
        <p className="font-sans text-xs uppercase tracking-[0.3em] text-sandstone">Front hall</p>
        <h1 className="mt-4 text-4xl text-lamplight sm:text-5xl">{SITE_NAME}</h1>
        <p className="mt-3 text-paper/85">The writing of {AUTHOR}</p>
        <div className="threshold mt-8 w-48" aria-hidden="true" />
      </header>

      <section aria-labelledby="on-the-wall" className="mt-12">
        <h2 id="on-the-wall" className="sr-only">On the wall</h2>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-8">
          {works.map((w) => (
            <li key={w.slug}>
              <Link href={`/works/${w.slug}`} className="block rounded-sm transition-transform hover:-translate-y-1">
                <SceneCover work={w} />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center font-sans text-xs text-sandstone/80">
          Every work shown is a placeholder until the manuscripts arrive.
        </p>
      </section>

      <div className="mt-12 flex flex-wrap justify-center gap-4">
        <Link href="/halls" className="rounded border border-sandstone/50 px-5 py-2 font-sans text-sm text-paper hover:border-lamplight">
          Walk the halls
        </Link>
        <Link href="/card" className="rounded border border-lamplight/60 px-5 py-2 font-sans text-sm text-lamplight hover:bg-lamplight hover:text-ink">
          Front desk
        </Link>
        <Link href="/ledger" className="rounded border border-sandstone/50 px-5 py-2 font-sans text-sm text-paper hover:border-lamplight">
          Your ledger
        </Link>
      </div>
    </main>
  );
}
