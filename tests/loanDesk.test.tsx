import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { borrow, type Loan } from "@/lib/engine/checkout";
import {
  deskBorrow, deskRenew, deskReturn, openLoan, parsePreviewLoans, PERIODS, serializePreviewLoans,
  rowToLoan, settleExpired, slipFor, stampDate, timeLeft,
} from "@/lib/loanDesk";
import { DueDateSlip } from "@/components/DueDateSlip";

const H = 3600_000;
const T0 = Date.UTC(2026, 10, 6, 8, 0); // Fri 6 Nov 2026, 10:00 in Johannesburg
const base = { workId: "placeholder-work-one", readerId: "r" };
const fresh = (period: Loan["period"] = "hour", now = T0) => borrow({ id: "L1", ...base, period, now }, []);

describe("date stamps", () => {
  it("stamps in South African time", () => {
    expect(stampDate(T0)).toMatch(/Fri.*6.*Nov.*10:00/);
  });
  it("speaks time left plainly", () => {
    expect(timeLeft(30_000)).toBe("under a minute");
    expect(timeLeft(45 * 60_000)).toBe("45 min");
    expect(timeLeft(4 * H)).toBe("4 h");
    expect(timeLeft(27 * H)).toBe("1 day 3 h");
    expect(timeLeft(72 * H)).toBe("3 days");
  });
  it("offers the four loan periods", () => {
    expect(PERIODS.map((p) => p.id)).toEqual(["hour", "evening", "three_days", "two_weeks"]);
  });
});

describe("the slip", () => {
  it("shows an active loan with renewals left", () => {
    const s = slipFor(fresh("evening"), T0 + H);
    expect(s.status).toBe("active");
    expect(s.timeLeft).toBe("3 h");
    expect(s.canRenew && s.canReturn).toBe(true);
    expect(s.renewalsLeft).toBe(3);
  });
  it("warns when due soon", () => {
    const s = slipFor(fresh(), T0 + 50 * 60_000);
    expect(s.status).toBe("due_soon");
    expect(s.headline).toMatch(/very soon/);
  });
  it("puts an expired loan back on the shelf, no renewing", () => {
    const s = slipFor(fresh(), T0 + 2 * H);
    expect(s.status).toBe("expired");
    expect(s.canRenew || s.canReturn).toBe(false);
    expect(s.returned).toBe(stampDate(T0 + H));
  });
  it("renders with authorship and stamps", () => {
    const html = renderToStaticMarkup(<DueDateSlip slip={slipFor(fresh(), T0 + 10 * 60_000)} title="Placeholder Work One" />);
    expect(html).toContain("Itumeleng Ntseng");
    expect(html).toContain("Date due");
    expect(html).toContain("Due back");
    expect(html).toContain("50 min left");
  });
});

describe("return to shelf on expiry", () => {
  it("closes expired loans at their due time and leaves live ones alone", () => {
    const live = { ...fresh("two_weeks"), id: "L2", workId: "w2" };
    const out = settleExpired([fresh(), live], T0 + 2 * H);
    expect(out[0].returnedAt).toBe(T0 + H);
    expect(out[1].returnedAt).toBeNull();
  });
  it("finds no open loan once expired", () => {
    expect(openLoan([fresh()], base.workId, "r", T0 + 2 * H)).toBeUndefined();
    expect(openLoan([fresh()], base.workId, "r", T0 + 10_000)?.id).toBe("L1");
  });
});

describe("desk operations", () => {
  it("borrows, refuses a double loan, renews, returns", () => {
    let r = deskBorrow([], { id: "A", ...base, period: "hour", now: T0 });
    expect(r.ok).toBe(true);
    expect(deskBorrow(r.loans, { id: "B", ...base, period: "hour", now: T0 + 1000 }).ok).toBe(false);
    r = deskRenew(r.loans, "A", T0 + 30 * 60_000);
    expect(r.ok).toBe(true);
    expect(r.loans[0].dueAt).toBe(T0 + 2 * H);
    r = deskReturn(r.loans, "A", T0 + 40 * 60_000);
    expect(r.loans[0].returnedAt).toBe(T0 + 40 * 60_000);
    expect(r.message).toMatch(/bookmark is kept/);
  });
  it("lets you borrow again after expiry, carrying the bookmark", () => {
    const old = { ...fresh(), bookmark: { chapterIndex: 2, wordOffset: 900 } };
    const r = deskBorrow([old], { id: "N", ...base, period: "evening", now: T0 + 3 * H });
    expect(r.ok).toBe(true);
    const n = r.loans.find((l) => l.id === "N")!;
    expect(n.bookmark.wordOffset).toBe(900);
    expect(r.loans.find((l) => l.id === "L1")!.returnedAt).toBe(T0 + H);
  });
  it("won't renew an expired loan", () => {
    const r = deskRenew([fresh()], "L1", T0 + 2 * H);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/back on the shelf/);
  });
  it("stops after three renewals", () => {
    let loans = [fresh("two_weeks")];
    for (let i = 0; i < 3; i++) loans = deskRenew(loans, "L1", T0).loans;
    const r = deskRenew(loans, "L1", T0);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/limit/);
  });
});

describe("preview desk cookie", () => {
  it("round-trips loans", () => {
    const loans = [fresh()];
    expect(parsePreviewLoans(serializePreviewLoans(loans))).toEqual(loans);
  });
  it("drops anything malformed or tampered", () => {
    expect(parsePreviewLoans("not json")).toEqual([]);
    expect(parsePreviewLoans(JSON.stringify({ a: 1 }))).toEqual([]);
    expect(parsePreviewLoans(JSON.stringify([{ ...fresh(), period: "forever" }, fresh()]))).toHaveLength(1);
  });
});

describe("database rows", () => {
  it("map onto engine loans", () => {
    const l = rowToLoan({
      id: "x", reader_id: "r", work_id: "w", period: "hour", borrowed_at: "2026-11-06T08:00:00Z",
      due_at: "2026-11-06T09:00:00Z", returned_at: null, renewals: 1, bookmark_offset: 40,
    });
    expect(l.dueAt - l.borrowedAt).toBe(H);
    expect(l.returnedAt).toBeNull();
    expect(l.bookmark.wordOffset).toBe(40);
  });
});
