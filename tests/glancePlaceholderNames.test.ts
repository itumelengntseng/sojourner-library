import { describe, expect, it } from "vitest";
import { glance, waitingNames } from "@/lib/glance";

// C219: the Still placeholder tile names the works when there are one to three.
const w = (title: string, isPlaceholder = true) => ({ visibility: "owner" as const, words: 100, openLoans: 0, isPlaceholder, title });
const note = (works: ReturnType<typeof w>[]) => glance(works, 0, 1).find((x) => x.label === "Still placeholder")!.note;

describe("Still placeholder tile names the works (C219)", () => {
  it("joins one to three titles", () => {
    expect(waitingNames(["A"])).toBe("A");
    expect(waitingNames(["A", "B"])).toBe("A and B");
    expect(waitingNames(["A", "B", "C"])).toBe("A, B and C");
    expect(waitingNames([])).toBeNull();
    expect(waitingNames(["A", "B", "C", "D"])).toBeNull();
    expect(waitingNames(["A", " "])).toBeNull();
  });
  it("names one, two or three placeholder works — never the ones in Itu's own words", () => {
    expect(note([w("Placeholder Work One"), w("Mine", false)])).toBe("Placeholder Work One waits for your manuscript");
    expect(note([w("Placeholder Work One"), w("Placeholder Work Two")])).toBe("Placeholder Work One and Placeholder Work Two wait for your manuscripts");
    expect(note([w("Placeholder Work One"), w("Placeholder Work Two"), w("Placeholder Work Three")])).toBe("Placeholder Work One, Placeholder Work Two and Placeholder Work Three wait for your manuscripts");
  });
  it("four or more keep the count; none says every work is in his own words", () => {
    expect(note([w("A"), w("B"), w("C"), w("D")])).toBe("works wait for your manuscripts");
    expect(note([w("A", false)])).toBe("every work is in your own words");
  });
  it("still leads to the shelf list", () => {
    expect(glance([w("A")], 0, 1).find((x) => x.label === "Still placeholder")!.href).toBe("#shelves");
  });
});
