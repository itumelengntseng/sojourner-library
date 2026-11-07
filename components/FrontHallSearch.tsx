// C53: a plain search box by the front-hall door — a GET form to the halls (works without JavaScript).
// The canon choice follows by its cookie, so nothing else needs to travel with the query.
export function FrontHallSearch() {
  return (
    <form role="search" action="/halls" method="get" className="mx-auto mt-12 flex max-w-md items-center gap-2 font-sans text-sm">
      <label htmlFor="front-q" className="sr-only">Search the shelves</label>
      <input
        id="front-q" name="q" type="search" maxLength={80} autoComplete="off" required
        placeholder="Search titles, chapters, halls…"
        className="min-w-0 flex-1 rounded-sm border border-timber bg-stone-wall/70 px-3 py-2 text-paper placeholder:text-sandstone/70"
      />
      <button type="submit" className="rounded-sm border border-lamplight/60 px-3 py-2 text-lamplight hover:bg-lamplight/10">Search</button>
    </form>
  );
}
