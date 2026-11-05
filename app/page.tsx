import Link from "next/link";
import { AUTHOR, SITE_NAME } from "@/lib/site";
import { DEFAULT_WPM, formatDuration, minutesFor } from "@/lib/engine/readingTime";

// Front hall placeholder. The animated covers arrive in B4.
export default function FrontHall() {
  const sample = minutesFor(90_000, DEFAULT_WPM);
  return (
    <main id="main" className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-24 text-center">
      <p className="font-sans text-xs uppercase tracking-[0.3em] text-sandstone">Front hall</p>
      <h1 className="mt-4 text-4xl text-lamplight sm:text-5xl">{SITE_NAME}</h1>
      <div className="threshold mt-8 w-48" aria-hidden="true" />
      <p className="mt-8 max-w-prose text-lg text-paper/90">
        The doors are being hung and the shelves are still timber on the floor. Works by {AUTHOR} will be
        catalogued here once the manuscripts arrive.
      </p>
      <p className="mt-6 font-sans text-sm text-sandstone/80">
        A 90,000-word book takes about {formatDuration(sample)} at a steady {DEFAULT_WPM} words per minute.
      </p>
      <Link href="/card" className="mt-10 rounded border border-lamplight/60 px-5 py-2 font-sans text-sm text-lamplight hover:bg-lamplight hover:text-ink">
        Go to the front desk
      </Link>
    </main>
  );
}
