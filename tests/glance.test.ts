import { describe, expect, it } from "vitest";
import { glance } from "@/lib/glance";

const w = (visibility: "owner" | "members", words: number, openLoans: number) => ({ visibility, words, openLoans });

describe("the library at a glance", () => {
  it("counts works, words, card holders and open loans", () => {
    const t = glance([w("members", 12000, 2), w("owner", 3400, 0), w("members", 0, 1)], 1, 5);
    expect(t.map((x) => [x.label, x.value])).toEqual([["On the shelves", "3"], ["Words shelved", (15400).toLocaleString("en-ZA")], ["Card holders", "5"], ["Out on loan now", "3"]]);
    expect(t[0].note).toBe("2 shared · 1 only me · 1 set aside");
    expect(t[3].note).toBe("3 open loans");
  });
  it("reads plainly when the library is empty or not connected", () => {
    const t = glance([], 0, null);
    expect(t[0]).toMatchObject({ value: "0", note: "0 shared · 0 only me" });
    expect(t[2]).toMatchObject({ value: "—", note: "once the library is connected" });
    expect(t[3].note).toBe("every book is in");
    expect(glance([w("owner", 1, 1)], 0, 1)[3].note).toBe("1 open loan");
  });
  it("never carries a reader's name or reading detail", () => {
    expect(JSON.stringify(glance([w("members", 10, 1)], 0, 2))).not.toMatch(/reader_id|display_name|notes|highlights/);
  });
});

describe("changed label (C39)", () => {
  it("says when a work last changed, in SA days", async () => {
    const { changedLabel } = await import("@/lib/glance");
    const now = Date.parse("2026-11-06T10:00:00Z");
    expect(changedLabel(undefined, now)).toBeNull();
    expect(changedLabel("not a date", now)).toBeNull();
    expect(changedLabel("2026-11-06T08:00:00Z", now)).toBe("changed today");
    expect(changedLabel("2026-11-05T22:30:00Z", now)).toBe("changed today"); // 00:30 SAST on the 6th
    expect(changedLabel("2026-11-05T21:30:00Z", now)).toBe("changed yesterday"); // 23:30 SAST on the 5th
    expect(changedLabel("2026-11-02T10:00:00Z", now)).toBe("changed 4 days ago");
    expect(changedLabel("2026-10-06T10:00:00Z", now)).toMatch(/^changed 0?6 Oct 2026$/);
  });
});

describe("read to the end tile (C45)", () => {
  const w = (finished?: number) => ({ visibility: "members" as const, words: 10, openLoans: 0, ...(finished !== undefined ? { finished } : {}) });
  it("appears only when the library could count every work", () => {
    expect(glance([w(), w()], 0, 3).map((t) => t.label)).not.toContain("Read to the end");
    expect(glance([w(2), w()], 0, 3).map((t) => t.label)).not.toContain("Read to the end");
    expect(glance([], 0, 3).map((t) => t.label)).not.toContain("Read to the end");
  });
  it("sums the counts across works, with a plain note", () => {
    const t = glance([w(2), w(1), w(0)], 0, 3).find((x) => x.label === "Read to the end")!;
    expect(t).toEqual({ label: "Read to the end", value: "3", note: "by guest readers, counted per book" });
    expect(glance([w(0)], 0, 3).find((x) => x.label === "Read to the end")!.note).toBe("no guest has reached an ending yet");
  });
});

describe("glance — Loans this month (C163)", () => {
  const NOW = Date.parse("2026-11-08T12:00:00Z");
  const DAY = 86_400_000;
  it("counts loans taken out in the last 30 days only", async () => {
    const { loansInMonth } = await import("@/lib/glance");
    expect(loansInMonth([NOW - 1000, NOW - 29 * DAY, NOW - 30 * DAY, NOW - 40 * DAY, NOW + 5000], NOW)).toBe(2);
    expect(loansInMonth([], NOW)).toBe(0);
  });
  it("shows a head count tile, never who or what", async () => {
    const { glance } = await import("@/lib/glance");
    const w = [{ visibility: "members" as const, words: 10, openLoans: 1 }];
    const t = glance(w, 0, 3, 0, 0, 0, { taken: 4, early: 0 }).find((x) => x.label === "Loans this month")!;
    expect(t).toEqual({ label: "Loans this month", value: "4", note: "taken out in the last 30 days" });
    expect(glance(w, 0, 3, 0, 0, 0, { taken: 0, early: 0 }).find((x) => x.label === "Loans this month")!.note).toBe("none taken out in the last 30 days");
    expect(glance(w, 0, 3).some((x) => x.label === "Loans this month")).toBe(false);
  });
});

describe("Writer's Room — Loans this month wiring (C163)", () => {
  it("library mode asks for a 30-day head count; the page passes it on", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/writersRoom.ts", "utf8");
    expect(src).toContain('supabase.from("loans").select("id", { count: "exact", head: true }).gt("borrowed_at", new Date(nowMs - 30 * 86_400_000).toISOString())');
    expect(src).toContain("loansMonth: monthLoans(parsePreviewLoans(");
    expect(readFileSync("app/writers-room/page.tsx", "utf8")).toContain("room.borrowedHour, room.loansMonth)");
  });
});

describe("glance — Loans this month, handed back early (C165)", () => {
  const NOW = Date.parse("2026-11-08T12:00:00Z");
  const DAY = 86_400_000;
  const l = (daysAgo: number, returnedAfter: number | null, dueAfter: number) => ({ borrowedAt: NOW - daysAgo * DAY, returnedAt: returnedAfter === null ? null : NOW - daysAgo * DAY + returnedAfter, dueAt: NOW - daysAgo * DAY + dueAfter });
  it("counts the month's loans returned before due (auto-returns at due time don't count)", async () => {
    const { monthLoans } = await import("@/lib/glance");
    expect(monthLoans([l(1, 1000, 5000), l(2, 5000, 5000), l(3, null, 5000), l(40, 1, 5000)], NOW)).toEqual({ taken: 3, early: 1 });
  });
  it("adds the early part to the note, singular and plural", async () => {
    const { glance } = await import("@/lib/glance");
    const w = [{ visibility: "members" as const, words: 10, openLoans: 0 }];
    const note = (m: { taken: number; early: number }) => glance(w, 0, 1, 0, 0, 0, m).find((x) => x.label === "Loans this month")!.note;
    expect(note({ taken: 3, early: 1 })).toBe("taken out in the last 30 days · 1 handed back before it was due");
    expect(note({ taken: 3, early: 2 })).toBe("taken out in the last 30 days · 2 handed back before they were due");
    expect(note({ taken: 3, early: 0 })).toBe("taken out in the last 30 days");
  });
  it("library mode reads only return and due times of the month's handed-back loans", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("lib/writersRoom.ts", "utf8")).toContain('supabase.from("loans").select("returned_at, due_at").gt("borrowed_at", new Date(nowMs - 30 * 86_400_000).toISOString()).not("returned_at", "is", null)');
  });
});
