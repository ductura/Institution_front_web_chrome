// ED-14 (NF2-P7, P2-10a): "Brzi izvor" looks a DOI or an ISBN up over the server, `sources.lookup.post`.
// Invented assignment, invented server: only the identifier leaves the browser, the form is filled and the
// student checks it before saving; not found, a refused identifier, an unavailable lookup and no network each
// say what to do next.
import { axe, hiddenFocus, setTheme } from "./a11y/check";

import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c14";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d14";
const PATH = `/aplikacija/rad/${ID}`;
const DOI = "10.1234/izmisljeno.2026.7";

const notice = {
  assignmentId: ID, versionNo: 1, templateVersion: 1, title: "Izmišljeni esej o čitanju naglas",
  instructions: "Opišite izmišljeno čitanje.", workType: "essay", opensAt: "2025-11-02T08:00:00.000Z",
  dueAt: "2099-12-15T22:59:00.000Z", aiPolicy: "not_allowed", aiPurposes: [], evidenceProfile: "basic",
  wordMin: 500, wordMax: 1500, readAt: null, acknowledgedAt: "2025-11-03T09:20:00.000Z",
};

const article = {
  type: "article", title: "Izmišljeni članak o čitanju naglas",
  authors: [{ name: "Horvat, Ivana", family: "Horvat", given: "Ivana" }],
  year: 2021, journal: "Izmišljeni časopis", volume: "12", issue: "3", pages: "45-60",
};

type Reply = { status: number; json: unknown };

async function server(page: Page, replies: Reply[]) {
  const bodies: unknown[] = [];
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: "e".repeat(64), sessionTag: "izmisljena-oznaka-0014" },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: notice.title, dueAt: notice.dueAt, noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
  await page.route(`**/api/v1/student/assignments/${ID}/notice`, (route) => route.fulfill({ json: notice }));
  await page.route("**/api/v1/sources/lookup", async (route) => {
    bodies.push(route.request().postDataJSON());
    const reply = replies.shift() ?? { status: 200, json: { source: null } };
    await route.fulfill({ status: reply.status, json: reply.json });
  });
  return bodies;
}

async function openQuick(page: Page, replies: Reply[] = []) {
  const bodies = await server(page, replies);
  await page.goto(PATH);
  const sheet = page.locator('.ProseMirror[contenteditable="true"]').first();
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  const skip = page.getByRole("button", { name: "Preskoči vodič" });
  await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
  await sheet.click();
  await page.keyboard.insertText("@");
  await expect(page.getByRole("option", { name: /Dodaj novi izvor/ })).toBeVisible();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Brzi izvor" });
  await expect(dialog).toBeVisible();
  return { dialog, bodies };
}

for (const { width, theme } of [{ width: 1280, theme: "dark" as const }, { width: 390, theme: "light" as const }]) {
  test.describe(`ED-14 Brzi izvor ${width} px, ${theme}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("a DOI fills the form from the server; only the identifier is sent", async ({ page }, info) => {
      const { dialog, bodies } = await openQuick(page, [{ status: 200, json: { source: article } }]);
      await setTheme(page, theme);
      await expect(dialog.getByText("Poslužitelju se šalje samo taj identifikator, ne tekst rada.", { exact: false })).toBeVisible();
      const field = dialog.getByLabel("DOI, ISBN ili poveznica");
      await field.fill(`https://doi.org/${DOI}`);
      await field.press("Enter");
      await expect(page.getByRole("status").filter({ hasText: "Podaci su dohvaćeni. Provjerite ih prije spremanja." })).toBeAttached();
      expect(bodies).toEqual([{ kind: "doi", identifier: DOI }]);
      await expect(dialog.getByRole("textbox", { name: "Naslov", exact: true })).toHaveValue(article.title);
      await axe(page, info, `quick-source-found-${width}-${theme}`);
      expect(await hiddenFocus(page)).toEqual([]);
    });

    test("not found, refused, unavailable and offline each say what to do", async ({ page, context }, info) => {
      const { dialog, bodies } = await openQuick(page, [
        { status: 200, json: { source: null } },
        { status: 422, json: { error: "invalid_input" } },
        { status: 503, json: { error: "unavailable" } },
      ]);
      await setTheme(page, theme);
      const field = dialog.getByLabel("DOI, ISBN ili poveznica");
      const look = dialog.getByRole("button", { name: "Dohvati podatke" });

      await field.fill("978-0-306-40615-7");
      await look.click();
      await expect(dialog.getByText("Izvor nije pronađen, unesite ga ručno.")).toBeVisible();
      expect(bodies.at(-1)).toEqual({ kind: "isbn", identifier: "9780306406157" });

      await look.click();
      await expect(dialog.getByText("Upišite DOI (npr. 10.1234/…) ili ISBN.")).toBeVisible();

      await look.click();
      await expect(dialog.getByText("Dohvat podataka trenutačno nije dostupan. Izvor možete unijeti ručno.")).toBeVisible();
      await axe(page, info, `quick-source-unavailable-${width}-${theme}`);

      await field.fill("nešto drugo");
      await look.click();
      await expect(dialog.getByText("Upišite DOI (npr. 10.1234/…) ili ISBN.")).toBeVisible();
      expect(bodies).toHaveLength(3);

      await context.setOffline(true);
      await field.fill(DOI);
      await look.click();
      await expect(dialog.getByText("Dohvat traži vezu s mrežom. Izvor možete unijeti ručno.")).toBeVisible();
      expect(bodies).toHaveLength(3);
      await context.setOffline(false);

      await dialog.getByRole("button", { name: "Unesi ručno" }).click();
      await expect(dialog.getByRole("textbox", { name: "Naslov", exact: true })).toBeVisible();
    });
  });
}

test("keyboard only: Tab reaches the field and the lookup, Enter looks up", async ({ page }) => {
  const { dialog, bodies } = await openQuick(page, [{ status: 200, json: { source: article } }]);
  const field = dialog.getByLabel("DOI, ISBN ili poveznica");
  await field.focus();
  await page.keyboard.insertText(DOI);
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Dohvati podatke" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Podaci su dohvaćeni." })).toBeAttached();
  expect(bodies).toEqual([{ kind: "doi", identifier: DOI }]);
});
