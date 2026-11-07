import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// C70: "Finished" beside a returned book the reader read to the end (C13 rule, own sessions only).
let cookieValue: string | undefined;
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookieValue === undefined ? undefined : { value: cookieValue }) }) }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => null }));

import { myFinishes } from "@/lib/ledgerStore";
import { RecentlyReturned } from "@/components/RecentlyReturned";
import { getWork } from "@/lib/catalogue";
import { countWords } from "@/lib/engine/readingTime";
import type { Returned } from "@/lib/loanDesk";
import { finishedStamp } from "@/lib/ledger";

const item = (slug: string, title: string): Returned => ({ workKey: slug, slug, title, borrowed: "1 NOV 2026", returned: "5 NOV 2026", returnedAt: 1, onTime: true });

describe("Finished on Recently returned (C70)", () => {
  it("finds finishes from the reader's own preview sessions only for books read to the end", async () => {
    const two = getWork("placeholder-work-two")!;
    const last = two.chapters.at(-1)!;
    const words = countWords(last.body);
    cookieValue = JSON.stringify([
      { id: "s1", slug: "placeholder-work-two", position: last.position, wordsRead: words, activeMs: 60_000, endedAt: 1_000 },
      { id: "s2", slug: "placeholder-work-one", position: 1, wordsRead: 99_999, activeMs: 60_000, endedAt: 2_000 }, // not the last chapter
    ]);
    expect(await myFinishes(["placeholder-work-two", "placeholder-work-one", "placeholder-work-two"])).toEqual({ "placeholder-work-two": 1_000 });
    cookieValue = undefined;
    expect(await myFinishes(["placeholder-work-two"])).toEqual({});
  });
  it("shows the Finished mark only beside finished books", () => {
    const html = renderToStaticMarkup(
      <RecentlyReturned items={[item("a", "Placeholder A"), item("b", "Placeholder B")]} finished={{ a: 5 }} />,
    );
    expect(html.match(/Finished/g)).toHaveLength(1);
    expect(html.indexOf("Finished")).toBeGreaterThan(html.indexOf("Placeholder A"));
    expect(html.indexOf("Finished")).toBeLessThan(html.indexOf("Placeholder B"));
    expect(renderToStaticMarkup(<RecentlyReturned items={[item("a", "Placeholder A")]} />)).not.toContain("Finished");
  });
  it("dates the Finished mark in SA time (C71)", () => {
    const at = Date.parse("2026-11-04T23:30:00Z"); // already 5 Nov in Johannesburg
    const html = renderToStaticMarkup(<RecentlyReturned items={[item("a", "Placeholder A")]} finished={{ a: at }} />);
    expect(html).toMatch(/Finished 0?5 Nov 2026/); // en-ZA pads the day on some ICU builds
    expect(finishedStamp(at)).toMatch(/^Finished 0?5 Nov 2026$/);
  });
});
