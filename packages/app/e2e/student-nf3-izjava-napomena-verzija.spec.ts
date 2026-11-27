// WEB-NF3-IZJAVA (NF-3 PR-5, PR-6, PR-10, PR-17): the declaration opens as a dialog on steps 3 and 4 and a
// stale confirmation is confirmed again there; a note is added only on the server's note and a failure is
// an alert; a newer version on this device is named on step 3 before the dialog; a late submission is said
// calmly on step 3. The server is the VIZ "puno" scenario over the contract's vectors, with the
// declaration, the text and the notes set per test (PR-10: the workspace's own journal, a commit never
// answered). Every person, course, text and identifier is invented.
import { createHash } from "node:crypto";

import { axe, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

const FORM = { formId: "test-izjava", formVersion: 1, formSha256: "a".repeat(64) };
const BASE = {
  submitted: false, currentRevision: 2, formText: "Izmišljeni obrazac.",
  currentForm: { ...FORM, text: "Izmišljeni obrazac." }, uploads: [],
};
const PAYLOAD = {
  declarationSchema: "ductura-declaration-v1", declarationId: "00000000-0000-4000-8000-0000000000d1", declarationVersion: 5,
  principalId: "00000000-0000-4000-8000-0000000000e1", assignmentId: T1, assignmentVersion: 1,
  documentId: "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e", revision: 2, form: FORM, ownWork: { confirmed: true },
  humanHelp: { received: false, entries: [] }, ai: { use: "not_used", declaredTools: [], recorded: [], attachments: [] },
  confirmedAt: "2026-11-04T10:00:00.000000Z",
};
const CONFIRMED = { ...BASE, state: "confirmed", version: 5, draft: null, declarationSha256: "d".repeat(64), payload: PAYLOAD };
/** Confirmed for revision 2; the text has since reached revision 3, so the confirmation is stale. */
const STALE = { ...CONFIRMED, currentRevision: 3 };
/** The same declaration as a draft on revision 3, ready to be confirmed again. */
const REDRAFT = {
  ...BASE, currentRevision: 3, state: "draft", version: 6, payload: null, declarationSha256: null,
  draft: {
    baseVersion: 5, revision: 3, form: FORM, ownWork: { confirmed: true }, humanHelp: { received: false, entries: [] },
    ai: { use: "not_used", declaredTools: [], attachments: [], externalAttachmentIds: [] }, confirm: false,
  },
};
const RECONFIRMED = { ...CONFIRMED, currentRevision: 3, version: 7, payload: { ...PAYLOAD, revision: 3, declarationVersion: 7, confirmedAt: "2026-11-05T09:00:00.000000Z" } };

const DOCUMENT = Buffer.from(JSON.stringify({
  nodes: [{ id: "5f0c1e8a-3b7d-4c2e-9a61-0d4e8b2f7c13", type: "paragraph", children: [{ type: "text", text: "Izmišljeni tekst o mjesnim knjižnicama.", marks: [] }] }],
  schemaVersion: 1,
}));
const OPENED = {
  status: "opened", documentId: "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e", evidenceProfileId: "standard-v1", currentRevision: 2,
  documentHash: createHash("sha256").update(DOCUMENT).digest("hex"), headSegmentHash: "2".repeat(64), lastSequenceTo: 4,
  document: DOCUMENT.toString("base64"), submitted: false,
  receiptKeys: [{ algorithm: "Ed25519", keyId: "ductus-golden-rfc8032-test-1", keyVersion: "1", encoding: "spki-der",
    keyBase64Url: "MCowBQYDK2VwAyEA11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo", evidenceDomainId: "d21fe0a3-103c-42e5-a29e-c102f9030af5",
    purpose: "receipt", validFrom: "2026-01-01T00:00:00.000Z", validTo: null, revokedAt: null }],
};
const NOTE = { id: "00000000-0000-4000-8000-00000000b001", text: "Izmišljena napomena uz rad.", createdAt: "2026-11-05T10:15:00.123Z" };

type Answers = {
  /** student.declaration.get; after a confirming PUT, `after`. */
  declaration?: unknown;
  after?: unknown;
  /** student.submission-notes.post: the status it answers with (201: the note). */
  addNote?: number;
  /** The moment of the page. */
  now?: string;
  /** F4-PRE-R01: the late rule and the late exceptions answer 503, so the page does not know the rule. */
  lateUnknown?: boolean;
};

/** The "puno" student on T1, with the declaration, the text and the notes of this test. */
async function student(page: Page, answers: Answers = {}) {
  const server = generatedServer("puno");
  let declaration = answers.declaration ?? CONFIRMED;
  const notes: unknown[] = [];
  const puts: unknown[] = [];
  await page.clock.setFixedTime(new Date(answers.now ?? FIKSNI_DATUM));
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path.endsWith("/declaration")) {
      if (req.method() === "PUT") {
        puts.push(req.postDataJSON());
        declaration = answers.after ?? declaration;
      }
      return route.fulfill({ json: declaration });
    }
    if (req.method() === "POST" && path === "/api/v1/evidence/open") return route.fulfill({ json: OPENED });
    if (req.method() === "GET" && path.endsWith("/submission-notes")) return route.fulfill({ json: { notes } });
    if (answers.lateUnknown && req.method() === "GET" && /\/late-submission(-exceptions)?$/.test(path)) {
      return route.fulfill({ status: 503, json: { status: "unavailable" } });
    }
    if (req.method() === "POST" && path === "/api/v1/student/submission-notes") {
      if ((answers.addNote ?? 201) !== 201) return route.fulfill({ status: answers.addNote, json: { status: "unavailable" } });
      const note = { ...NOTE, text: (req.postDataJSON() as { text: string }).text };
      notes.push(note);
      return route.fulfill({ status: 201, json: note });
    }
    const result = server.answer("student", req.method(), path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
  return { puts };
}

const main = (page: Page) => page.locator("main");
const next = (page: Page) => main(page).getByRole("button", { name: "Dalje", exact: true });

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`PR-5: a stale declaration is one sentence on step 3 and is confirmed again in its dialog, by keyboard (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const { puts } = await student(page, { declaration: STALE, after: RECONFIRMED });
      await page.goto(`/aplikacija/rad/${T1}/predaja/pregled`);
      await setTheme(page, theme);
      const stale = "Tekst rada se promijenio nakon potvrde. Izjavu treba potvrditi ponovno.";
      await expect(main(page).getByText(stale, { exact: true })).toHaveCount(1);
      await expect(next(page)).toHaveAttribute("aria-disabled", "true");
      const open = main(page).getByRole("button", { name: "Potvrdi izjavu ponovno" });
      await open.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Izjava o korištenju generativne umjetne inteligencije" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute("aria-modal", "true");
      await expect(dialog.getByText("Po zatvaranju ostajete na istom koraku predaje.", { exact: false })).toBeVisible();
      await expect(dialog.getByRole("status").filter({ hasText: stale })).toBeVisible();
      await axe(page, info, `izjava-dijalog-${width}-${theme}`);
      await expect(dialog.getByRole("checkbox", { name: "Potvrđujem izjavu ponovno" })).toBeVisible();
      // Once the server holds it, the box is no longer "ponovno": it is found by its place, not its name.
      const box = dialog.locator("#sb-dialog-confirm");
      await box.focus();
      await page.keyboard.press("Space");
      await expect(box).toBeChecked();
      expect(puts).toHaveLength(1);
      await expect(dialog.getByRole("status").filter({ hasText: stale })).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      // The student stays on step 3, and the step reads the declaration again: "Dalje" leads on.
      await expect(page).toHaveURL(new RegExp(`/rad/${T1}/predaja/pregled$`));
      await expect(main(page).getByText(/^Potvrđena 5\. 11\. 2026\. u 10:00\.$/).first()).toBeVisible();
      await expect(next(page)).not.toHaveAttribute("aria-disabled", "true");
    });
  }
}

test("PR-5: step 4 opens the declaration as a dialog and Zatvori returns the focus to the step", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await student(page, { declaration: STALE });
  await page.goto(`/aplikacija/rad/${T1}/predaja/slanje`);
  await expect(main(page).getByRole("button", { name: "Predaj rad", exact: true })).toHaveAttribute("aria-disabled", "true");
  const open = main(page).getByRole("button", { name: "Potvrdi izjavu ponovno" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Izjava o korištenju generativne umjetne inteligencije" });
  await dialog.getByRole("button", { name: "Zatvori" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/rad/${T1}/predaja/slanje$`));
});

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`PR-6: a note is added only on the server's note and says who reads it (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await student(page);
      await page.goto(`/aplikacija/rad/${T1}/predaja/pregled`);
      await setTheme(page, theme);
      await main(page).getByRole("link", { name: "Dodaj napomenu (nije obavezna)" }).click();
      const field = page.getByLabel("Napomena uz rad (nije obavezna)");
      await expect(field).toBeFocused();
      await expect(page.getByText("Vidi je nastavnik uz sažetak.", { exact: true })).toBeVisible();
      await axe(page, info, `napomena-obrazac-${width}-${theme}`);
      await page.keyboard.type("Izmišljena napomena uz rad.");
      await page.getByRole("button", { name: "Dodaj napomenu", exact: true }).click();
      await expect(page.getByText("Napomena je dodana.", { exact: true })).toBeVisible();
      await expect(page.locator("#sb-notes").getByText(/Izmišljena napomena uz rad\./)).toBeVisible();
    });
  }
}

test("PR-6: an answer that does not add the note is an alert, and nothing is shown as added", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await student(page, { addNote: 503 });
  await page.goto(`/aplikacija/rad/${T1}/predaja/pregled`);
  await main(page).getByRole("link", { name: "Dodaj napomenu (nije obavezna)" }).click();
  await page.keyboard.type("Izmišljena napomena uz rad.");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Nije potvrđeno je li napomena dodana." })).toBeVisible();
  await expect(page.getByText("Napomena je dodana.", { exact: true })).toHaveCount(0);
  await expect(page.locator("#sb-notes").getByText("Nema napomena.", { exact: true })).toBeVisible();
  await axe(page, info, "napomena-greska-390");
});

test("PR-17: after the deadline step 3 says calmly that the submission will be marked late, and names no consequence", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await student(page, { now: "2026-11-10T12:00:00+01:00", lateUnknown: true });
  await page.goto(`/aplikacija/rad/${T1}/predaja/pregled`);
  const late = main(page).locator("#sb-late");
  await expect(late).toHaveText(/^Rok je prošao 8\. 11\. 2026\. u 23:59\. Predaja će biti označena kao predaja nakon roka;/);
  await expect(late).not.toContainText(/kazn|bodov|ocjen|sankcij/iu);
  await expect(next(page)).not.toHaveAttribute("aria-disabled", "true");
});

// PR-10: the workspace's own journal holds a change the server never confirmed (the commit is not answered).
// The fake is the shared contract one (fixtures/test) with a session that names its journal scope, as in
// save-status.spec.ts, so the workspace writes to this device's journal.
const W_ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const W_COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d1f";

async function workspace(page: Page) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: "c".repeat(64), sessionTag: "izmisljena-oznaka-prijave-nf3" },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: W_COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: W_ID, title: "Izmišljeni seminar o mjesnim knjižnicama", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: W_ID, workState: "in_progress" }] },
  }));
  await page.route("**/api/v1/student/assignments/*/declaration", (route) => route.fulfill({ json: { ...CONFIRMED, payload: { ...PAYLOAD, assignmentId: W_ID } } }));
  await page.route("**/api/v1/evidence/commit", () => { /* never answered: the change waits on this device */ });
}

for (const width of [390, 1280]) {
  test(`PR-10: a newer version on this device is named on step 3, and Dalje waits for the choice (${width} px)`, async ({ page, context }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await workspace(page);
    const opened = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/evidence/open");
    await page.goto(`/aplikacija/rad/${W_ID}`);
    const { documentId } = await (await opened).json() as { documentId: string };
    const editor = page.locator('.ProseMirror[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 20_000 });
    // The first-steps guide of a first visit stands over the sheet at 390 px; it is skipped as a student would.
    const skip = page.getByRole("button", { name: "Preskoči vodič" });
    await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
    // Written without a connection, so the change is kept on this device and waits (save-status.spec.ts).
    await context.setOffline(true);
    await editor.focus();
    await page.keyboard.press("End");
    await page.keyboard.type(" Izmišljena rečenica koja još nije stigla na poslužitelj.");
    await expect(page.locator('footer[aria-label="Stanje rada"]')).toContainText(/čeka slanje: \d+ izmjen/, { timeout: 15_000 });
    await context.setOffline(false);
    // Step 3: the server has confirmed revision 2 of this document; the device holds the change after it.
    await page.route("**/api/v1/evidence/open", (route) => route.fulfill({ json: { ...OPENED, documentId } }));
    await page.goto(`/aplikacija/rad/${W_ID}/predaja/pregled`);
    await expect(main(page).getByText("Na uređaju je novija verzija", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(next(page)).toHaveAttribute("aria-disabled", "true");
    await expect(main(page).getByText("Odaberite koju verziju predajete.", { exact: true })).toBeVisible();
    await axe(page, info, `novija-lokalno-${width}`);
    const confirmed = main(page).getByRole("radio", { name: /^Predaj potvrđenu verziju V\d+$/ });
    await confirmed.focus();
    await page.keyboard.press("Space");
    await expect(next(page)).not.toHaveAttribute("aria-disabled", "true");
    await next(page).click();
    await expect(page).toHaveURL(new RegExp(`/rad/${W_ID}/predaja/slanje$`));
  });
}
