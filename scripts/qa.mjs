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
await page.getByRole("link", { name: /^Start reading/ }).waitFor();

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
  // QA55 (C174): if the end card says how long the book was read, it's in the ledger's form (short sweep sessions may hold no active time).
  {
    const spent = await page.getByRole("region", { name: "End of the chapter" }).getByText(/^You've spent /).allTextContents();
    if (spent.length && !/^You've spent (under a minute|\d+ (h|min)( \d+ min)?) reading this book$/.test(spent[0])) { failures++; console.log(`✗ ${width}px end card: '${spent[0]}'`); }
  }
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
  await page.getByRole("link", { name: /^Start reading/ }).waitFor();
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

// C41: the ledger with a book read to the end (a session through the last chapter, just now — during the open loan, C97).
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  errors.length = 0;
  await ctx.addCookies([{ name: "soj_preview_sessions", value: encodeURIComponent(JSON.stringify([{ id: "qa-f", slug: "placeholder-work-one", position: 6, wordsRead: 99999, activeMs: 600000, endedAt: Date.now() - 1000 }])), url: BASE }]);
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
  // QA55 (C173): a returned book read in says for how long on its stamp line (a sweep's short sessions may hold no active time, so only the form is required).
  {
    const back = page.getByRole("region", { name: "Recently returned" });
    const n = await back.getByText(/ · read for /).count();
    if (n && !(await back.getByText(/ · read for (under a minute|\d+ (h|min))/).count())) { failures++; console.log("✗ card: Recently returned 'read for' is malformed"); }
    else console.log(`✓ card: Recently returned ${n ? "says how long the book was read" : "(no active time yet — no 'read for')"}`);
  }
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
    await page.getByRole("link", { name: /Start reading|Open the reading room|Resume at your bookmark/ }).waitFor();
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
  // QA45 (C144): this run's loan was taken out within the hour — the spine says so.
  if (!/ Just borrowed, .+\./.test(spoken ?? "")) { failures++; console.log(`✗ ${width}px halls: the spine on loan doesn't say just borrowed (${spoken})`); }
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
    await page.getByRole("link", { name: /Start reading|Open the reading room|Resume at your bookmark/ }).waitFor();
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
    // QA31 (C101): each slip line offers Renew → the work's loan desk.
    if (!(await slip.locator("a[href='/works/placeholder-work-two#desk']").getByText("Renew").count())) { failures++; console.log(`✗ ${width}px due-soon slip without Renew to the loan desk`); }
  }
  // QA29 (C95): the Continue reading card adds the time left in the book.
  if (!(await page.getByRole("region", { name: "Continue reading" }).getByText(/left in this book|at the end of this book/).count())) { failures++; console.log(`✗ ${width}px Continue reading card without the time left in the book`); }
  await axeCheck(`${width}px front hall with the due-soon slip`);
  // QA29 (C96): the front desk marks the loan due back within the hour.
  errors.length = 0;
  await page.goto(`${BASE}/card`);
  if (!(await page.getByRole("region", { name: "On loan now" }).getByText("Due soon").count())) { failures++; console.log(`✗ ${width}px card: no Due soon mark on the loan due within the hour`); }
  // QA30 (C100): the due-soon loan's Renew leads to its loan desk.
  const renew = page.getByRole("region", { name: "On loan now" }).getByRole("link", { name: /^Renew/ });
  if (!(await renew.count())) { failures++; console.log(`✗ ${width}px card: no Renew on the Due soon loan`); }
  await axeCheck(`${width}px card with a Due soon mark`);
  if (await renew.count()) {
    errors.length = 0;
    await renew.first().click();
    await page.waitForURL(/\/works\/placeholder-work-two#desk$/);
    await page.getByRole("button", { name: "Renew" }).waitFor();
    // QA33 (C107): the slip calls out the loan's last hour.
    if (!(await page.getByText("Due back within the hour").count())) { failures++; console.log(`✗ ${width}px work page slip without "Due back within the hour"`); }
    await axeCheck(`${width}px card Renew → the work's loan desk`);
  }
  // QA30 (C99): the halls spine of the loan due within the hour says so.
  errors.length = 0;
  await page.goto(`${BASE}/halls`);
  const soonSpine = await page.locator("a[href='/works/placeholder-work-two'] .sr-only").first().textContent();
  if (!/due back within the day/.test(soonSpine ?? "")) { failures++; console.log(`✗ ${width}px halls: the due-soon spine doesn't say so (${soonSpine})`); }
  // QA31 (C103): the due-soon band has its legend while one shows.
  if (!(await page.getByText(/marks books due back within the day/).count())) { failures++; console.log(`✗ ${width}px halls: no legend for the due-soon band`); }
  await axeCheck(`${width}px halls with a due-soon band`);
  errors.length = 0;
  await page.goto(`${BASE}/works/placeholder-work-one`);
  // QA26 (C86): the stamp says how long the book took.
  if (!(await page.getByRole("link", { name: /You finished this · .+ · read (in a day|over \d+ days)/ }).count())) { failures++; console.log(`✗ ${width}px work page finished stamp without how long it took`); }
  await page.getByRole("link", { name: /You finished this/ }).click();
  await page.waitForURL(/\/ledger#finished$/);
  await page.getByRole("heading", { name: "Read to the end" }).waitFor();
  // QA30 (C98): history titles lead to their work pages.
  if (!(await page.getByRole("region", { name: "Borrowing history" }).getByRole("link", { name: "Placeholder Work One" }).count())) { failures++; console.log(`✗ ${width}px ledger Borrowing history titles aren't links`); }
  // QA29 (C97): the loan during which the book was finished carries the stamp in Borrowing history.
  if (!(await page.getByRole("region", { name: "Borrowing history" }).getByText(/^Finished /).count())) { failures++; console.log(`✗ ${width}px ledger Borrowing history without the Finished stamp`); }
  // QA27 (C89, C91): the shelf offers each book's notes, and the top tile counts the finished books.
  if (!(await page.getByRole("region", { name: "Read to the end" }).getByRole("button", { name: /Notes for this book/ }).count())) { failures++; console.log(`✗ ${width}px ledger Read to the end without Notes for this book`); }
  if (!(await page.locator("a[href='#finished']").count())) { failures++; console.log(`✗ ${width}px ledger without the Read to the end tile`); }
  // QA25 (C85): the finished book says how long it took.
  if (!(await page.getByText(/· read (in a day|over \d+ days)/).count())) { failures++; console.log(`✗ ${width}px ledger Read to the end without how long it took`); }
  await axeCheck(`${width}px finished stamp → ledger Read to the end`);
}

// QA31 (C102): the reading room says the loan is due back within the hour, linking to the desk.
// Run after the front-hall sweep: opening the book makes it the Continue reading book,
// which then (rightly, C42) leaves the Due back soon slip.
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/works/placeholder-work-two/read`);
  const dueLine = page.getByText(/^Due back at \d\d:\d\d ·/);
  try { await dueLine.waitFor({ timeout: 5000 }); } catch { failures++; console.log(`✗ ${width}px reading room: no "Due back at" line for the loan due within the hour`); }
  if (!(await page.locator("main a[href='/works/placeholder-work-two#desk']").getByText("renew at the desk").count())) { failures++; console.log(`✗ ${width}px reading room: the due line doesn't link to the loan desk`); }
  await axeCheck(`${width}px reading room with the due-within-the-hour line`);
}

// QA32 (C104–C106): use every renewal on the hour loan, then the front desk and the reading room
// say "no renewals left" instead of sending the reader to renew.
{
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${BASE}/works/placeholder-work-two#desk`);
  for (let i = 0; i < 3; i++) {
    const btn = page.getByRole("button", { name: "Renew", exact: true });
    if (!(await btn.isEnabled())) break;
    await btn.click();
    await page.getByText(/^(\d renewals? left|No renewals left)$/).filter({ hasText: i === 2 ? "No renewals left" : `${2 - i} renewal` }).waitFor({ timeout: 10000 }).catch(() => {});
  }
  if (await page.getByRole("button", { name: "Renew", exact: true }).isEnabled()) { failures++; console.log("✗ the desk still offers Renew after three renewals"); }
  // QA34 (C110): the desk explains the greyed-out Renew.
  if (!(await page.getByText(/^No renewals left — return it by .+ and borrow it again; your bookmark is kept\.$/).count())) { failures++; console.log("✗ the desk doesn't explain a spent loan"); }
  // QA37 (C121): the line under the title says the book is out and leads to the desk.
  if (!(await page.locator("a[href='#desk']", { hasText: /On loan to you · due / }).count())) { failures++; console.log("✗ work page without the On loan to you line"); }
  // QA44 (C140): this run's loan was taken out within the hour — the line leads with "Just borrowed ·", stamp spoken.
  if (!(await page.locator("a[href='#desk']", { hasText: /^Just borrowed.* · On loan to you · due / }).locator(".sr-only", { hasText: /^Just borrowed, / }).count())) { failures++; console.log("✗ work page On loan line without Just borrowed"); }
  await axeCheck("375px work page desk with no renewals left");
}
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  errors.length = 0;
  await page.goto(`${BASE}/card`);
  const onLoan = page.getByRole("region", { name: "On loan now" });
  if (!(await onLoan.getByText(/No renewals left — return by /).count())) { failures++; console.log(`✗ ${width}px card: no "No renewals left" on the spent loan`); }
  if (await onLoan.locator("a[href='/works/placeholder-work-two#desk']").count()) { failures++; console.log(`✗ ${width}px card: still offers Renew on the spent loan`); }
  // QA43 (C137): this run's loans were taken out within the hour.
  if (!(await onLoan.locator(".sr-only", { hasText: /^Just borrowed, / }).count())) { failures++; console.log(`✗ ${width}px card: no "Just borrowed" on a loan taken out this hour`); }
  // QA46 (C148): with two or more fresh loans, the line under the heading counts them.
  if ((await onLoan.locator(".sr-only", { hasText: /^Just borrowed, / }).count()) > 1 && !(await onLoan.getByText(/^\d+ borrowed in the last hour$/).count())) { failures++; console.log(`✗ ${width}px card: no "N borrowed in the last hour" line`); }
  // QA36 (C116): the heading carries the count.
  if (!(await page.getByRole("heading", { name: /^On loan now · \d+$/ }).count())) { failures++; console.log(`✗ ${width}px card: the On loan now heading has no count`); }
  // QA38 (C124): the book handed back earlier this run reads "Just returned", stamp kept for screen readers.
  const back = page.getByRole("region", { name: "Recently returned" });
  // QA39 (C126): with two or more lines the heading carries the count.
  if ((await back.locator("li").count()) > 1 && !(await page.getByRole("heading", { name: /^Recently returned · \d+$/ }).count())) { failures++; console.log(`✗ ${width}px card: Recently returned heading has no count`); }
  if (await back.count()) {
    if (!(await back.locator("span[aria-hidden='true']", { hasText: /^Just returned$/ }).count()) || !(await back.locator(".sr-only", { hasText: /^Just returned, / }).count())) { failures++; console.log(`✗ ${width}px card: a book returned this hour doesn't read "Just returned"`); }
  }
  await axeCheck(`${width}px card with no renewals left`);
  // QA38 (C122): the Writer's Room loans tile counts the spent hour loan as due back within the day.
  errors.length = 0;
  await page.goto(`${BASE}/writers-room`);
  // QA40 (C128): the due part sits in ember. QA43 (C139): this run's borrowing is counted.
  if (!(await page.getByText(/^\d+ open loans? · \d+ borrowed in the last hour( · \d+ returned in the last hour)? · \d+ due back within the day$/).count()) || !(await page.locator("dd span.text-ember", { hasText: /^ · \d+ due back within the day$/ }).count())) { failures++; console.log(`✗ ${width}px Writer's Room loans tile doesn't count the loans due back within the day (${await page.locator("dd", { hasText: /open loan/ }).first().textContent()})`); }
  // QA51 (C163): this run's borrowing shows in the Loans this month tile (a head count only).
  if (!(await page.locator("dl div", { has: page.locator("dt", { hasText: /^Loans this month$/ }) }).getByText(/^taken out in the last 30 days( · \d+ handed back before (it was|they were) due)?$/).count())) { failures++; console.log(`✗ ${width}px Writer's Room without the Loans this month tile`); }
  await axeCheck(`${width}px Writer's Room with a loan due within the day`);
  // QA33 (C108, C109): the spine says so, and the ledger's history row too.
  errors.length = 0;
  await page.goto(`${BASE}/halls`);
  const spent = await page.locator("a[href='/works/placeholder-work-two'] .sr-only").first().textContent();
  // QA36 (C118): the out legend says how many.
  if (!(await page.getByText(/marks the (book|\d+ books) out to you( \((\d+ )?just borrowed\))? — renew or return (it|them) at the/).count())) { failures++; console.log(`✗ ${width}px halls: the out legend doesn't count the books`); }
  // QA47 (C150): this run's loans were taken out within the hour, so the legend says so.
  if (!(await page.getByText(/out to you \((\d+ )?just borrowed\) — /).count())) { failures++; console.log(`✗ ${width}px halls: the out legend doesn't note the fresh loans`); }
  if (!/no renewals left/.test(spent ?? "")) { failures++; console.log(`✗ ${width}px halls: the spent loan's spine doesn't say no renewals left (${spent})`); }
  await page.goto(`${BASE}/ledger`);
  if (!(await page.getByRole("region", { name: "Borrowing history" }).getByText(/· no renewals left/).count())) { failures++; console.log(`✗ ${width}px ledger: the open loan's row doesn't say no renewals left`); }
  if (!(await page.getByRole("region", { name: "Borrowing history" }).getByText(/· [123] renewals? left/).count())) { failures++; console.log(`✗ ${width}px ledger: no open loan with renewals left`); }
  // QA39 (C127): the book handed back this run reads "Just returned" in Borrowing history, stamp kept for screen readers.
  if (!(await page.getByRole("region", { name: "Borrowing history" }).locator(".sr-only", { hasText: /^Just returned, / }).count())) { failures++; console.log(`✗ ${width}px ledger Borrowing history without "Just returned"`); }
  // QA49 (C157): the Hours per book order toggle (two or more books read this run).
  if ((await page.locator("#hours ~ table tbody tr, section[aria-labelledby='hours'] tbody tr").count()) > 1) {
    await page.goto(`${BASE}/ledger?hours=most#hours`);
    if (!(await page.getByRole("navigation", { name: "Order hours per book" }).getByRole("link", { name: "Most hours" }).getAttribute("aria-current"))) { failures++; console.log(`✗ ${width}px ledger: Most hours order not current`); }
    // QA50 (C160, C158): the bars show under Most hours; history links keep the order.
    if (!(await page.locator("section[aria-labelledby='hours'] tbody span.bg-timber[aria-hidden='true']").count())) { failures++; console.log(`✗ ${width}px ledger: no Most hours bars`); }
    if (await page.locator("a[href*='history=all']").count() && !(await page.locator("a[href='/ledger?hours=most&history=all#history']").count())) { failures++; console.log(`✗ ${width}px ledger: Show all drops the hours order`); }
    await axeCheck(`${width}px ledger ordered by most hours`);
    // QA53 (C169): the top row wears the most read mark, and only it.
    if ((await page.locator("section[aria-labelledby='hours'] tbody tr").first().locator(".sr-only", { hasText: /^your most-read book$/ }).count()) !== 1 || (await page.locator("section[aria-labelledby='hours'] tbody .sr-only", { hasText: /^your most-read book$/ }).count()) !== 1) { failures++; console.log(`✗ ${width}px ledger: Most hours top row without (only) the most read mark`); }
    // QA52 (C166): a link to order the halls the same way.
    if (!(await page.getByRole("navigation", { name: "Order hours per book" }).locator("a[href='/halls?sort=read']", { hasText: "Order the halls the same way" }).count())) { failures++; console.log(`✗ ${width}px ledger: Most hours without the link to the halls`); }
    // QA51 (C162): the halls' "Most read by you" puts the ledger's top book first on its shelf.
    const topHref = await page.locator("section[aria-labelledby='hours'] tbody tr td a").first().getAttribute("href");
    await page.goto(`${BASE}/halls?sort=read`);
    if (!(await page.getByRole("navigation", { name: "Order the shelves" }).getByRole("link", { name: "Most read by you" }).getAttribute("aria-current"))) { failures++; console.log(`✗ ${width}px halls: Most read by you order not current`); }
    if (topHref && (await page.locator(`section:has(a[href='${topHref}']) ul > li:first-child a`).first().getAttribute("href")) !== topHref) { failures++; console.log(`✗ ${width}px halls: Most read by you doesn't put ${topHref} first on its shelf`); }
    // QA53 (C167): the top book's spine says how long the reader has read in it.
    if (topHref && !/You've read for (under a minute|\d+ (h|min))/.test((await page.locator(`a[href='${topHref}'] .sr-only`).first().textContent()) ?? "")) { failures++; console.log(`✗ ${width}px halls: Most read by you spine doesn't say the time read`); }
    // QA53 (C168): the top book's hall says how many of its works the reader has read in.
    if (topHref && !(await page.locator(`section:has(a[href='${topHref}']) > p`, { hasText: /· you've read in \d+ of \d+ here$/ }).count())) { failures++; console.log(`✗ ${width}px halls: Most read by you hall line without 'read in N of M here'`); }
    // QA52 (C164): the order is explained.
    if (!(await page.getByText(/^Ordered by your own reading time; books you haven't read in keep shelf order\.$/).count())) { failures++; console.log(`✗ ${width}px halls: Most read by you without its note`); }
    await axeCheck(`${width}px halls ordered by most read`);
    // QA54 (C170): the top book's work page says how long the reader has read in it, linked to Hours per book.
    if (topHref) {
      await page.goto(`${BASE}${topHref}`);
      if (!(await page.locator("a[href='/ledger#hours']", { hasText: /^You've read for (under a minute|\d+ (h|min)).* in this book/ }).count())) { failures++; console.log(`✗ ${width}px work page without 'You've read for … in this book'`); }
    }
    // QA54 (C172): the front hall names the most-read book after its summary.
    // (Rows reading "under a minute" may hold no active time, so only two rows with whole minutes make it certain.)
    const timed = (await page.locator("section[aria-labelledby='hours'] tbody tr td:nth-child(2)").allTextContents()).filter((t) => /\d+ (h|min)/.test(t)).length;
    await page.goto(`${BASE}/`);
    const mostHref = (await page.locator("p", { hasText: / · most read: / }).count()) ? await page.locator("p", { hasText: / · most read: / }).locator("a").first().getAttribute("href") : null;
    if ((timed >= 2 && mostHref !== topHref) || (mostHref && mostHref !== topHref)) { failures++; console.log(`✗ ${width}px front hall '· most read' is ${mostHref}, expected ${topHref}`); }
    // QA54 (C171): if that book is out, the card's On loan now line says how long it has been read.
    await page.goto(`${BASE}/card`);
    const outLi = page.getByRole("region", { name: /^On loan now/ }).locator("li", { has: page.locator(`a[href='${topHref}']`) });
    if (topHref && (await outLi.count()) && !(await outLi.getByText(/ · read for (under a minute|\d+ (h|min))/).count())) { failures++; console.log(`✗ ${width}px card On loan now without 'read for <time>'`); }
    await page.goto(`${BASE}/ledger`);
  }
  // QA44 (C141): this run's open loans were taken out within the hour — "just borrowed", stamp spoken.
  if (!(await page.getByRole("region", { name: "Borrowing history" }).locator(".sr-only", { hasText: /^Just borrowed, / }).count())) { failures++; console.log(`✗ ${width}px ledger Borrowing history without "just borrowed"`); }
  // QA37 (C120): Hours per book marks the book due within the day.
  if (!(await page.getByText(/^Due soon/).filter({ has: page.locator(".sr-only", { hasText: /back by/ }) }).count())) { failures++; console.log(`✗ ${width}px ledger Hours per book without the Due soon mark`); }
  // QA36 (C117): the spent hour loan is due within the day, so the tile says so.
  if (!(await page.locator("dl a[href='/card']", { hasText: /^due back within the day · / }).count())) { failures++; console.log(`✗ ${width}px ledger On loan tile doesn't say due back within the day`); }
  // QA35 (C113): the On loan tile leads to the front desk.
  if (!(await page.locator("dt", { hasText: /^On loan$/ }).count()) || !(await page.locator("dl a[href='/card']").count())) { failures++; console.log(`✗ ${width}px ledger without the On loan tile`); }
  await axeCheck(`${width}px ledger with renewals left on open loans`);
  // QA35 (C114): the spent loan is the Continue reading book — its stamp offers only the return.
  errors.length = 0;
  await page.goto(`${BASE}/`);
  const cont = page.getByRole("region", { name: "Continue reading" });
  if (!(await cont.getByText(/no renewals left/i).count()) || (await cont.getByText(/renew or return/i).count())) { failures++; console.log(`✗ ${width}px front hall Continue card doesn't say no renewals left`); }
  await axeCheck(`${width}px front hall with a spent Continue reading loan`);
  // QA35 (C115): the end-of-book card says the loan can't be renewed.
  errors.length = 0;
  await page.goto(`${BASE}/works/placeholder-work-two/read?ch=4`);
  if (!(await page.getByText(/No renewals left on this loan\./).count())) { failures++; console.log(`✗ ${width}px end-of-book card without "No renewals left on this loan."`); }
  await axeCheck(`${width}px end-of-book card with no renewals left`);
  // The reading room's line is worked out in the browser, so move the page's clock into the loan's last hour.
  const p2 = await page.context().newPage();
  p2.on("pageerror", (e) => errors.push(String(e)));
  await p2.clock.setFixedTime(Date.now() + 3 * 3600_000 + 40 * 60_000);
  await p2.setViewportSize({ width, height: 900 });
  await p2.goto(`${BASE}/works/placeholder-work-two/read`);
  try { await p2.getByText(/no renewals left/).waitFor({ timeout: 5000 }); } catch { failures++; console.log(`✗ ${width}px reading room: the due line doesn't say no renewals left`); }
  if (!(await p2.locator("main a[href='/works/placeholder-work-two#desk']").getByText("return at the desk").count())) { failures++; console.log(`✗ ${width}px reading room: no "return at the desk" link`); }
  // QA34 (C112): Contents stamps the loan's due time.
  await p2.getByText("Contents", { exact: true }).click();
  if (!(await p2.getByRole("navigation", { name: "Contents" }).getByText(/^Due back /).count())) { failures++; console.log(`✗ ${width}px reading room Contents without the due stamp`); }
  await p2.close();
}

// QA40 (C129): a book handed back this hour says so under its title, pointing to the desk.
await page.setViewportSize({ width: 375, height: 900 });
errors.length = 0;
await page.goto(`${BASE}/works/placeholder-work-three`);
if (await page.getByRole("button", { name: "Borrow this work" }).count()) {
  await page.getByRole("button", { name: "Borrow this work" }).click();
  await page.getByRole("button", { name: "Return to shelf" }).waitFor();
}
await page.getByRole("button", { name: "Return to shelf" }).click();
await page.getByRole("button", { name: "Return to shelf" }).waitFor({ state: "detached" });
await page.goto(`${BASE}/works/placeholder-work-three`);
if (!(await page.locator("a[href='#desk']", { hasText: /Just returned.*· borrow it again below$/ }).count())) { failures++; console.log("✗ work page without the Just returned line"); }
await axeCheck("375px work page just returned");
// QA41 (C132): its spine on the halls says so, with the lamplight tick.
errors.length = 0;
await page.goto(`${BASE}/halls`);
const spine3 = page.locator("a[href='/works/placeholder-work-three']").first();
if (!/Just returned, /.test((await spine3.locator(".sr-only").textContent()) ?? "") || !(await spine3.locator("span[title='Just returned']").count())) { failures++; console.log("✗ halls: the just-returned spine doesn't say so"); }
// QA44 (C142): the ✓ has its key.
if (!(await page.getByText(/marks (a book|the \d+ books) you returned in the last hour — borrow (it|them) again any time\./).count())) { failures++; console.log("✗ halls: no key for the just-returned ✓"); }
await axeCheck("375px halls with a just-returned spine");
// QA42 (C134, C135): the reading room gate and — with nothing else out — the ledger tile say it was just returned.
errors.length = 0;
await page.goto(`${BASE}/works/placeholder-work-three/read`);
if (!(await page.getByText("You returned this just now — borrow it again to pick up at your bookmark.").count())) { failures++; console.log("✗ reading room gate doesn't say the book was just returned"); }
await axeCheck("375px reading room gate just returned");
// QA41 (C131): a fresh visitor with nothing on loan sees the Just returned line in the front hall.
{
  const fresh = await browser.newContext({ viewport: { width: 375, height: 900 } });
  const fp = await fresh.newPage();
  await fp.goto(`${BASE}/works/placeholder-work-three`);
  await fp.getByRole("button", { name: "Borrow this work" }).click();
  await fp.getByRole("button", { name: "Return to shelf" }).click();
  await fp.getByRole("button", { name: "Return to shelf" }).waitFor({ state: "detached" });
  await fp.goto(`${BASE}/writers-room`);
  if (!(await fp.getByText(/^every book is in · 1 returned in the last hour$/).count())) { failures++; console.log("✗ Writer's Room loans tile doesn't count the book returned in the last hour"); }
  await fp.goto(`${BASE}/ledger`);
  if (!(await fp.locator("dl a[href='/works/placeholder-work-three']", { hasText: /^just returned · / }).count()) || !(await fp.locator("dd", { hasText: /^Nothing out$/ }).count())) { failures++; console.log("✗ ledger On loan tile doesn't say just returned"); }
  await fp.goto(`${BASE}/`);
  if (!(await fp.locator("main a[href='/works/placeholder-work-three#desk']", { hasText: /^borrow it again/ }).count()) || !(await fp.locator(".sr-only", { hasText: /^Just returned, / }).count())) { failures++; console.log("✗ front hall without the Just returned line"); }
  await fp.evaluate(axeSource);
  const res = await fp.evaluate(async () => await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] })); // eslint-disable-line no-undef
  const bad = res.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  if (bad.length) { failures++; console.log(`✗ 375px front hall just returned\n${bad.map((v) => `    axe ${v.impact}: ${v.id}`).join("\n")}`); } else console.log("✓ 375px front hall just returned");
  await fresh.close();
}
// QA45 (C143): a fresh visitor who borrows a book and hasn't opened it sees the Just borrowed line in the front hall.
{
  const fresh = await browser.newContext({ viewport: { width: 375, height: 900 } });
  const fp = await fresh.newPage();
  await fp.goto(`${BASE}/works/placeholder-work-two`);
  await fp.getByRole("button", { name: "Borrow this work" }).click();
  await fp.getByRole("button", { name: "Return to shelf" }).waitFor();
  await fp.goto(`${BASE}/`);
  if (!(await fp.locator("main a[href='/works/placeholder-work-two/read']", { hasText: /^open it in the reading room/ }).count()) || !(await fp.locator(".sr-only", { hasText: /^Just borrowed, / }).count())) { failures++; console.log("✗ front hall without the Just borrowed line"); }
  // QA46 (C146, C147): the ledger tile counts the fresh loan; the reading room says so before the first bookmark.
  await fp.goto(`${BASE}/ledger`);
  if (!(await fp.locator("dl a[href='/card']", { hasText: / · 1 just borrowed/ }).count())) { failures++; console.log("✗ ledger On loan tile doesn't count the book just borrowed"); }
  await fp.goto(`${BASE}/works/placeholder-work-two/read`);
  if (!(await fp.getByText(/· due back /).filter({ has: fp.locator(".sr-only", { hasText: /^Just borrowed, / }) }).first().waitFor({ timeout: 5000 }).then(() => true, () => false))) { failures++; console.log("✗ reading room without the Just borrowed line"); }
  await fp.evaluate(axeSource);
  {
    const r = await fp.evaluate(async () => await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] })); // eslint-disable-line no-undef
    const v = r.violations.filter((x) => ["serious", "critical"].includes(x.impact));
    if (v.length) { failures++; console.log(`✗ 375px reading room just borrowed\n${v.map((x) => `    axe ${x.impact}: ${x.id}`).join("\n")}`); } else console.log("✓ 375px reading room just borrowed");
  }
  await fp.goto(`${BASE}/`);
  await fp.evaluate(axeSource);
  const res = await fp.evaluate(async () => await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] })); // eslint-disable-line no-undef
  const bad = res.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  if (bad.length) { failures++; console.log(`✗ 375px front hall just borrowed\n${bad.map((v) => `    axe ${v.impact}: ${v.id}`).join("\n")}`); } else console.log("✓ 375px front hall just borrowed");
  // QA48 (C152, C153): hand it back and borrow it again — the work page counts the loans, the ledger sums the month.
  await fp.goto(`${BASE}/works/placeholder-work-two`);
  await fp.getByRole("button", { name: "Return to shelf" }).click();
  await fp.getByRole("button", { name: "Borrow this work" }).click();
  await fp.getByRole("button", { name: "Return to shelf" }).waitFor();
  await fp.goto(`${BASE}/works/placeholder-work-two`);
  if (!(await fp.getByText("You've borrowed this twice").count())) { failures++; console.log("✗ work page doesn't count a second loan"); }
  await fp.goto(`${BASE}/ledger`);
  if (!(await fp.getByText("2 loans in the last 30 days · 1 handed back before it was due").count())) { failures++; console.log("✗ ledger Borrowing history without the 30-day line"); }
  // QA49 (C155, C156): the work page dates the first loan; the card counts the loans of a returned book.
  await fp.goto(`${BASE}/works/placeholder-work-two`);
  if (!(await fp.getByText(/^You've borrowed this twice · first on \d{2} \w{3} \d{4}/).count())) { failures++; console.log("✗ work page borrowed-times line without its first date"); }
  // QA50 (C159): it leads to the ledger's Borrowing history.
  if (!(await fp.locator("a[href='/ledger#history']", { hasText: /^You've borrowed this twice/ }).count())) { failures++; console.log("✗ work page borrowed-times line doesn't link to the history"); }
  await fp.getByRole("button", { name: "Return to shelf" }).click();
  await fp.getByRole("button", { name: "Borrow this work" }).waitFor();
  await fp.goto(`${BASE}/card`);
  if (!(await fp.getByRole("region", { name: "Recently returned" }).locator("a[href='/ledger#history']", { hasText: /^borrowed 2 times/ }).count())) { failures++; console.log("✗ card Recently returned without a 'borrowed 2 times' link to the history (C156/C161)"); }
  // QA52 (C165): this browser's two loans both came back early — the Writer's Room tile says so (preview counts the cookie desk).
  await fp.goto(`${BASE}/writers-room`);
  if (!(await fp.getByText(/^taken out in the last 30 days · 2 handed back before they were due$/).count())) { failures++; console.log(`✗ Writer's Room Loans this month without '2 handed back before they were due'`); }
  await fp.goto(`${BASE}/card`);
  await fp.evaluate(axeSource);
  {
    const r = await fp.evaluate(async () => await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] })); // eslint-disable-line no-undef
    const v = r.violations.filter((x) => ["serious", "critical"].includes(x.impact));
    if (v.length) { failures++; console.log(`✗ 375px card borrowed twice\n${v.map((x) => `    axe ${x.impact}: ${x.id}`).join("\n")}`); } else console.log("✓ 375px card borrowed twice");
  }
  await fresh.close();
}

await browser.close();
console.log(failures ? `\n${failures} problem(s)` : "\nAll clear");
process.exit(failures ? 1 : 0);
