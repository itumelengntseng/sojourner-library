// QA sweep: every route at phone and desktop widths — accessibility (axe, WCAG 2.1 AA),
// sideways overflow, and console errors. Usage: npm run build && npx next start -p 3200 & npm run qa
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Playwright is not a project dependency: use the machine's install (`npm i -g playwright` locally).
const { chromium } = require("playwright");
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.QA_BASE ?? "http://localhost:3200";
const WIDTHS = [375, 1280];

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

// Borrow a book first so the reading room and a full ledger are reachable.
await page.goto(`${BASE}/works/placeholder-work-one`);
await page.getByRole("button", { name: "Borrow this work" }).click();
await page.getByRole("link", { name: "Open the reading room" }).waitFor();

const routes = ["/", "/halls", "/halls?canon=all", "/halls?q=two", "/halls?sort=title", "/halls?q=placeholder&sort=recent", "/halls?q=zzzz", "/halls?q=chapter+5", "/writers-room?find=two", "/pitch-room?find=two", "/halls?q=three", "/card", "/works/placeholder-work-one", "/works/placeholder-work-one/read",
  "/works/placeholder-work-three/read", "/works/placeholder-work-one/proof", "/works/placeholder-work-one/proof?ch=2", "/works/placeholder-work-one/read?ch=2", "/ledger", "/ledger?history=all", "/lineage", "/lineage?canon=all", "/timeline", "/timeline?canon=all", "/writers-room", "/writers-room/atlas", "/pitch-room", "/pitch-room/placeholder-work-one", "/pitch-room/placeholder-work-one/edit", "/p/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "/works/no-such-book"];
let failures = 0;
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  for (const route of routes) {
    errors.length = 0;
    await page.goto(BASE + route);
    await page.waitForTimeout(400);
    await page.evaluate(axeSource);
    const result = await page.evaluate(async () =>
      // eslint-disable-next-line no-undef
      await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] }));
    const bad = result.violations.filter((v) => ["serious", "critical"].includes(v.impact));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const problems = [
      ...bad.map((v) => `axe ${v.impact}: ${v.id} — ${v.help} (${v.nodes.length}× e.g. ${v.nodes.slice(0, 9).map((n) => n.target.join(" ")).join(", ")})`),
      ...(overflow > 0 ? [`page scrolls sideways by ${overflow}px`] : []),
      ...errors.filter((e) => !/404/.test(e)).map((e) => `console: ${e}`),
    ];
    failures += problems.length;
    console.log(`${problems.length ? "✗" : "✓"} ${width}px ${route}`);
    for (const p of problems) console.log(`    ${p}`);
  }
}
// The reading room in every theme and layout, with a highlight and a note on the page.
await page.setViewportSize({ width: 375, height: 900 });
for (const settings of [{ theme: "sepia" }, { theme: "light" }, { theme: "dark", layout: "paged" }]) {
  errors.length = 0;
  await page.goto(`${BASE}/works/placeholder-work-one/read?ch=1`);
  await page.evaluate((s) => localStorage.setItem("soj:reader-settings", JSON.stringify({ ...s, fontSize: 19 })), settings);
  await page.evaluate(() => localStorage.setItem("soj:ann:placeholder-work-one:1", JSON.stringify({
    notes: [{ id: "n1", anchor: 0, body: "QA note", createdAt: 1 }],
    highlights: ["lamplight", "ochre", "sky"].map((c, i) => ({ id: c, start: i * 40, end: i * 40 + 30, colour: c })),
  })));
  await page.reload();
  await page.waitForTimeout(400);
  await page.evaluate(axeSource);
  const result = await page.evaluate(async () => await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] }));
  const bad = result.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const problems = [
    ...bad.map((v) => `axe ${v.impact}: ${v.id} — ${v.help} (${v.nodes.length}× e.g. ${v.nodes.slice(0, 9).map((n) => n.target.join(" ")).join(", ")})`),
    ...(overflow > 0 ? [`page scrolls sideways by ${overflow}px`] : []),
    ...errors.map((e) => `console: ${e}`),
  ];
  failures += problems.length;
  console.log(`${problems.length ? "✗" : "✓"} reading room ${JSON.stringify(settings)}`);
  for (const p of problems) console.log(`    ${p}`);
}

// The pitch sheet on paper (C16): one A4 page, no nav, footer or print button.
{
  await page.goto(`${BASE}/pitch-room/placeholder-work-one`);
  await page.emulateMedia({ media: "print" });
  const shown = await page.evaluate(() => [...document.querySelectorAll("nav, footer, button")].filter((el) => el.getClientRects().length > 0).map((el) => el.tagName.toLowerCase())); // rendered at all (a hidden parent hides it too)
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  await page.emulateMedia({ media: "screen" });
  const problems = [...shown.map((t) => `${t} still visible on paper`), ...(pages !== 1 ? [`placeholder sheet prints on ${pages} pages, expected 1`] : [])];
  failures += problems.length;
  console.log(`${problems.length ? "✗" : "✓"} pitch sheet in print`);
  for (const p of problems) console.log(`    ${p}`);
}

// Pages in a particular state (QA4): the keys card open, and a ledger with months of reading.
async function axeCheck(label) {
  await page.evaluate(axeSource);
  const result = await page.evaluate(async () => await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] }));
  const bad = result.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const problems = [
    ...bad.map((v) => `axe ${v.impact}: ${v.id} — ${v.help} (${v.nodes.length}×)`),
    ...(overflow > 0 ? [`page scrolls sideways by ${overflow}px`] : []),
    ...errors.map((e) => `console: ${e}`),
  ];
  failures += problems.length;
  console.log(`${problems.length ? "✗" : "✓"} ${label}`);
  for (const p of problems) console.log(`    ${p}`);
}
{
  errors.length = 0;
  await page.goto(`${BASE}/works/placeholder-work-one/read?ch=1`);
  await page.getByRole("button", { name: /Keys/ }).click();
  await page.locator("dialog[open]").waitFor();
  await axeCheck("reading room with the keys card open");

  errors.length = 0;
  const now = Date.now();
  const stats = [0, 35, 70, 140].map((d, i) => ({ id: `qa${i}`, slug: "placeholder-work-one", position: 1, wordsRead: 400, activeMs: (20 + i * 10) * 60000, endedAt: now - d * 86400000 }));
  await ctx.addCookies([{ name: "soj_preview_sessions", value: encodeURIComponent(JSON.stringify(stats)), url: BASE }]);
  await page.goto(`${BASE}/ledger`);
  await page.locator("#by-month").waitFor();
  await axeCheck("ledger with reading by month");

  // C34: with a book on loan and sessions recorded, the front hall shows "Continue reading".
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    errors.length = 0;
    await page.goto(`${BASE}/`);
    await page.getByRole("region", { name: "Continue reading" }).waitFor();
    await axeCheck(`${width}px front hall with continue reading`);
    errors.length = 0;
    await page.goto(`${BASE}/card`);
    await page.getByRole("region", { name: "Continue reading" }).waitFor();
    await axeCheck(`${width}px card page with continue reading`);
  }
  await page.setViewportSize({ width: 375, height: 900 });
}
// C35: the Writer's Room with a stale "last backed up" note (and its reminder) showing.
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/writers-room`);
  await page.evaluate(() => localStorage.setItem("soj:last-backup", String(Date.now() - 40 * 86400000)));
  await page.reload();
  await page.getByText("a fresh copy would be wise").waitFor();
  await axeCheck(`${width}px writer's room with a stale backup reminder`);
  await page.evaluate(() => localStorage.removeItem("soj:last-backup"));
}
await page.setViewportSize({ width: 375, height: 900 });

// QA5: the re-import preview with a title already on the shelves, the glance tiles, the
// end-of-chapter card on the last chapter, and "Recently returned" on the card.
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/writers-room`);
  await page.locator('textarea[name="manuscript"]').fill("# Placeholder Work One\n\n## Chapter 1\n\nPlaceholder text for the QA sweep.\n\n## A new chapter\n\nMore placeholder text.");
  await page.getByRole("region", { name: "Import preview" }).waitFor();
  await axeCheck(`${width}px writer's room re-import preview + glance tiles`);

  errors.length = 0;
  await page.goto(`${BASE}/works/placeholder-work-one/read?ch=2`);
  await page.getByRole("region", { name: "End of the chapter" }).waitFor();
  await axeCheck(`${width}px reading room end-of-chapter card`);
}
{
  await page.setViewportSize({ width: 375, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/works/placeholder-work-one`);
  await page.getByRole("button", { name: "Return to shelf" }).click();
  await page.getByRole("button", { name: "Return to shelf" }).waitFor({ state: "detached" });
  await page.goto(`${BASE}/card`);
  await page.getByRole("region", { name: "Recently returned" }).waitFor();
  await axeCheck("card with recently returned");
}

// C30: "Skip to the text" reaches the chapter text by keyboard, and the focus ring is timber on sepia/light.
await page.goto(`${BASE}/works/placeholder-work-one`);
if (await page.getByRole("button", { name: "Borrow this work" }).count()) {
  await page.getByRole("button", { name: "Borrow this work" }).click();
  await page.getByRole("link", { name: "Open the reading room" }).waitFor();
}
for (const theme of ["dark", "sepia", "light"]) {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${BASE}/works/placeholder-work-one/read?ch=1`);
  await page.evaluate((t) => localStorage.setItem("soj:reader-settings", JSON.stringify({ theme: t, fontSize: 19 })), theme);
  await page.reload();
  await page.waitForTimeout(300);
  let reached = false;
  for (let i = 0; i < 4 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => document.activeElement?.textContent?.trim() === "Skip to the text");
  }
  if (reached) await page.keyboard.press("Enter");
  const got = await page.evaluate(() => {
    const el = document.activeElement;
    return { id: el?.id ?? "", ring: el ? getComputedStyle(el).outlineColor : "", style: el ? getComputedStyle(el).outlineStyle : "" };
  });
  const want = theme === "dark" ? "rgb(242, 197, 124)" : "rgb(107, 68, 40)";
  const ok = reached && got.id === "chapter-text" && got.ring === want && got.style !== "none";
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} skip to the text + focus ring (${theme})${ok ? "" : ` — reached=${reached} ${JSON.stringify(got)}`}`);
}

// QA6: the work page with read ticks (sessions in the cookie) at both widths.
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  errors.length = 0;
  await ctx.addCookies([{ name: "soj_preview_sessions", value: encodeURIComponent(JSON.stringify([{ id: "qa-t", slug: "placeholder-work-one", position: 1, wordsRead: 99999, activeMs: 600000, endedAt: Date.now() - 60000 }])), url: BASE }]);
  await page.goto(`${BASE}/works/placeholder-work-one`);
  await page.getByText(/✓\s*read/).first().waitFor();
  await axeCheck(`${width}px work page with read ticks`);
}

// C49: the loan desk's "Continue at <chapter>" line (book out, read partway into chapter 2).
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/works/placeholder-work-one`);
  const borrow = page.getByRole("button", { name: "Borrow this work" });
  if (await borrow.count()) {
    await borrow.click();
    await page.getByRole("button", { name: "Return to shelf" }).waitFor();
  }
  await ctx.addCookies([{ name: "soj_preview_sessions", value: encodeURIComponent(JSON.stringify([{ id: "qa-c", slug: "placeholder-work-one", position: 2, wordsRead: 50, activeMs: 600000, endedAt: Date.now() - 60000 }])), url: BASE }]);
  await page.goto(`${BASE}/works/placeholder-work-one`);
  await page.getByText("Continue at").first().waitFor();
  await axeCheck(`${width}px work page with Continue at`);
}

// C58: the family wall with a name typed into "Find a person".
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/lineage`);
  await page.fill("#find-person", "placeholder");
  await page.getByRole("status").filter({ hasText: /match/ }).waitFor();
  await axeCheck(`${width}px family wall with Find a person`);
}

// C59: the timeline with "Find an event" typed.
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/timeline`);
  await page.fill("#find-event", "placeholder");
  await page.getByRole("status").filter({ hasText: /match/ }).waitFor();
  await axeCheck(`${width}px timeline with Find an event`);
}

// C64: "Hold the covers still" — the covers stop moving, and stay still after a reload.
{
  await page.setViewportSize({ width: 375, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/`);
  await page.getByRole("button", { name: "Hold the covers still" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Covers held still" }).waitFor();
  const still = await page.evaluate(() => getComputedStyle(document.querySelector(".scene-cover .scene-harlem")).animationName === "none");
  if (!still) { failures++; console.log("✗ covers held still after reload"); }
  await axeCheck("375px front hall with the covers held still");
  await page.getByRole("button", { name: "Covers held still" }).click();
}

// C52: the reading room's Contents open with "Go to your bookmark" (book out from the C49 check; bookmark in chapter 2).
{
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${BASE}/works/placeholder-work-one/read?ch=2`);
  await page.getByRole("button", { name: "Bookmark here" }).click();
  await page.waitForTimeout(800);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    errors.length = 0;
    await page.goto(`${BASE}/works/placeholder-work-one/read?ch=1`);
    await page.getByText("Contents", { exact: true }).click();
    await page.getByRole("link", { name: /Go to your bookmark/ }).waitFor();
    await axeCheck(`${width}px reading room Contents with Go to your bookmark`);
  }
}

// C41: the ledger with a book read to the end (a session through the last chapter).
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  errors.length = 0;
  await ctx.addCookies([{ name: "soj_preview_sessions", value: encodeURIComponent(JSON.stringify([{ id: "qa-f", slug: "placeholder-work-one", position: 6, wordsRead: 99999, activeMs: 600000, endedAt: Date.now() - 60000 }])), url: BASE }]);
  await page.goto(`${BASE}/ledger`);
  await page.getByRole("region", { name: "Read to the end" }).waitFor();
  await axeCheck(`${width}px ledger with a finished book`);
}

// QA20: the librarian's "How long is left in this book?" chip (a bookmark is set by the sweeps above),
// and "Finished" beside a returned book read to the end on the card (C70).
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/works/placeholder-work-one`);
  const chip = page.getByRole("button", { name: "How long is left in this book?" });
  if (await chip.count()) {
    await chip.click();
    await page.getByText(/to finish at your pace/).first().waitFor();
    await axeCheck(`${width}px work page with the book-left question answered`);
  } else {
    console.log(`✗ ${width}px work page: no "How long is left in this book?" chip with a bookmark`);
    failures++;
  }
}
{
  await page.setViewportSize({ width: 375, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/works/placeholder-work-one`);
  if (await page.getByRole("button", { name: "Return to shelf" }).count()) {
    await page.getByRole("button", { name: "Return to shelf" }).click();
    await page.getByRole("button", { name: "Return to shelf" }).waitFor({ state: "detached" });
  }
  await page.goto(`${BASE}/card`);
  await page.getByRole("region", { name: "Recently returned" }).getByText(/^Finished /).waitFor();
  await axeCheck("card with a finished book in recently returned");
  // QA26 (C88): the front desk counts the books read to the end and leads to that shelf.
  if (!(await page.getByText(/books? read to the end/).count()) || !(await page.locator("a[href='/ledger#finished']", { hasText: "Read to the end" }).count())) { failures++; console.log("✗ card: no 'read to the end' line"); }
  // QA25 (C84): the finished book offers its notes; in preview the file is built in the browser.
  const notesBtn = page.getByRole("region", { name: "Recently returned" }).getByRole("button", { name: /Notes for this book/ });
  if (!(await notesBtn.count())) { failures++; console.log("✗ card: no Notes for this book beside the finished returned book"); }
  else {
    const [dl] = await Promise.all([page.waitForEvent("download"), notesBtn.first().click()]);
    if (!/^sojourner-notes-placeholder-work-one-\d{4}-\d{2}-\d{2}\.md$/.test(dl.suggestedFilename())) { failures++; console.log(`✗ card notes download named ${dl.suggestedFilename()}`); }
    else console.log("✓ card: Notes for this book downloads " + dl.suggestedFilename());
    // QA28 (C94): a finished book's notes carry its Finished line under the byline.
    const md = readFileSync(await dl.path(), "utf8");
    if (md.includes("## Placeholder Work One") && !/^Finished .+ · read (in a day|over \d+ days)$/m.test(md)) { failures++; console.log("✗ card notes file: no Finished line for the finished book"); }
    else console.log(`✓ card notes file ${md.includes("## Placeholder Work One") ? "has the Finished line" : "(no notes in this book yet)"}`);
  }
  // QA28 (C93): the Finished mark says how long it took.
  if (!(await page.getByRole("region", { name: "Recently returned" }).getByText(/· read (in a day|over \d+ days)/).count())) { failures++; console.log("✗ card: Recently returned Finished mark without how long it took"); }
  // QA28 (C92): with the book back on the shelf, the ledger's Read to the end offers Borrow again.
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    errors.length = 0;
    await page.goto(`${BASE}/ledger`);
    if (!(await page.getByRole("region", { name: "Read to the end" }).getByRole("link", { name: /Borrow again/ }).count())) { failures++; console.log(`✗ ${width}px ledger Read to the end without Borrow again`); }
    await axeCheck(`${width}px ledger Read to the end with Borrow again`);
  }
  await page.setViewportSize({ width: 375, height: 900 });
}

// QA21: the halls with a book read to the end (the "read" mark and its legend, C72).
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/halls`);
  await page.getByText("marks the books you have read to the end.").waitFor();
  // QA27 (C90): the legend leads to the ledger's Read to the end shelf.
  if (!(await page.getByRole("link", { name: "read to the end" }).count())) { failures++; console.log(`✗ ${width}px halls legend without the Read to the end link`); }
  const spoken = await page.locator("a[href='/works/placeholder-work-one'] .sr-only").first().textContent();
  if (!/read this to the end on/.test(spoken ?? "")) { failures++; console.log(`✗ ${width}px halls: the finished book's spine doesn't say so to screen readers`); }
  await axeCheck(`${width}px halls with a book read to the end`);
}

// QA22: borrow again → the card's "left in this book" line (C74), and the end-of-book card with the
// Finished stamp (C75; the sessions cookie above has the last chapter read through).
{
  await page.setViewportSize({ width: 375, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/works/placeholder-work-one`);
  if (await page.getByRole("button", { name: "Borrow this work" }).count()) {
    await page.getByRole("button", { name: "Borrow this work" }).click();
    await page.getByRole("link", { name: /Open the reading room|Resume at your bookmark/ }).waitFor();
  }
  await page.goto(`${BASE}/card`);
  await page.getByRole("region", { name: "On loan now" }).getByText(/left in this book|At the end of this book/).first().waitFor();
  await axeCheck("card with time left in the book on loan");
}
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/works/placeholder-work-one/read?ch=6`);
  await page.getByRole("region", { name: "End of the chapter" }).getByText(/^Finished /).waitFor();
  // QA26 (C87): how long the book took, under the stamp.
  if (!(await page.getByRole("region", { name: "End of the chapter" }).getByText(/^Read (in a day|over \d+ days)$/).count())) { failures++; console.log(`✗ ${width}px end-of-book card without how long it took`); }
  await axeCheck(`${width}px end-of-book card with the Finished stamp`);
}

// QA23: with the book on loan again (QA22) and a bookmark, the work page desk, the ledger and the
// halls spine all say how long is left in the book (C77–C79).
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/works/placeholder-work-one`);
  await page.getByText(/left in this book|At the end of this book/).first().waitFor();
  await axeCheck(`${width}px work page desk with time left in the book`);
  errors.length = 0;
  await page.goto(`${BASE}/ledger`);
  await axeCheck(`${width}px ledger with a book on loan`);
  errors.length = 0;
  await page.goto(`${BASE}/halls`);
  const spoken = await page.locator("a[href='/works/placeholder-work-one'] .sr-only").first().textContent();
  if (!/On loan to you, due .+; (about .+ left in this book|at the end of this book)\./.test(spoken ?? "")) { failures++; console.log(`✗ ${width}px halls: the spine on loan doesn't say the time left (${spoken})`); }
  await axeCheck(`${width}px halls with the time left spoken on a spine`);
}

// C83: borrow a second book for an hour — due within the day and NOT the Continue reading book —
// so the front hall shows its "Due back soon" slip to the sweep below.
{
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${BASE}/works/placeholder-work-two`);
  if (await page.getByRole("button", { name: "Borrow this work" }).count()) {
    await page.getByRole("radio", { name: "An hour" }).check();
    await page.getByRole("button", { name: "Borrow this work" }).click();
    await page.getByRole("link", { name: /Open the reading room|Resume at your bookmark/ }).waitFor();
  }
}

// QA24: the front hall's due-soon slip with the time left in the book (C80 — the slip must show now, C83),
// and the work page's finished stamp leading to the ledger's Read to the end shelf (C82).
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/`);
  const slip = page.getByRole("complementary", { name: "Due back soon" });
  if (!(await slip.count())) { failures++; console.log(`✗ ${width}px front hall: no due-soon slip for the book due within the hour`); }
  else {
    if (!(await slip.getByRole("link", { name: "Placeholder Work Two" }).count())) { failures++; console.log(`✗ ${width}px due-soon slip doesn't list the book due within the hour`); }
    if (!(await slip.getByText(/left in this book|At the end of this book/).count())) { failures++; console.log(`✗ ${width}px due-soon slip without the time left in the book`); }
  }
  await axeCheck(`${width}px front hall with the due-soon slip`);
  errors.length = 0;
  await page.goto(`${BASE}/works/placeholder-work-one`);
  // QA26 (C86): the stamp says how long the book took.
  if (!(await page.getByRole("link", { name: /You finished this · .+ · read (in a day|over \d+ days)/ }).count())) { failures++; console.log(`✗ ${width}px work page finished stamp without how long it took`); }
  await page.getByRole("link", { name: /You finished this/ }).click();
  await page.waitForURL(/\/ledger#finished$/);
  await page.getByRole("heading", { name: "Read to the end" }).waitFor();
  // QA27 (C89, C91): the shelf offers each book's notes, and the top tile counts the finished books.
  if (!(await page.getByRole("region", { name: "Read to the end" }).getByRole("button", { name: /Notes for this book/ }).count())) { failures++; console.log(`✗ ${width}px ledger Read to the end without Notes for this book`); }
  if (!(await page.locator("a[href='#finished']").count())) { failures++; console.log(`✗ ${width}px ledger without the Read to the end tile`); }
  // QA25 (C85): the finished book says how long it took.
  if (!(await page.getByText(/· read (in a day|over \d+ days)/).count())) { failures++; console.log(`✗ ${width}px ledger Read to the end without how long it took`); }
  await axeCheck(`${width}px finished stamp → ledger Read to the end`);
}

await browser.close();
console.log(failures ? `\n${failures} problem(s)` : "\nAll clear");
process.exit(failures ? 1 : 0);
