import type { Metadata } from "next";
import Link from "next/link";
import { BackupLinks } from "@/components/BackupLinks";
import { ArchiveButton, DescriptionForm, HallForm, InviteForm, ManuscriptImport, RevokeInvite, WorkSettings } from "@/components/WritersRoomForms";
import { CANON_LABEL, formatWords } from "@/lib/workStats";
import { AUTHOR } from "@/lib/site";
import { glance } from "@/lib/glance";
import { loadRoom } from "@/lib/writersRoom";

// Owner-only: always render per request (reads the session).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Writer's Room" };

// Behind the stacks: a timber table under one lamp, where the Keeper shelves new work.
export default async function WritersRoom() {
  const room = await loadRoom();
  if (room.mode === "closed") {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 pt-24 text-center">
        <h1 className="text-2xl text-lamplight">The Writer&apos;s Room</h1>
        <p className="mt-4">{room.reason === "signed-out" ? "Show your card at the front desk first." : "This room is kept for the Keeper of the Library."}</p>
        <Link href="/" className="mt-6 inline-block font-sans text-sm text-lamplight underline">Back to the front hall</Link>
      </main>
    );
  }
  const live = room.mode === "library";
  return (
    <main id="main" className="mx-auto max-w-5xl px-4 pt-16">
      <nav className="font-sans text-xs text-sandstone"><Link href="/" className="hover:text-lamplight">Front hall</Link> / Writer&apos;s Room</nav>
      <h1 className="mt-6 text-3xl text-lamplight sm:text-4xl">The Writer&apos;s Room</h1>
      <p className="mt-1 font-sans text-sm text-sandstone">For {AUTHOR}: shelve manuscripts, decide who reads them, and issue reader cards.</p>
      {!live && <p className="mt-4 rounded-sm border border-ember/50 px-3 py-2 font-sans text-xs text-ember">Preview: the library isn&apos;t connected yet, so nothing here is saved. You can still try an import to see how a manuscript splits into chapters.</p>}

      <section aria-labelledby="glance" className="mt-8">
        <h2 id="glance" className="sr-only">The library at a glance</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {glance(room.works, live ? room.setAside.length : 0, live ? room.cardHolders : null).map((t) => (
            <div key={t.label} className="rounded-sm border border-timber-dark bg-ink/40 p-4">
              <dt className="font-sans text-[0.65rem] uppercase tracking-wider text-sandstone">{t.label}</dt>
              <dd className="mt-1 text-2xl text-paper">{t.value}</dd>
              {t.note && <dd className="font-sans text-[0.65rem] text-sandstone/80">{t.note}</dd>}
            </div>
          ))}
        </dl>
        <p className="mt-2 font-sans text-[0.65rem] text-sandstone/70">Counts only. Readers&apos; notes, highlights and who read what stay private.</p>
      </section>

      <p className="mt-4 font-sans text-sm">
        <a href="/writers-room/backup" download className="inline-block rounded border border-lamplight/60 px-3 py-1.5 text-lamplight hover:bg-lamplight/10">Back up everything (.zip)</a>
        <span className="ml-2 text-xs text-sandstone">Every manuscript as Markdown, set-aside chapters included, with the halls, pitch kits and the family wall &amp; timeline. Nothing is removed.</span>
      </p>

      <section aria-labelledby="import" className="mt-10 rounded-sm border border-timber-dark bg-stone-floor/60 p-5">
        <h2 id="import" className="text-xl text-paper">Shelve a manuscript</h2>
        <p className="mt-1 font-sans text-xs text-sandstone">Markdown, with each chapter starting &quot;## Chapter title&quot; (or &quot;# &quot; if there&apos;s no book title line). Re-importing the same title updates it; chapters are never deleted, only set aside.</p>
        <div className="threshold my-4 opacity-60" aria-hidden="true" />
        <ManuscriptImport canSave={live} shelf={room.shelf} />
      </section>

      <section aria-labelledby="shelves" className="mt-10">
        <h2 id="shelves" className="text-xl text-paper">On the shelves</h2>
        <ul className="mt-4 divide-y divide-timber-dark/70 border-y border-timber-dark/70">
          {room.works.map((w) => (
            <li key={w.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link href={`/works/${w.slug}`} className="hover:text-lamplight">{w.title}</Link>
                <Link href={`/works/${w.slug}/proof`} className="ml-3 font-sans text-xs text-lamplight underline underline-offset-2">Read the proof</Link>
                <span className="ml-3"><BackupLinks slug={w.slug} title={w.title} shelf={room.shelf[w.slug]} /></span>
                <p className="font-sans text-xs text-sandstone">
                  {CANON_LABEL[w.canonStatus]}{w.isPlaceholder ? " · placeholder" : ""}{live ? ` · ${formatWords(w.words)} · ${w.readers} reader${w.readers === 1 ? "" : "s"}, ${w.openLoans} on loan now, ${w.minutes} min read` : ""}
                </p>
                {live && <div className="mt-1 flex flex-wrap items-start gap-4"><DescriptionForm id={w.id} title={w.title} description={w.description} /><ArchiveButton id={w.id} title={w.title} intent="archive" /></div>}
              </div>
              {live ? <WorkSettings id={w.id} visibility={w.visibility} canon={w.canonStatus} hall={w.hall} halls={room.halls} /> : <span className="font-sans text-xs text-sandstone">Settings open once connected</span>}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 font-sans text-sm"><Link href="/pitch-room" className="text-lamplight underline underline-offset-2">The Pitch Room →</Link> <span className="text-sandstone">one-sheet pitches and private links for agents and producers.</span></p>
      <p className="mt-2 font-sans text-sm"><Link href="/writers-room/atlas" className="text-lamplight underline underline-offset-2">The family wall &amp; timeline →</Link> <span className="text-sandstone">edit the people, places and dates behind the explorers.</span></p>

      {live && room.setAside.length > 0 && (
        <section aria-labelledby="set-aside" className="mt-8">
          <h2 id="set-aside" className="text-lg text-paper">Set aside</h2>
          <p className="font-sans text-xs text-sandstone">Off the shelves and out of the readers&apos; sight, kept whole.</p>
          <ul className="mt-2 divide-y divide-timber-dark/70 border-y border-timber-dark/70">
            {room.setAside.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{w.title} <span className="font-sans text-xs text-sandstone">· set aside {new Date(w.archivedAt).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" })}</span></span>
                <span className="flex flex-wrap items-center gap-3"><BackupLinks slug={w.slug} title={w.title} shelf={room.shelf[w.slug]} /><ArchiveButton id={w.id} title={w.title} intent="restore" /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="halls" className="mt-10 rounded-sm border border-timber-dark bg-stone-floor/60 p-5">
        <h2 id="halls" className="text-xl text-paper">The halls</h2>
        <p className="mt-1 font-sans text-xs text-sandstone">
          {live && room.hallsNamed ? "Name, describe and order the halls; choose each work's hall on the shelf list above." : "The halls carry placeholder names until you name them. Halls are never removed — works keep their place."}
        </p>
        <ul className="mt-4 flex flex-col gap-4">
          {room.halls.map((h, i) => <li key={h.id}><HallForm hall={{ ...h, position: i }} canSave={live} /></li>)}
          <li className="border-t border-timber-dark/70 pt-4"><HallForm canSave={live} /></li>
        </ul>
        {!live && <p className="mt-2 font-sans text-xs text-sandstone">Saving opens once the library is connected.</p>}
      </section>

      <section aria-labelledby="invites" className="mt-10 rounded-sm border border-timber-dark bg-ink/40 p-5">
        <h2 id="invites" className="text-xl text-paper">Reader cards</h2>
        {live ? (
          <>
            <div className="mt-4"><InviteForm /></div>
            <ul className="mt-6 divide-y divide-timber-dark/70 font-sans text-sm">
              {room.invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{i.note || "Guest"}</span>
                  <span className="text-xs text-sandstone">
                    {i.redeemed ? "card issued" : i.revoked ? "revoked" : new Date(i.expiresAt) < new Date() ? "expired" : <>open until {new Date(i.expiresAt).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" })} · <RevokeInvite id={i.id} /></>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="mt-2 font-sans text-sm text-sandstone">Invites can be issued once the library is connected.</p>}
      </section>
    </main>
  );
}
