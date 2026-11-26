// WEB-NF3-NAKON (NF-3 PR-13 to PR-16): the withdrawal with its reason, deadline and next step; the note
// beside a submitted declaration; "Moje predaje"; the request for revision on the steps. The server is
// the VIZ "puno" scenario over the contract's vectors, with a few answers set per test; every person,
// text and identifier is invented.
import { axe, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1, T3 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

type Answers = {
  withdrawal?: unknown;
  history?: (body: Record<string, unknown>) => unknown;
  revision?: unknown;
};

const REVISION = (targetId: string) => ({
  notifications: [{
    id: "00000000-0000-4000-8000-000000001711", targetId, documentId: "izmisljeni-rad-1",
    comment: "Izmišljeni komentar: doradite uvod i ispravite navode.", revisionDueAt: "2026-12-15T12:00:00.000Z",
    createdAt: "2026-11-04T09:00:00.000Z", readAt: null,
  }],
  nextBefore: null,
});

async function student(page: Page, answers: Answers = {}) {
  const server = generatedServer("puno");
  // After a recorded withdrawal the server no longer offers one (nothing is submitted).
  let withdrawn = false;
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "POST" && path.endsWith("/submission/withdrawal")) withdrawn = true;
    if (req.method() === "GET" && path.endsWith("/submission/withdrawal") && answers.withdrawal !== undefined) {
      return route.fulfill({ json: withdrawn ? { withdrawable: false, receipts: [] } : answers.withdrawal });
    }
    if (req.method() === "GET" && path === "/api/v1/notifications/returned-for-revision" && answers.revision !== undefined) return route.fulfill({ json: answers.revision });
    if (req.method() === "POST" && path === "/api/v1/student/submission-notes") {
      const { text } = req.postDataJSON() as { text: string };
      return route.fulfill({ status: 201, json: { id: "00000000-0000-4000-8000-0000000001aa", text, createdAt: "2026-11-05T22:00:00.000Z" } });
    }
    const result = server.answer("student", req.method(), path);
    if (result === "hang") return undefined;
    if (req.method() === "GET" && path.endsWith("/submission/history") && answers.history !== undefined && typeof result === "object") {
      return route.fulfill({ status: 200, json: answers.history(JSON.parse(String(result.body)) as Record<string, unknown>) });
    }
    return route.fulfill(result);
  });
}

const main = (page: Page) => page.locator("main");
const WITHDRAWABLE = { withdrawable: true, receipts: [] };

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`PR-13, PR-15: withdrawal with its deadline, the dialog, what comes next, and „Moje predaje” (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await student(page, { withdrawal: WITHDRAWABLE });
      await page.goto(`/aplikacija/rad/${T3}/predaja/potvrda`);
      await setTheme(page, theme);
      await expect(main(page).getByText(/^Dok rok traje, predaju možete povući i predati ponovno\. Rok: \d{1,2}\. \d{1,2}\. \d{4}\. u \d{2}:\d{2}\.$/)).toBeVisible();
      // PR-15: the contract's history, newest first: the one in force and the withdrawn one.
      const list = main(page).getByTestId("my-submissions");
      await expect(main(page).getByRole("heading", { name: "Moje predaje" })).toBeVisible();
      await expect(list.locator("> li")).toHaveCount(2);
      await expect(list.locator("> li").first()).toContainText("Predaja 2 · ");
      await expect(list.locator("> li").first()).toContainText("Trenutno važeća predaja.");
      await expect(list.locator("> li").nth(1)).toContainText(/Povučena \d{1,2}\. \d{1,2}\. \d{4}\. u \d{2}:\d{2}\./);
      await expect(list.getByRole("button", { name: "Preuzmi potvrdu povlačenja predaje 1" })).toBeVisible();
      await axe(page, info, `povlacenje-moguce-${width}-${theme}`);
      // PD-11 by keyboard: the dialog names the deadline; the withdrawal answers with E-11e.
      const ask = main(page).getByRole("button", { name: "Povuci predaju" });
      await ask.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Povući predaju?" });
      await expect(dialog).toContainText(/Dok rok traje, rad možete ponovno mijenjati i predati iznova\. Rok: /);
      await axe(page, info, `povlacenje-dijalog-${width}-${theme}`);
      await dialog.getByRole("button", { name: "Povuci predaju" }).focus();
      await page.keyboard.press("Enter");
      await expect(main(page).getByRole("heading", { name: "Predaja je povučena" })).toBeVisible();
      await expect(main(page).getByRole("status").filter({ hasText: "Predaja je povučena. Potvrdu povlačenja možete preuzeti." })).toBeVisible();
      await expect(main(page).getByText(/^Rad možete ponovno mijenjati do .+\. Zatim ga predajte iznova\.$|^Rok je istekao /)).toBeVisible();
      await expect(main(page).getByRole("link", { name: "Otvori radni prostor" }).last()).toHaveAttribute("href", `/aplikacija/rad/${T3}`);
      await expect(main(page).getByText("Nastavnik u povijesti vidi i predaju i povlačenje.")).toBeVisible();
      // The sticky step bar covers the receipt's upper links at this scroll (frame, VIZ-S1, outside this lane):
      // axe counts a covered link as too small, so the check runs from the top of the page.
      await page.evaluate(() => window.scrollTo(0, 0));
      await axe(page, info, `povuceno-${width}-${theme}`);
    });
  }
}

test("PR-13: a withdrawal switched off says that the teacher or the faculty does not allow it", async ({ page }, info) => {
  await student(page, { withdrawal: { withdrawable: false, receipts: [] }, history: (body) => ({ ...body, withdrawalAllowed: false }) });
  await page.goto(`/aplikacija/rad/${T3}/predaja/potvrda`);
  await expect(main(page).getByText("Nastavnik ili fakultet ne dopušta povlačenje za ovaj zadatak.")).toBeVisible();
  await expect(main(page).getByRole("button", { name: "Povuci predaju" })).toHaveCount(0);
  await axe(page, info, "povlacenje-iskljuceno");
});

test("PR-15: a history that cannot be read is said so, not shown as empty", async ({ page }) => {
  await student(page, { withdrawal: WITHDRAWABLE });
  await page.route("**/api/v1/student/assignments/*/submission/history", (route) =>
    route.fulfill({ status: 503, json: { error: "unavailable", code: "unavailable", messageKey: "errors.unavailable", status: 503, requestId: "00000000-0000-4000-8000-000000000000" } }));
  await page.goto(`/aplikacija/rad/${T3}/predaja/potvrda`);
  await expect(main(page).getByRole("alert").filter({ hasText: "Popis predaja trenutačno nije moguće učitati." })).toBeVisible();
});

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`PR-14: beside a submitted declaration, a note to it, tagged for legal review (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await student(page);
      await page.goto(`/aplikacija/rad/${T3}/predaja/izjava`);
      await setTheme(page, theme);
      await expect(main(page).getByText(/Izjava je predana s radom i više se ne mijenja\./)).toBeVisible();
      const section = main(page).locator("section").filter({ has: page.getByRole("heading", { name: "Ispravak izjave" }) });
      await expect(section).toContainText("za pravni pregled");
      await expect(section).toContainText("Tekst ovog odjeljka čeka pravni pregled.");
      await expect(section.getByRole("link", { name: "Povlačenje predaje" })).toHaveAttribute("href", `/aplikacija/rad/${T3}/predaja/potvrda`);
      await axe(page, info, `ispravak-izjave-${width}-${theme}`);
      const open = section.getByRole("link", { name: "Dodaj napomenu uz izjavu" });
      await open.focus();
      await page.keyboard.press("Enter");
      const field = section.getByRole("textbox", { name: /Napomena uz izjavu/ });
      await expect(field).toBeFocused();
      await page.keyboard.type("Izmišljeno: izostavio sam alat za provjeru pravopisa.");
      await section.getByRole("button", { name: "Dodaj napomenu" }).click();
      await expect(section.getByRole("status")).toHaveText("Napomena uz izjavu je dodana.");
      await expect(section).toContainText("Izmišljeno: izostavio sam alat za provjeru pravopisa.");
      await axe(page, info, `ispravak-izjave-dodano-${width}-${theme}`);
    });
  }
}

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`PR-16: the request for revision on the steps, with its deadline, comment and an unavailable „Pošalji doradu” (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await student(page, { revision: REVISION(T1) });
      for (const step of ["izjava", "pregled", "slanje"] as const) {
        await page.goto(`/aplikacija/rad/${T1}/predaja/${step}`);
        await setTheme(page, theme);
        const block = main(page).locator("section").filter({ has: page.getByRole("heading", { name: "Rad je kod Vas: dorada" }) });
        await expect(block).toContainText("Dorada do 15. 12. 2026. u 13:00");
        await expect(block).toContainText("Izmišljeni komentar: doradite uvod i ispravite navode.");
        await expect(block.getByRole("button", { name: "Pošalji doradu" })).toHaveAttribute("aria-disabled", "true");
        await expect(block).toContainText("Slanje dorade trenutačno nije dostupno.");
        if (step === "izjava") await expect(block).toContainText("Prije predaje dorade pregledajte izjavu");
        await axe(page, info, `dorada-${step}-${width}-${theme}`);
      }
    });
  }
}

test("PR-16: without a request for this work the steps show no revision block", async ({ page }) => {
  await student(page, { revision: REVISION("00000000-0000-4000-8000-0000000000ff") });
  await page.goto(`/aplikacija/rad/${T1}/predaja/izjava`);
  await expect(main(page).getByRole("list", { name: "Koraci predaje" })).toBeVisible();
  await expect(main(page).getByRole("heading", { name: "Rad je kod Vas: dorada" })).toHaveCount(0);
});

// PRE-R05 (PRE-37): the whole resubmission on the "puno" server's own state, no answer faked: submit, withdraw,
// the work open for writing again, submit a second time; the second receipt and two rows in „Moje predaje”.
const pressOn = async (page: Page, name: string) => {
  const button = main(page).getByRole("button", { name, exact: true });
  await expect(button).not.toHaveAttribute("aria-disabled", "true");
  await button.focus();
  await page.keyboard.press("Enter");
};
const submitFromLastStep = async (page: Page) => {
  await page.goto(`/aplikacija/rad/${T1}/predaja/slanje`);
  await pressOn(page, "Predaj rad");
  await page.getByRole("dialog", { name: "Predati rad?" }).getByRole("button", { name: "Predaj rad" }).click();
  await expect(page).toHaveURL(new RegExp(`/rad/${T1}/predaja/potvrda(\\?|$)`));
};

test("PRE-R05: withdrawal, the work writable again, a second submission: a new receipt and two rows in „Moje predaje”", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const server = generatedServer("puno");
  const calls: string[] = [];
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "POST") calls.push(path);
    const result = server.answer("student", req.method(), path, req.postData());
    return result === "hang" ? undefined : route.fulfill(result);
  });
  const list = main(page).getByTestId("my-submissions");

  // First submission: one receipt, one row in force.
  await submitFromLastStep(page);
  await expect(main(page).getByText("Predano 5. 11. 2026. u 23:59", { exact: true })).toBeVisible();
  await expect(list.locator("> li")).toHaveCount(1);
  await expect(list.locator("> li").first()).toContainText("Trenutno važeća predaja.");

  // Withdrawal: the page says what comes next and offers the work again.
  await pressOn(page, "Povuci predaju");
  await page.getByRole("dialog", { name: "Povući predaju?" }).getByRole("button", { name: "Povuci predaju" }).click();
  await expect(main(page).getByRole("heading", { name: "Predaja je povučena" })).toBeVisible();
  await expect(list.locator("> li")).toHaveCount(1);
  await expect(list.locator("> li").first()).toContainText("Predaja 1 · ");
  await expect(list.locator("> li").first()).toContainText(/Povučena \d{1,2}\. \d{1,2}\. \d{4}\. u \d{2}:\d{2}\./);

  // The editor is open for writing again.
  await main(page).getByRole("link", { name: "Otvori radni prostor" }).last().click();
  await expect(page).toHaveURL(new RegExp(`/rad/${T1}(\\?|$)`));
  await expect(page.locator('.ProseMirror[contenteditable="true"]')).toBeVisible();

  // Second submission: a new receipt, the earlier one withdrawn, the new one in force.
  await submitFromLastStep(page);
  await expect(main(page).getByText("Predano 5. 11. 2026. u 23:59", { exact: true })).toBeVisible();
  await expect(main(page).getByRole("button", { name: "Povuci predaju", exact: true })).toBeVisible();
  await expect(list.locator("> li")).toHaveCount(2);
  await expect(list.locator("> li").first()).toContainText("Predaja 2 · ");
  await expect(list.locator("> li").first()).toContainText("Trenutno važeća predaja.");
  await expect(list.locator("> li").nth(1)).toContainText("Predaja 1 · ");
  await expect(list.locator("> li").nth(1)).toContainText(/Povučena /);
  expect(calls.filter((c) => c.endsWith("/submission/withdrawal"))).toHaveLength(1);
  await axe(page, info, "ponovna-predaja");
});
