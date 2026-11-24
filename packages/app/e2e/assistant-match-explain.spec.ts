// ED-13 (NF2-P13): the assistant match banner in the student's editor and its "Objasni, ako želiš…" dialog.
// The explanation is optional, never blocks and is not a verdict. Invented assignment, invented server and ids.
import { axe, hiddenFocus, setTheme } from "./a11y/check";

import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c13";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d13";
const SCOPE = "d".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0013";
const PATH = `/app/web/rad/${ID}`;
const MESSAGE = "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e13";
const FINDING = {
  segmentRef: "izmisljeni-odlomak-1", conversationId: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d13", messageId: MESSAGE,
  runWords: 11, recordedAt: "2026-11-20T10:00:00.000Z", attachedAt: "2026-11-20T10:00:00.000Z",
};
const TITLE = "Dio teksta podudara se s odgovorom pomoćnika.";
const NEUTRAL = "Ovo je obična usporedba teksta i ništa ne govori o autorstvu.";
const TEXT = "Izmišljeno objašnjenje: definiciju sam provjerio/la u udžbeniku.";

type Options = { findings?: unknown[]; explain?: { status: number; body?: unknown } };

async function server(page: Page, opts: Options = {}) {
  const sent: unknown[] = [];
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: SCOPE, sessionTag: TAG },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljeni seminar o gradskim vrtovima", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
  await page.route("**/api/v1/works/*/assistant-match/explanation", async (route) => {
    sent.push(route.request().postDataJSON());
    const answer = opts.explain ?? { status: 201, body: { text: TEXT, writtenAt: "2026-11-20T12:00:00.000Z" } };
    await route.fulfill(answer.body === undefined
      ? { status: answer.status, json: { error: { code: "unavailable" } } }
      : { status: answer.status, json: answer.body });
  });
  await page.route("**/api/v1/works/*/assistant-match", (route) => route.request().method() === "GET"
    ? route.fulfill({ json: { findings: opts.findings ?? [FINDING] } })
    : route.fulfill({ json: { matches: [] } }));
  return sent;
}

async function open(page: Page, opts: Options = {}) {
  const sent = await server(page, opts);
  await page.goto(PATH);
  await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
  await expect(banner(page)).toBeVisible({ timeout: 20_000 });
  return sent;
}

const banner = (page: Page) => page.locator("[data-assistant-match-notice] [role=status]").first();
const opener = (page: Page) => banner(page).getByRole("button", { name: "Objasni, ako želiš…" });
const dialog = (page: Page) => page.getByRole("dialog", { name: "Objasni, ako želiš" });

test.describe("ED-13 Podudaranje: Objasni, ako želiš", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the banner says only that the text matches, and the dialog sends the explanation", async ({ page }) => {
    const sent = await open(page);
    await expect(banner(page)).toContainText(`${TITLE} ${NEUTRAL}`);
    await expect(banner(page)).not.toContainText(/prepis|plagij|autor je/i);
    await opener(page).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toContainText("Napiši kako je taj dio nastao. Nije obvezno, ne blokira predaju i ne ulazi u ocjenu. Isto vidi i nastavnik.");
    const field = dialog(page).getByRole("textbox", { name: "Objašnjenje" });
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute("maxlength", "2000");
    await field.fill(`  ${TEXT}  `);
    await dialog(page).getByRole("button", { name: "Pošalji objašnjenje" }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(banner(page)).toContainText("Objašnjenje je zabilježeno uz nalaz. Vidi ga i nastavnik.");
    await expect(opener(page)).toHaveCount(0);
    expect(sent).toEqual([{ segmentRef: FINDING.segmentRef, messageId: MESSAGE, text: TEXT }]);
  });

  test("an empty explanation is not sent; Zatvori closes without sending", async ({ page }) => {
    const sent = await open(page);
    await opener(page).click();
    await dialog(page).getByRole("button", { name: "Pošalji objašnjenje" }).click();
    await expect(dialog(page).getByRole("alert")).toHaveText("Upišite objašnjenje ili zatvorite prozor.");
    await expect(dialog(page).getByRole("textbox", { name: "Objašnjenje" })).toHaveAttribute("aria-invalid", "true");
    await dialog(page).getByRole("button", { name: "Zatvori" }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(opener(page)).toBeFocused();
    expect(sent).toEqual([]);
  });

  test("a server that does not take it keeps the text and says so", async ({ page }) => {
    await open(page, { explain: { status: 503 } });
    await opener(page).click();
    await dialog(page).getByRole("textbox", { name: "Objašnjenje" }).fill(TEXT);
    await dialog(page).getByRole("button", { name: "Pošalji objašnjenje" }).click();
    await expect(dialog(page).getByRole("alert")).toHaveText("Objašnjenje nije stiglo na poslužitelj. Pokušaj ponovno.");
    await expect(dialog(page).getByRole("textbox", { name: "Objašnjenje" })).toHaveValue(TEXT);
  });

  test("an explanation already recorded is said so", async ({ page }) => {
    await open(page, { explain: { status: 409 } });
    await opener(page).click();
    await dialog(page).getByRole("textbox", { name: "Objašnjenje" }).fill(TEXT);
    await dialog(page).getByRole("button", { name: "Pošalji objašnjenje" }).click();
    await expect(dialog(page).getByRole("alert")).toHaveText("Za ovaj dio objašnjenje je već zabilježeno.");
  });

  test("an explained match is shown as explained and asks for nothing", async ({ page }) => {
    await open(page, { findings: [{ ...FINDING, explanation: { text: TEXT, writtenAt: "2026-11-20T12:00:00.000Z" } }] });
    await expect(banner(page)).toContainText("Objašnjenje je zabilježeno uz nalaz.");
    await expect(opener(page)).toHaveCount(0);
  });

  test("no finding (the faculty switch off): no banner", async ({ page }) => {
    await server(page, { findings: [] });
    await page.goto(PATH);
    await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-assistant-match-notice]")).toHaveCount(0);
  });

  test("keyboard: open, write, Escape closes, the focus goes back", async ({ page }) => {
    const sent = await open(page);
    await opener(page).focus();
    await page.keyboard.press("Enter");
    await expect(dialog(page).getByRole("textbox", { name: "Objašnjenje" })).toBeFocused();
    await page.keyboard.type("Izmišljeno.");
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(opener(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.type(TEXT);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(dialog(page).getByRole("button", { name: "Pošalji objašnjenje" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog(page)).toBeHidden();
    expect(sent).toHaveLength(1);
  });

  for (const width of [390, 1280]) {
    for (const theme of ["light", "dark"] as const) {
      test(`axe ${width} px, ${theme}: banner and dialog`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await open(page);
        await setTheme(page, theme);
        await axe(page, info, `podudaranje ${width} ${theme}`);
        await opener(page).click();
        await expect(dialog(page)).toBeVisible();
        await axe(page, info, `objasni ${width} ${theme}`);
        expect(await hiddenFocus(page)).toEqual([]);
      });
    }
  }
});
