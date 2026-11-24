const { expect, test } = require("@playwright/test");

const fixture = "/__fixture/submission-rehearsal";
const assignmentId = "a8ee8f83-2949-4a99-b358-be77cd4938dd";
const requirements = `/api/v1/student/assignments/${assignmentId}/requirements`;
const declaration = `/api/v1/student/assignments/${assignmentId}/declaration`;
// WEB-NUZ-PREDAJA-1 (PR-2): invented declaration states as student.declaration.get gives them.
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
const CONFIRMED = {
  ...BASE, state: "confirmed", version: 5, draft: null, declarationSha256: "d".repeat(64),
  payload: {
    declarationSchema: "ductura-declaration-v1", declarationId: "00000000-0000-4000-8000-0000000000d1", declarationVersion: 5,
    principalId: "00000000-0000-4000-8000-0000000000e1", assignmentId, assignmentVersion: 1,
    documentId: "izmisljeni-dokument-1", revision: 2, form: FORM, ownWork: { confirmed: true },
    humanHelp: { received: false, entries: [] }, ai: { use: "not_used", declaredTools: [], recorded: [], attachments: [] },
    confirmedAt: "2026-11-20T10:00:00.000000Z",
  },
};

test.beforeEach(async ({ page }) => {
  await page.route(`**${fixture}*`, (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html lang="hr"><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Proba predaje</title><div id="app"></div>
      <script type="module" src="/src/components/editor/submission-rehearsal/browser/fixture.spec.tsx"></script></html>`,
  }));
});

test("uses the assignment's GET range, displays the prototype form row and selects the document finding", async ({ page }) => {
  const requests = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const at = new URL(request.url()).pathname;
    requests.push([at, request.method(), request.postData()]);
    await route.fulfill({ json: at === declaration ? CONFIRMED : { wordRange: { min: 1234, max: 2345 } } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixture);
  const opener = page.getByRole("button", { name: "Proba predaje" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Proba predaje" });
  await expect(dialog.getByRole("status")).toContainText(/1\s234–2\s345 riječi/);
  await expect(dialog.getByText("Pravila oblika", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Provjera oblika još nije pokrenuta.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Potvrđena 20. 11. 2026. u 11:00.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Mjesta ostavljena za kasnije: 1 (ne zaustavljaju predaju).", { exact: true })).toBeVisible();
  // P-16: the faculty's form is the one the server names, not "unavailable".
  await expect(dialog.getByText("Predaj rad", { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /pravila oblika|pokreni provjeru/i })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Predajni paket" }).click();
  const preview = page.getByRole("dialog", { name: "Predajni paket" });
  await expect(preview.getByText("Kod nastaje pri predaji.")).toBeVisible();
  await expect(preview.getByRole("link")).toHaveCount(0);
  await preview.getByRole("button", { name: "Natrag na probu predaje" }).click();
  await expect(dialog.getByRole("button", { name: "Predajni paket" })).toBeFocused();
  await dialog.getByRole("list", { name: "Blokira predaju" }).getByRole("button", { name: "Idi na nalaz" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".tiptap")).toBeFocused();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("[izvor]");
  expect(requests.sort()).toEqual([[declaration, "GET", null], [requirements, "GET", null]]);
});

test("says what the server holds for the declaration, not this browser's own mark (PR-2, G-2)", async ({ page }) => {
  // The fixture keeps a confirmation in sessionStorage; the server has only a draft.
  await page.route("**/api/v1/**", (route) => route.fulfill({
    json: new URL(route.request().url()).pathname === declaration ? DRAFT : { wordRange: null },
  }));
  await page.goto(fixture);
  await page.getByRole("button", { name: "Proba predaje" }).click();
  const dialog = page.getByRole("dialog", { name: "Proba predaje" });
  await expect(dialog.getByText("Izjava je ispunjena, ali još nije potvrđena.", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/^Potvrda izjave \(blokira predaju\)\./)).toBeVisible();
  await expect(dialog.getByText(/^Potvrđena/)).toHaveCount(0);
});

test("never says confirmed when the declaration cannot be read", async ({ page }) => {
  await page.route("**/api/v1/**", (route) => new URL(route.request().url()).pathname === declaration
    ? route.fulfill({ status: 503, json: { error: "unavailable", code: "unavailable", messageKey: "errors.x", status: 503, requestId: "00000000-0000-4000-8000-000000000000" } })
    : route.fulfill({ json: { wordRange: null } }));
  await page.goto(fixture);
  await page.getByRole("button", { name: "Proba predaje" }).click();
  const dialog = page.getByRole("dialog", { name: "Proba predaje" });
  await expect(dialog.getByText("Stanje izjave trenutačno nije moguće provjeriti, pa predaja još nije moguća.", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/^Potvrđena/)).toHaveCount(0);
});

test("reopens with a fresh read and jumps to the summary, while Escape restores focus", async ({ page }) => {
  let reads = 0;
  await page.route(`**${requirements}`, (route) => ++reads === 1
    ? route.fulfill({ status: 503 })
    : route.fulfill({ json: { wordRange: null } }));
  await page.goto(fixture);
  const opener = page.getByRole("button", { name: "Proba predaje" });
  const dialog = page.getByRole("dialog", { name: "Proba predaje" });
  await opener.click();
  await expect(dialog.getByRole("status")).toContainText("Traženi opseg trenutačno nije dostupan.");
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(dialog.getByRole("status")).toContainText("Zadatak nema zadan raspon.");
  await dialog.getByRole("button", { name: "Otvori · Sažetak", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".tiptap")).toBeFocused();
  expect(await page.evaluate(() => window.getSelection()?.anchorNode?.parentElement?.textContent)).toBe("Sažetak");
});

test("keeps the drawer on Escape and leaves it when jumping to the work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(`**${requirements}`, (route) => route.fulfill({ json: { wordRange: null } }));
  await page.goto(`${fixture}?drawer`);
  await page.getByRole("button", { name: "Otvori karticu Rad" }).click();
  const drawer = page.getByRole("dialog", { name: "Rad", exact: true });
  const opener = drawer.getByRole("button", { name: "Proba predaje" });
  const rehearsal = page.getByRole("dialog", { name: "Proba predaje" });
  await opener.click();
  await page.keyboard.press("Tab");
  await expect(rehearsal.getByRole("list", { name: "Blokira predaju" }).getByRole("button")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(rehearsal).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await rehearsal.getByRole("button", { name: "Otvori · Summary" }).click();
  await expect(drawer).toBeHidden();
  await expect(page.locator(".tiptap")).toBeFocused();
  expect(await page.evaluate(() => window.getSelection()?.anchorNode?.parentElement?.textContent)).toBe("Summary");
});
