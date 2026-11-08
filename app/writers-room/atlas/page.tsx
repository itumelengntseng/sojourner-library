import type { Metadata } from "next";
import Link from "next/link";
import { AtlasEditor } from "@/components/AtlasEditor";
import { toAtlasText } from "@/lib/atlas";
import { loadAtlas } from "@/lib/atlasStore";
import { loadCatalogue } from "@/lib/catalogueServer";
import { ownerClient } from "@/lib/writersRoom";

// Owner-only: always render per request (reads the session).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Family wall & timeline" };

export default async function AtlasRoom({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // C235: arriving from "What still waits for your words" opens the pickers on "Placeholders only".
  const only = (await searchParams).only === "1";
  const { reason } = await ownerClient();
  if (reason && reason !== "preview") {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 pt-24 text-center">
        <h1 className="text-2xl text-lamplight">The Writer&apos;s Room</h1>
        <p className="mt-4">{reason === "signed-out" ? "Show your card at the front desk first." : "This room is kept for the Keeper of the Library."}</p>
      </main>
    );
  }
  const [atlas, catalogue] = await Promise.all([loadAtlas(), loadCatalogue()]);
  const live = atlas.mode === "library";
  const known = catalogue.works.map((w) => w.slug);
  const works = Object.fromEntries(catalogue.works.map((w) => [w.slug, w.title]));
  return (
    <main id="main" className="mx-auto max-w-4xl px-4 pt-16">
      <nav className="font-sans text-xs text-sandstone"><Link href="/writers-room" className="hover:text-lamplight">Writer&apos;s Room</Link> / Family wall &amp; timeline</nav>
      <h1 className="mt-6 text-3xl text-lamplight">The family wall &amp; the timeline</h1>
      <p className="mt-1 max-w-prose font-sans text-sm text-sandstone">
        Edit the people and the Harlem places and events behind <Link href="/lineage" className="text-lamplight underline underline-offset-2">the family wall</Link> and <Link href="/timeline" className="text-lamplight underline underline-offset-2">the timeline</Link>. Edit one person, place or event at a time, or the whole file as JSON. The same checks as the files run as you go; nothing is saved until it checks out. Tick “Real” on entries in your own words.
      </p>
      {!live && <p className="mt-4 rounded-sm border border-ember/50 px-3 py-2 font-sans text-xs text-ember">Preview: the library isn&apos;t connected yet, so changes can&apos;t be saved here. You can still try edits and see the checks. Until then the wall and timeline come from content/lineage.ts and content/timeline.ts.</p>}
      <p className="mt-4 font-sans text-xs text-sandstone">Works you can refer to: {known.length ? known.map((s) => <code key={s} className="mr-2">{s}</code>) : "none on the shelves yet"}.</p>

      <section aria-labelledby="lineage-doc" className="mt-8 rounded-sm border border-timber-dark bg-stone-floor/60 p-5">
        <h2 id="lineage-doc" className="text-xl text-paper">The family wall</h2>
        <p className="mb-3 font-sans text-xs text-sandstone">{atlas.stored.lineage ? "Showing the copy saved in the library." : "Showing the file copy (content/lineage.ts) — saving here makes the library copy."} Each person: id, name, parents (up to two ids), partners, appearsIn (work addresses), optional note.</p>
        <AtlasEditor kind="lineage" text={toAtlasText(atlas.lineage)} works={works} canSave={live} placeholdersOnly={only} />
      </section>

      <section aria-labelledby="timeline-doc" className="mt-8 rounded-sm border border-timber-dark bg-stone-floor/60 p-5">
        <h2 id="timeline-doc" className="text-xl text-paper">The Harlem timeline</h2>
        <p className="mb-3 font-sans text-xs text-sandstone">{atlas.stored.timeline ? "Showing the copy saved in the library." : "Showing the file copy (content/timeline.ts) — saving here makes the library copy."} Places: street (110–155) and avenue id, or &quot;elsewhere&quot;. Events: date like &quot;1924&quot;, &quot;1924-03&quot; or &quot;1924-03-15&quot;, optional approximate, placeId, appearsIn.</p>
        <AtlasEditor kind="timeline" text={toAtlasText(atlas.timeline)} works={works} canSave={live} placeholdersOnly={only} />
      </section>
    </main>
  );
}
