import type { Metadata } from "next";
import Link from "next/link";
import { LINEAGE } from "@/content/lineage";
import { CanonToggle } from "@/components/CanonToggle";
import { LineageWall } from "@/components/LineageWall";
import { getWorks } from "@/lib/catalogue";
import { AUTHOR } from "@/lib/site";
import { parseCanonView } from "@/lib/workStats";

export const metadata: Metadata = { title: "Lineage" };

export default async function LineagePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = parseCanonView((await searchParams).canon);
  const works = getWorks();
  const canonSlugs = new Set(works.filter((w) => w.canonStatus === "canon").map((w) => w.slug));
  // Canon only: keep people who appear in at least one canon work, and only their canon appearances.
  const people = view === "all" ? LINEAGE.people : LINEAGE.people
    .filter((p) => p.appearsIn.some((w) => canonSlugs.has(w)))
    .map((p) => ({ ...p, appearsIn: p.appearsIn.filter((w) => canonSlugs.has(w)) }));
  const ids = new Set(people.map((p) => p.id));
  const visible = people.map((p) => ({ ...p, parents: p.parents.filter((x) => ids.has(x)), partners: p.partners.filter((x) => ids.has(x)) }));

  return (
    <main id="main" className="mx-auto max-w-5xl px-4 pt-16">
      <nav className="font-sans text-xs text-sandstone"><Link href="/" className="hover:text-lamplight">Front hall</Link> / Lineage</nav>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-lamplight sm:text-4xl">{LINEAGE.title}</h1>
          <p className="mt-1 font-sans text-sm text-sandstone">The people across the works of {AUTHOR}.</p>
        </div>
        <CanonToggle view={view} basePath="/lineage" />
      </div>
      {LINEAGE.isPlaceholder && (
        <p className="mt-4 rounded-sm border border-ember/50 px-3 py-2 font-sans text-xs text-ember">
          Placeholder wall — these names and ties only show how the explorer works. The real lineage will come from the author.
        </p>
      )}
      <div className="mt-8">
        <LineageWall people={visible} works={Object.fromEntries(works.map((w) => [w.slug, w.title]))} />
      </div>
    </main>
  );
}
