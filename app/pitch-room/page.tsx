import type { Metadata } from "next";
import Link from "next/link";
import { RevokeLink, ShareForm } from "@/components/PitchForms";
import { kitStatus, lastOpened, loglineWarning } from "@/lib/pitch";
import { ownerPitchLinks, roomPitches } from "@/lib/pitchStore";
import { AUTHOR } from "@/lib/site";
import { cleanQuery, filterByTitle } from "@/lib/shelfSearch";

// Owner-only: always render per request (reads the session).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pitch Room" };

export default async function PitchRoom({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ live, allowed, links }, { pitches: all }] = await Promise.all([ownerPitchLinks(), roomPitches()]);
  // C65: "Find a kit" by work title (a GET form — no JavaScript needed).
  const find = cleanQuery((await searchParams).find);
  const pitches = filterByTitle(all.map((p) => ({ ...p, title: p.work.title })), find);
  if (!allowed) {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 pt-24 text-center">
        <h1 className="text-2xl text-lamplight">The Pitch Room</h1>
        <p className="mt-4">This room is kept for the Keeper of the Library.</p>
      </main>
    );
  }
  return (
    <main id="main" className="mx-auto max-w-5xl px-4 pt-16">
      <nav className="font-sans text-xs text-sandstone"><Link href="/" className="hover:text-lamplight">Front hall</Link> / <Link href="/writers-room" className="hover:text-lamplight">Writer&apos;s Room</Link> / Pitch Room</nav>
      <h1 className="mt-6 text-3xl text-lamplight sm:text-4xl">The Pitch Room</h1>
      <p className="mt-1 font-sans text-sm text-sandstone">One sheet per work for agents, editors and producers — in {AUTHOR}&apos;s words, shared by private link.</p>
      {!live && <p className="mt-4 rounded-sm border border-ember/50 px-3 py-2 font-sans text-xs text-ember">Preview: sheets and one-pagers work now; private links start once the library is connected.</p>}

      {(all.length > 1 || find) && (
        <form role="search" action="/pitch-room" method="get" className="mt-6 flex max-w-md items-center gap-2 font-sans text-sm">
          <label htmlFor="kit-find" className="sr-only">Find a kit</label>
          <input id="kit-find" name="find" type="search" defaultValue={find} maxLength={80} autoComplete="off" placeholder="Find a kit by title…"
            className="min-w-0 flex-1 rounded-sm border border-timber bg-stone-wall/70 px-3 py-2 text-paper placeholder:text-sandstone/70" />
          <button type="submit" className="rounded-sm border border-lamplight/60 px-3 py-2 text-lamplight hover:bg-lamplight/10">Find</button>
          {find && <Link href="/pitch-room" className="text-sandstone underline underline-offset-2 hover:text-lamplight">Clear</Link>}
        </form>
      )}
      {find && <p role="status" className="mt-2 font-sans text-sm text-sandstone">{pitches.length === 0 ? `No kit’s title matches “${find}”.` : `Matching “${find}”: ${pitches.length} ${pitches.length === 1 ? "kit" : "kits"}.`}</p>}

      <ul className="mt-8 flex flex-col gap-4">
        {all.length === 0 && <li className="font-sans text-sm text-sandstone">No works on the shelves yet — shelve a manuscript in the Writer&apos;s Room first.</li>}
        {pitches.map((p) => {
          const k = p.kit;
          const st = kitStatus(k);
          const warn = loglineWarning(k.logline);
          const mine = links.filter((l) => l.slug === k.slug);
          return (
            <li key={k.slug} className="rounded-sm border border-timber-dark bg-stone-floor/60 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl text-paper">{p.work.title}</h2>
                <span className={`font-sans text-xs ${st.ready ? "text-lamplight" : "text-ember"}`}>
                  {st.ready ? "Ready to send" : st.placeholder ? "Placeholder — awaiting the author's words" : `Missing: ${st.missing.join(", ")}`}
                </span>
              </div>
              <p className="mt-2 text-paper/90">{k.logline || <span className="font-sans text-sm text-sandstone">No logline yet.</span>}</p>
              {warn && <p className="font-sans text-xs text-ember">{warn}</p>}
              <div className="mt-3 flex flex-wrap gap-4 font-sans text-sm">
                <Link href={`/pitch-room/${k.slug}/edit`} className="text-lamplight underline underline-offset-2">Edit the kit</Link>
                <Link href={`/pitch-room/${k.slug}`} className="text-lamplight underline underline-offset-2">See the sheet</Link>
                <a href={`/pitch-room/${k.slug}/one-pager`} className="text-lamplight underline underline-offset-2">Download one-pager (Markdown)</a>
              </div>
              <div className="threshold my-4 opacity-40" aria-hidden="true" />
              <ShareForm slug={k.slug} enabled={live} />
              {mine.length > 0 && (
                <ul className="mt-3 divide-y divide-timber-dark/60 font-sans text-xs text-sandstone">
                  {mine.map((l) => (
                    <li key={l.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                      <span>{l.note || "Link"} · {l.views} view{l.views === 1 ? "" : "s"} · {lastOpened(l.lastViewedAt)}</span>
                      <span>{l.revoked ? "closed" : new Date(l.expiresAt) < new Date() ? "expired" : <>open until {new Date(l.expiresAt).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" })} · <RevokeLink id={l.id} /></>}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
