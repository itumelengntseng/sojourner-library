import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// C88: "2 books read to the end · Read to the end" at the front desk (own sessions; same count as the ledger shelf).
let cookieValue: string | undefined;
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (name === "soj_preview_sessions" && cookieValue !== undefined ? { value: cookieValue } : undefined) }) }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => null }));

import { FinishedLine } from "@/components/FinishedLine";
import { myFinishedCount } from "@/lib/ledgerStore";
import { getWork } from "@/lib/catalogue";
import { countWords } from "@/lib/engine/readingTime";

describe("books read to the end at the front desk (C88)", () => {
  it("shows the count with a link to the ledger's Read to the end shelf", () => {
    const html = renderToStaticMarkup(<FinishedLine count={2} />);
    expect(html).toContain("2</span> books read to the end");
    expect(html).toContain('href="/ledger#finished"');
    expect(renderToStaticMarkup(<FinishedLine count={1} />)).toContain("1</span> book read to the end");
  });
  it("shows nothing until a book is finished", () => {
    expect(renderToStaticMarkup(<FinishedLine count={0} />)).toBe("");
  });
  it("counts only books read to the end, from the reader's own preview sessions", async () => {
    const two = getWork("placeholder-work-two")!;
    const last = two.chapters.at(-1)!;
    cookieValue = JSON.stringify([
      { id: "s1", slug: "placeholder-work-two", position: last.position, wordsRead: countWords(last.body), activeMs: 60_000, endedAt: 1_000 },
      { id: "s2", slug: "placeholder-work-one", position: 1, wordsRead: 99_999, activeMs: 60_000, endedAt: 2_000 },
    ]);
    expect(await myFinishedCount()).toBe(1);
    cookieValue = undefined;
    expect(await myFinishedCount()).toBe(0);
  });
});
