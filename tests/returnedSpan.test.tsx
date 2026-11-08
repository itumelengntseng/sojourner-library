import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// C93: Recently returned's Finished mark adds how long the book took (own sessions, one pass for all rows).
let cookieValue: string | undefined;
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookieValue === undefined ? undefined : { value: cookieValue }) }) }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => null }));

import { myFirstReads } from "@/lib/ledgerStore";
import { RecentlyReturned } from "@/components/RecentlyReturned";
import type { Returned } from "@/lib/loanDesk";

const item = (slug: string, title: string): Returned => ({ workKey: slug, slug, title, borrowed: "1 NOV 2026", returned: "9 NOV 2026", returnedAt: 1, onTime: true });
const at = (iso: string) => Date.parse(iso);

describe("how long it took on Recently returned (C93)", () => {
  it("finds each book's first session from the reader's own preview sessions in one pass", async () => {
    cookieValue = JSON.stringify([
      { id: "a", slug: "placeholder-work-one", position: 2, wordsRead: 10, activeMs: 60_000, endedAt: 5_000 },
      { id: "b", slug: "placeholder-work-two", position: 1, wordsRead: 10, activeMs: 60_000, endedAt: 1_000 },
      { id: "c", slug: "placeholder-work-one", position: 1, wordsRead: 10, activeMs: 60_000, endedAt: 3_000 },
      { id: "d", slug: "placeholder-work-three", position: 1, wordsRead: 10, activeMs: 60_000, endedAt: 500 },
    ]);
    expect(await myFirstReads(["placeholder-work-one", "placeholder-work-two", "placeholder-work-one"])).toEqual({ "placeholder-work-one": 3_000, "placeholder-work-two": 1_000 });
    expect(await myFirstReads([])).toEqual({});
    cookieValue = undefined;
    expect(await myFirstReads(["placeholder-work-one"])).toEqual({});
  });
  it("adds '· read over 9 days' beside a finished book only", () => {
    const html = renderToStaticMarkup(
      <RecentlyReturned items={[item("a", "Placeholder A"), item("b", "Placeholder B")]}
        finished={{ a: at("2026-11-09T10:00:00Z") }}
        firstRead={{ a: at("2026-11-01T10:00:00Z"), b: at("2026-11-01T10:00:00Z") }} />,
    );
    expect(html.match(/· read over 9 days/g)).toHaveLength(1);
    expect(html.indexOf("· read over 9 days")).toBeLessThan(html.indexOf("Placeholder B"));
  });
  it("shows the Finished mark alone when the first session isn't known", () => {
    const html = renderToStaticMarkup(<RecentlyReturned items={[item("a", "Placeholder A")]} finished={{ a: at("2026-11-09T10:00:00Z") }} />);
    expect(html).toContain("Finished");
    expect(html).not.toContain("· read ");
  });
});

describe("Recently returned — read for <time> (C173)", () => {
  it("adds the reader's own time to the stamp line of a book read in, only that one", () => {
    const html = renderToStaticMarkup(
      <RecentlyReturned items={[item("a", "Placeholder A"), item("b", "Placeholder B")]} readMs={{ a: 75 * 60_000 }} />,
    ).replace(/<!-- -->/g, "");
    expect(html).toContain(" · read for 1 h 15 min");
    expect(html.match(/read for/g)).toHaveLength(1);
    expect(html.indexOf("read for")).toBeLessThan(html.indexOf("Placeholder B"));
  });
  it("says nothing with no time read", () => {
    const html = renderToStaticMarkup(<RecentlyReturned items={[item("a", "Placeholder A")]} readMs={{ a: 0 }} />);
    expect(html).not.toContain("read for");
  });
  it("the card page passes the ledger's hours", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("app/card/page.tsx", "utf8")).toContain("now={Date.now()} readMs={readMs} />");
  });
});
