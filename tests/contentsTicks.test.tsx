import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/works/[slug]/read/actions", () => ({ bookmarkAction: vi.fn(), noteAction: vi.fn(), highlightAction: vi.fn(), removeAction: vi.fn() }));
vi.mock("@/app/works/[slug]/actions", () => ({ returnFromRoomAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const { ReaderView } = await import("@/components/ReaderView");

const data = {
  mode: "preview" as const, loanId: "l1", dueAt: Date.parse("2026-11-07T10:00:00Z"), title: "Placeholder Work", author: "Itumeleng Ntseng", canonStatus: "canon" as const,
  chapter: { position: 2, title: "Placeholder chapter two", body: "Placeholder text.\n\nMore placeholder text." },
  chapters: [1, 2, 3].map((p) => ({ position: p, title: `Placeholder chapter ${p}`, words: 300 })),
  bookmark: { position: 2, wordsIntoChapter: 0 }, notes: [], highlights: [],
};

describe("contents drawer ticks (C47)", () => {
  it("marks the chapters the reader has read through, with a spoken 'read'", () => {
    const html = renderToStaticMarkup(<ReaderView slug="w" data={data} wpm={230} minutesPerDay={30} readPositions={[1]} />);
    const nav = html.slice(html.indexOf('aria-label="Contents"'), html.indexOf("</nav>"));
    expect((nav.match(/, read</g) ?? []).length).toBe(1);
    expect(nav.indexOf(", read")).toBeLessThan(nav.indexOf("Placeholder chapter 2"));
    expect(nav).toContain("· bookmark");
  });
  it("shows no ticks without read chapters (and in the proof copy, which passes none)", () => {
    const html = renderToStaticMarkup(<ReaderView slug="w" data={data} wpm={230} minutesPerDay={30} />);
    expect(html).not.toContain(", read<");
  });
});
