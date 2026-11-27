// WEB-NUZ-PREDAJA-3 (NF-3 PR-4, PR-11, PR-12, PR-18): the declaration's honest empty state, the receipt that
// says what was submitted and opens the process summary, one "Sačuvaj potvrdu" with the PDF only, and the
// accessibility of the steps (axe on steps 2 to 5 and the dialog, aria-modal, the fingerprint read whole).
// The server is the VIZ "puno" scenario over the contract's vectors; every person, text and identifier is invented.
import { axe, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1, T3 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

const FORM = { formId: "test-izjava", formVersion: 1, formSha256: "a".repeat(64) };
const BASE = {
  submitted: false, currentRevision: 2, version: 4, formText: "Izmišljeni obrazac.",
  currentForm: { ...FORM, text: "Izmišljeni obrazac." }, declarationSha256: null, uploads: [],
};
const DRAFT = {
  ...BASE, state: "draft", payload: null,
  draft: {
    baseVersion: 3, revision: 2, form: FORM, ownWork: { confirmed: false }, humanHelp: { received: false, entries: [] },
    ai: { use: "not_used", declaredTools: [], attachments: [], externalAttachmentIds: [] }, confirm: false,
  },
};
// "%PDF-1.7 izmisljeno", as the contract's pattern asks (JVBERi0…).
const PDF = Buffer.from("%PDF-1.7 izmisljeno").toString("base64");

type Answers = {
  declaration?: unknown;
  pdf?: { status: number; body: unknown };
  /** F4-PRE-R02: step 2 reads the conversations from the server; the contract's "none-yet" vector (no conversations). */
  noConversations?: boolean;
};

async function student(page: Page, answers: Answers = {}) {
  const server = generatedServer("puno");
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "GET" && path.endsWith("/declaration") && answers.declaration !== undefined) return route.fulfill({ json: answers.declaration });
    if (req.method() === "GET" && path.endsWith("/assistant-conversations") && answers.noConversations) {
      return route.fulfill({ json: { assignmentId: T1, conversations: [] } });
    }
    if (req.method() === "GET" && path.endsWith("/submission/pdf") && answers.pdf !== undefined) {
      return route.fulfill({ status: answers.pdf.status, json: answers.pdf.body });
    }
    const result = server.answer("student", req.method(), path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
}

const main = (page: Page) => page.locator("main");

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`PR-4: the declaration says honestly what Ductura recorded and shows no dead element (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await student(page, { declaration: DRAFT, noConversations: true });
      await page.goto(`/aplikacija/rad/${T1}/predaja/izjava`);
      await setTheme(page, theme);
      await expect(main(page).getByText("U ovom radu nije zabilježen razgovor s Asistentom.", { exact: true })).toBeVisible();
      await expect(main(page).getByText("Ovdje se bilježi ono što napravi sama Ductura, uključujući razgovore s Asistentom. Alate izvan Ducture navedite u „Vašoj izjavi”.", { exact: true })).toBeVisible();
      await expect(main(page).getByText("Nema razgovora za prilaganje.", { exact: true })).toBeVisible();
      await expect(main(page).getByText("Dodaj objašnjenje")).toHaveCount(0);
      await expect(main(page).getByText("Pitanje nastavnika")).toHaveCount(0);
      await expect(main(page)).not.toContainText(/AI pomoćnik|model/iu);
      await axe(page, info, `izjava-prazno-${width}-${theme}`);
      // The step is worked by keyboard: "Uredi izjavu" opens the editing in place.
      const edit = main(page).getByRole("link", { name: /^(Uredi|Ispuni) izjavu$/ });
      await edit.focus();
      await page.keyboard.press("Enter");
      await expect(main(page).getByRole("link", { name: "Zatvori uređivanje" })).toHaveAttribute("aria-expanded", "true");
    });
  }
}

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`PR-11, PR-12, PR-18: the receipt says what was submitted, opens the summary and saves only the PDF (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await student(page);
      await page.goto(`/aplikacija/rad/${T3}/predaja/potvrda`);
      await setTheme(page, theme);
      const given = main(page).locator("#sb-given");
      await expect(given.getByRole("heading", { name: "Što je predano" })).toBeVisible();
      await expect(given.getByRole("listitem")).toHaveCount(4);
      await expect(given.getByRole("listitem").first()).toHaveText(/^Verzija teksta: V\d+$/);
      await expect(given.getByRole("listitem").nth(2)).toHaveText(/^Izjava: /);
      await expect(given.getByRole("listitem").nth(3)).toHaveText(/^Napomene uz rad: /);
      await expect(given).not.toContainText("%");
      const save = main(page).locator("#sb-save");
      await expect(save.getByRole("heading", { name: "Sačuvaj potvrdu" })).toBeVisible();
      await expect(save.getByText("Za Vas, mentora i osobnu pohranu: PDF s QR kodom i otiskom teksta.")).toBeVisible();
      await expect(save.getByRole("link")).toHaveText(["Preuzmi zapis (PDF s QR kodom)"]);
      // Answer 1: no package for the registrar and no portable record on the receipt.
      await expect(main(page).getByText(/Prenosivi zapis|za referadu/u)).toHaveCount(0);
      await axe(page, info, `potvrda-${width}-${theme}`);
      // PR-18: the summary opens by keyboard, comes into view with the focus on its title, and says so.
      const open = main(page).getByRole("link", { name: "Otvori sažetak procesa" });
      await open.focus();
      await page.keyboard.press("Enter");
      const heading = page.locator("#sb-sum-h");
      await expect(heading).toBeFocused();
      await expect(heading).toBeInViewport();
      await expect(main(page).getByRole("status").filter({ hasText: "Sažetak procesa je otvoren ispod." })).toBeVisible();
      await expect(main(page).getByRole("link", { name: "Zatvori sažetak procesa" })).toHaveAttribute("aria-expanded", "true");
      await axe(page, info, `potvrda-sazetak-${width}-${theme}`);
    });
  }
}

test("S-08 K1, K2: the SHA-256 fingerprint is not shown in any form; the note and the copy button stay", async ({ page }) => {
  await student(page);
  await page.goto(`/aplikacija/rad/${T3}/predaja/potvrda`);
  await expect(main(page).getByText(/[0-9a-f]{64}/)).toHaveCount(0);
  await expect(main(page).getByText(/^([0-9a-f]{4} ){15}[0-9a-f]{4}$/)).toHaveCount(0);
  await expect(main(page).getByText("Niz znakova izračunan iz točnog predanog teksta.", { exact: false })).toBeVisible();
  await expect(main(page).getByRole("button", { name: "Otisak u međuspremnik" })).toBeVisible();
});

test("S-08: the UTC block gives the receipt's times in words, not as ISO text", async ({ page }) => {
  await student(page);
  await page.goto(`/aplikacija/rad/${T3}/predaja/potvrda`);
  await main(page).getByText("Točna vremena iz potvrde (UTC)").click();
  await expect(main(page).getByText(/\d{1,2}\. [a-zšđčćž]+ 20\d\d\. u \d{2}:\d{2}/).first()).toBeVisible();
  await expect(main(page).getByText(/20\d\d-\d\d-\d\dT/)).toHaveCount(0);
});

test("PR-12: „Preuzmi zapis” saves the receipt's PDF from student.receipt-pdf.get", async ({ page }) => {
  await student(page, { pdf: { status: 200, body: { filename: "potvrda-predaje.pdf", pdfBase64: PDF } } });
  await page.goto(`/aplikacija/rad/${T3}/predaja/potvrda`);
  const download = page.waitForEvent("download");
  await main(page).getByRole("link", { name: "Preuzmi zapis (PDF s QR kodom)" }).click();
  expect((await download).suggestedFilename()).toBe("potvrda-predaje.pdf");
  await expect(main(page).getByRole("alert").filter({ hasText: "Zapis trenutačno nije moguće preuzeti." })).toHaveCount(0);
});

test("PR-12: a failed download is one alert in the prototype's words", async ({ page }, info) => {
  await student(page, { pdf: { status: 503, body: { error: "unavailable", code: "unavailable", messageKey: "errors.x", status: 503, requestId: "00000000-0000-4000-8000-000000000000" } } });
  await page.goto(`/aplikacija/rad/${T3}/predaja/potvrda`);
  await main(page).getByRole("link", { name: "Preuzmi zapis (PDF s QR kodom)" }).click();
  await expect(main(page).getByRole("alert").filter({ hasText: "Zapis trenutačno nije moguće preuzeti. Pokušajte ponovno." })).toBeVisible();
  await axe(page, info, "potvrda-preuzimanje-greska");
});

for (const width of [390, 1280]) {
  test(`PR-18: steps 2 to 4 pass axe and the dialog „Predati rad?” is modal to assistive technology (${width} px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await student(page, { declaration: DRAFT });
    for (const step of ["izjava", "pregled", "slanje"] as const) {
      await page.goto(`/aplikacija/rad/${T1}/predaja/${step}`);
      await expect(main(page).getByRole("list", { name: "Koraci predaje" })).toBeVisible();
      await axe(page, info, `korak-${step}-${width}`);
    }
  });
}

const CONFIRMED = {
  ...BASE, state: "confirmed", version: 5, draft: null, declarationSha256: "d".repeat(64),
  payload: {
    declarationSchema: "ductura-declaration-v1", declarationId: "00000000-0000-4000-8000-0000000000d1", declarationVersion: 5,
    principalId: "00000000-0000-4000-8000-0000000000e1", assignmentId: T1, assignmentVersion: 1,
    documentId: "izmisljeni-dokument-1", revision: 2, form: FORM, ownWork: { confirmed: true },
    humanHelp: { received: false, entries: [] }, ai: { use: "not_used", declaredTools: [], recorded: [], attachments: [] },
    confirmedAt: "2026-11-04T10:00:00.000000Z",
  },
};

for (const theme of ["light", "dark"] as const) {
  test(`PR-18: the dialog „Predati rad?” is aria-modal, takes the focus and passes axe (${theme})`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await student(page, { declaration: CONFIRMED });
    await page.goto(`/aplikacija/rad/${T1}/predaja/slanje`);
    await setTheme(page, theme);
    const submit = main(page).getByRole("button", { name: "Predaj rad", exact: true });
    await submit.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Predati rad?" });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog.locator(":focus")).toHaveCount(1);
    await axe(page, info, `predati-rad-dijalog-${theme}`);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
}
