import type { Metadata } from "next";
import Link from "next/link";
import { RevokeLink, ShareForm } from "@/components/PitchForms";
import { kitStatus, kitsPlaceholder, lastDayLabel, lastOpened, linkTimeLeft, loglineWarning, openedInHour, openedJustNow, orderLinks } from "@/lib/pitch";
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
  const now = Date.now();
  const pitches = filterByTitle(all.map((p) => ({ ...p, title: p.work.title })), find);
  // C223: how many kits still wait for the author's own words (over every kit, not just a search's matches).
  const waiting = kitsPlaceholder(all.map((p) => ({ slug: p.kit.slug, title: p.work.title, isPlaceholder: p.kit.isPlaceholder })));
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

      {waiting && (
        <p className="mt-6 font-sans text-sm text-sandstone" data-kits-placeholder>
          {waiting.line}
          {waiting.edit.length > 0 && <> {waiting.edit.map((e, i) => <span key={e.href}>{i > 0 && " · "}<Link href={e.href} className="text-lamplight underline underline-offset-2">Edit<span className="sr-only"> the kit for</span> {e.title}</Link></span>)}</>}
        </p>
      )}
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
          // C130: open links first (soonest closing first), then closed or expired ones.
          const { links: mine, open: openLinks, closingToday } = orderLinks(links.filter((l) => l.slug === k.slug), now);
          return (
            <li key={k.slug} className="rounded-sm border border-timber-dark bg-stone-floor/60 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl text-paper">{p.work.title}</h2>
                <span className={`font-sans text-xs ${st.ready ? "text-lamplight" : "text-ember"}`}>
                  {st.ready ? "Ready to send" : st.placeholder
                    // C225: the placeholder status leads straight to the kit's editor.
                    ? <Link href={`/pitch-room/${k.slug}/edit`} className="underline underline-offset-2 hover:text-lamplight" data-kit-status>Placeholder — awaiting the author&apos;s words<span className="sr-only">: edit the kit for {p.work.title}</span></Link>
                    : `Missing: ${st.missing.join(", ")}`}
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
                <p className="mt-3 font-sans text-xs text-sandstone">{openLinks === 0 ? "No link open" : `${openLinks} open`}{/* C145 */ openedInHour(mine, now) > 0 && <span className="text-lamplight"> · {openedInHour(mine, now)} opened in the last hour</span>}{closingToday > 0 && <span className="text-ember"> · {closingToday} close{closingToday === 1 ? "s" : ""} today</span>} · {mine.length} shared in all</p>
              )}
              {mine.length > 0 && (
                <ul className="mt-1 divide-y divide-timber-dark/60 font-sans text-xs text-sandstone">
                  {mine.map((l) => (
                    <li key={l.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                      <span>
                        {l.note || "Link"} · {l.views} view{l.views === 1 ? "" : "s"} · {openedJustNow(l.lastViewedAt, now)
                          // C138: opened within the hour — "opened just now", the stamp kept for screen readers.
                          ? <><span aria-hidden="true" className="text-lamplight">opened just now</span><span className="sr-only">opened just now, {lastOpened(l.lastViewedAt)}</span></>
                          : lastOpened(l.lastViewedAt)}
                        {/* C125: the card's "Due soon" look, on a link's final day. */}
                        {!l.revoked && lastDayLabel(l.expiresAt, now) && (
                          <span className="ml-2 inline-block -rotate-2 rounded-sm border border-ember px-1.5 py-0.5 align-middle font-mono text-[0.65rem] uppercase tracking-wider text-ember">
                            Last day<span className="sr-only">{lastDayLabel(l.expiresAt, now)!.slice("Last day".length)}</span>
                          </span>
                        )}
                      </span>
                      <span>{l.revoked ? "closed" : linkTimeLeft(l.expiresAt, now) === null ? "expired" : <>{linkTimeLeft(l.expiresAt, now)} · <RevokeLink id={l.id} /></>}</span>
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
