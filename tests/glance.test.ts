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
