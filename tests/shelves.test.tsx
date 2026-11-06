import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getWork, getWorks, type Work } from "@/lib/catalogue";
import { countWords } from "@/lib/engine/readingTime";
import { filterByCanon, formatWords, parseCanonView, workStats } from "@/lib/workStats";
import { CanonToggle } from "@/components/CanonToggle";

const tiny: Work = {
  slug: "t", title: "T", author: "Itumeleng Ntseng", hall: "main", series: null, canonStatus: "canon",
  isPlaceholder: true, blurb: "",
  chapters: [
    { position: 1, title: "One", body: "word ".repeat(460) },
    { position: 2, title: "Two", body: "word ".repeat(230) },
  ],
};

describe("work stats", () => {
  it("counts words per chapter and in total", () => {
    const s = workStats(tiny);
    expect(s.chapters.map((c) => c.words)).toEqual([460, 230]);
    expect(s.words).toBe(690);
  });
  it("gives reading time at the default pace", () => {
    const s = workStats(tiny);
    expect(s.chapters.map((c) => c.minutes)).toEqual([2, 1]);
    expect(s.readingTime).toBe("3 min");
  });
  it("uses a personal pace when given", () => {
    expect(workStats(tiny, 690).minutes).toBe(1);
  });
  it("matches the engine's word count for the placeholder works", () => {
    const w = getWorks()[0];
    expect(workStats(w).words).toBe(w.chapters.reduce((n, c) => n + countWords(c.body), 0));
  });
  it("formats words with thousands separators", () => {
    expect(formatWords(12345)).toBe("12 345 words");
  });
});

describe("canon toggle", () => {
  it("defaults to canon only", () => {
    expect(parseCanonView(undefined)).toBe("canon");
    expect(parseCanonView("nonsense")).toBe("canon");
    expect(parseCanonView("all")).toBe("all");
  });
  it("hides drafts in canon view and shows them in all", () => {
    const all = getWorks();
    expect(filterByCanon(all, "canon").every((w) => w.canonStatus === "canon")).toBe(true);
    expect(filterByCanon(all, "all")).toHaveLength(all.length);
    expect(filterByCanon(all, "canon").length).toBeLessThan(all.length);
  });
  it("marks the active option", () => {
    const html = renderToStaticMarkup(<CanonToggle view="all" basePath="/halls" />);
    expect(html).toMatch(/<a aria-current="true"[^>]*href="\/halls\?canon=all"/);
    expect(html).toContain('href="/halls?canon=canon"');
  });
  it("finds works by slug", () => {
    expect(getWork("placeholder-work-one")?.title).toBe("Placeholder Work One");
    expect(getWork("missing")).toBeUndefined();
  });
});
