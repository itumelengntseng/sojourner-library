import type { Metadata } from "next";
import Link from "next/link";
import { CanonToggle } from "@/components/CanonToggle";
import { HarlemMap } from "@/components/HarlemMap";
import { loadCatalogue } from "@/lib/catalogueServer";
import { loadAtlas } from "@/lib/atlasStore";
import { ShelfEmpty } from "@/components/ShelfEmpty";
import { canonView } from "@/lib/canonServer";
import { AUTHOR } from "@/lib/site";
import { timelineForWorks } from "@/lib/timeline";
import { filterByCanon } from "@/lib/workStats";

export const metadata: Metadata = { title: "Harlem timeline" };

export default async function TimelinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = await canonView((await searchParams).canon);
  const [catalogue, atlas] = await Promise.all([loadCatalogue(), loadAtlas()]);
  const works = catalogue.works;
  const TIMELINE = atlas.timeline;
  if (catalogue.mode === "library" && !catalogue.signedIn) {
    return <main id="main" className="mx-auto max-w-6xl px-4 pt-16"><h1 className="text-3xl text-lamplight">Harlem timeline</h1><ShelfEmpty catalogue={catalogue} /></main>;
  }
  const timeline = timelineForWorks(TIMELINE, new Set(filterByCanon(works, view).map((w) => w.slug)));
  return (
    <main id="main" className="mx-auto max-w-6xl px-4 pt-16">
      <nav className="font-sans text-xs text-sandstone"><Link href="/" className="hover:text-lamplight">Front hall</Link> / Harlem timeline</nav>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-lamplight sm:text-4xl">Harlem, year by year</h1>
          <p className="mt-1 font-sans text-sm text-sandstone">Where and when things happen in the works of {AUTHOR}.</p>
        </div>
        <CanonToggle view={view} basePath="/timeline" />
      </div>
      {TIMELINE.isPlaceholder && (
        <p className="mt-4 rounded-sm border border-ember/50 px-3 py-2 font-sans text-xs text-ember">
          Placeholder places and events — they only show how the map works. The street plan is real; the story on it will come from the author.
        </p>
      )}
      <div className="mt-8">
        <HarlemMap timeline={timeline} works={Object.fromEntries(works.map((w) => [w.slug, w.title]))} />
      </div>
    </main>
  );
}
