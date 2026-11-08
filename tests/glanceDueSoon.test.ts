import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { glance } from "@/lib/glance";

const w = (openLoans: number) => ({ visibility: "members" as const, words: 10, openLoans });
const loansTile = (t: ReturnType<typeof glance>) => {
  const x = t.find((y) => y.label === "Out on loan now")!;
  return { ...x, note: x.urgentNote ? `${x.note} · ${x.urgentNote}` : x.note };
};

describe("Writer's Room loans tile — due back within the day (C122)", () => {
  it("adds the count after the open loans", () => {
    expect(loansTile(glance([w(2), w(1)], 0, 3, 2)).note).toBe("3 open loans · 2 due back within the day");
    expect(loansTile(glance([w(1)], 0, 3, 1)).note).toBe("1 open loan · 1 due back within the day");
  });
  it("keeps the plain note when nothing is due soon (or the count is missing)", () => {
    expect(loansTile(glance([w(2)], 0, 3, 0)).note).toBe("2 open loans");
    expect(loansTile(glance([w(2)], 0, 3)).note).toBe("2 open loans");
    expect(loansTile(glance([w(0)], 0, 3, 0)).note).toBe("every book is in");
  });
  it("never says more are due than are out", () => {
    expect(loansTile(glance([w(1)], 0, 3, 4)).note).toBe("1 open loan · 1 due back within the day");
    expect(loansTile(glance([w(0)], 0, 3, 2)).note).toBe("every book is in");
  });
  it("is a count only: library mode asks for a head count of open loans in the next day, preview reads the cookie desk", () => {
    const src = readFileSync("lib/writersRoom.ts", "utf8");
    expect(src).toMatch(/from\("loans"\)\.select\("id", \{ count: "exact", head: true \}\)\.is\("returned_at", null\)/);
    expect(src).toMatch(/\.gt\("due_at"[\s\S]*?\.lte\("due_at"/);
    expect(src).toMatch(/dueBackSoon\(out, Date\.now\(\)\)\.length/);
    expect(readFileSync("app/writers-room/page.tsx", "utf8")).toMatch(/room\.dueSoon[,)]/);
  });
});

describe("Writer's Room loans tile — the due part in ember (C128)", () => {
  it("keeps the due count apart from the plain note", () => {
    const t = glance([w(3)], 0, 3, 2).find((x) => x.label === "Out on loan now")!;
    expect(t).toMatchObject({ note: "3 open loans", urgentNote: "2 due back within the day" });
    expect(glance([w(3)], 0, 3, 0).find((x) => x.label === "Out on loan now")!.urgentNote).toBeUndefined();
  });
  it("the room shows it in ember after the note", () => {
    expect(readFileSync("app/writers-room/page.tsx", "utf8")).toMatch(/\{t\.urgentNote && <span className="text-ember"> · \{t\.urgentNote\}<\/span>\}/);
  });
});

describe("Writer's Room loans tile — returned in the last hour (C136)", () => {
  it("adds the count to the plain note, with or without loans out", () => {
    expect(glance([w(2)], 0, 3, 0, 1).find((x) => x.label === "Out on loan now")!.note).toBe("2 open loans · 1 returned in the last hour");
    expect(glance([w(0)], 0, 3, 0, 3).find((x) => x.label === "Out on loan now")!.note).toBe("every book is in · 3 returned in the last hour");
    expect(glance([w(2)], 0, 3, 1, 1).find((x) => x.label === "Out on loan now")).toMatchObject({ note: "2 open loans · 1 returned in the last hour", urgentNote: "1 due back within the day" });
  });
  it("library mode reads return times only (no reader, no work) and keeps the handed-back rule", () => {
    const src = readFileSync("lib/writersRoom.ts", "utf8");
    expect(src).toContain('supabase.from("loans").select("returned_at, due_at").gte("returned_at"');
    expect(src).toMatch(/justReturned\(\{ returnedAt: Date\.parse\(r\.returned_at\), onTime: Date\.parse\(r\.returned_at\) < Date\.parse\(r\.due_at\) \}, nowMs\)/);
    expect(readFileSync("app/writers-room/page.tsx", "utf8")).toContain("room.dueSoon, room.returnedHour");
  });
});

describe("Writer's Room loans tile — borrowed in the last hour (C139)", () => {
  it("adds the count before the returned count", () => {
    expect(glance([w(2)], 0, 3, 0, 0, 1).find((x) => x.label === "Out on loan now")!.note).toBe("2 open loans · 1 borrowed in the last hour");
    expect(glance([w(2)], 0, 3, 0, 1, 2).find((x) => x.label === "Out on loan now")!.note).toBe("2 open loans · 2 borrowed in the last hour · 1 returned in the last hour");
  });
  it("library mode asks for a head count of the last hour's borrowing; preview reads the cookie desk", () => {
    const src = readFileSync("lib/writersRoom.ts", "utf8");
    expect(src).toContain('supabase.from("loans").select("id", { count: "exact", head: true }).gt("borrowed_at"');
    expect(src).toContain("borrowedHour: out.filter((l) => justBorrowed(l, Date.now())).length,");
    expect(readFileSync("app/writers-room/page.tsx", "utf8")).toContain("room.returnedHour, room.borrowedHour");
  });
});
