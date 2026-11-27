// WEB-NUZ-PREDAJA-1 (NF-3 PR-1, PR-2; NF-2 P-16, P-17): the way into the submission from the workspace
// at every width, the banner of a submitted work with its ways on, and one source of the declaration's
// state for the rehearsal, the top bar and step 3. The server is the VIZ "puno" scenario over the
// contract's vectors, with the declaration, the withdrawal and the mentor's proof requests answered
// per test. Every person, course, text and identifier is invented.
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
const request = (n: number, closedAt: string | null) => ({
  id: `00000000-0000-4000-8000-00000000c10${n}`, sourceId: `00000000-0000-4000-8000-00000000c20${n}`,
  instruction: "Izmišljena uputa: priložite stranicu s navodom.", dueAt: "2026-11-20T10:00:00.000Z",
  createdAt: "2026-11-01T10:00:00.000Z", closedAt,
});

type Answers = { declaration?: unknown; withdrawable?: boolean };

/** The "puno" student, with the declaration, the withdrawal and the proof requests of this test. */
async function student(page: Page, answers: Answers = {}) {
  const server = generatedServer("puno");
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "GET" && /\/declaration(-v2)?$/u.test(path) && answers.declaration !== undefined) {
      return route.fulfill({ json: answers.declaration });
    }
    if (req.method() === "GET" && path.endsWith("/source-proof-requests")) {
      return route.fulfill({ json: { proofRequests: [request(1, null), request(2, "2026-11-03T10:00:00.000Z")] } });
    }
    if (req.method() === "GET" && path.endsWith("/submission/withdrawal") && answers.withdrawable !== undefined) {
      return route.fulfill({ json: { withdrawable: answers.withdrawable, receipts: [] } });
    }
    const result = server.answer("student", req.method(), path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
}

/** The first-steps guide of a first visit stands over the panel's tabs; it is skipped as a student would. */
async function skipGuide(page: Page) {
  const skip = page.getByRole("button", { name: "Preskoči vodič" });
  await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
}

/** "Predaja rada" in the top bar, by its name read aloud (with or without the count). */
const submitLink = (page: Page) => page.getByRole("banner").getByRole("link", { name: /^Predaja rada/ });

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`PR-1, P-17: Predaja rada is whole and in view with its count (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await student(page, { declaration: DRAFT });
      await page.goto(`/aplikacija/rad/${T1}`);
      await setTheme(page, theme);
      const link = submitLink(page);
      // The draft is one thing before the submission; the places left in the text add to it.
      await expect(link).toHaveAccessibleName(/^Predaja rada: \d+ stvari? prije predaje$/);
      // The host leads the base-less address to /aplikacija/rad/<id>/predaja (Host.tsx), as before.
      await expect(link).toHaveAttribute("href", `/rad/${T1}/predaja`);
      await expect(link).toBeInViewport({ ratio: 1 });
      await expect(link).toHaveText(width <= 640 ? /^Predaja\s*\d+$/ : /^Predaja rada\s*\d+$/, { useInnerText: true });
      await link.focus();
      await expect(link).toBeFocused();
      await axe(page, info, `predaja-ulaz-${width}-${theme}`);
    });
  }
}

for (const width of [390, 1280]) {
  test(`P-17: with a confirmed declaration the count names no declaration, and the link keeps its name (${width} px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await student(page, { declaration: CONFIRMED });
    await page.goto(`/aplikacija/rad/${T1}`);
    const link = submitLink(page);
    await expect(link).toBeInViewport({ ratio: 1 });
    // Only places left in the text can make a count now; the name is whole even where "Predaja" is shown.
    await expect(link).toHaveAccessibleName(/^Predaja rada(: \d+ stvari? prije predaje)?$/);
    await axe(page, info, `predaja-ulaz-potvrdeno-${width}`);
  });
}

for (const width of [390, 1280]) {
  test(`PR-1 (E-7a): the banner of a submitted work leads to the receipt and, while allowed, to the withdrawal (${width} px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await student(page, { withdrawable: true });
    await page.goto(`/aplikacija/rad/${T3}`);
    const banner = page.getByRole("status").filter({ hasText: "Rad je predan, pa se ovdje više ne može pisati." });
    await expect(banner.getByRole("link", { name: "Otvori potvrdu o predaji" })).toHaveAttribute("href", `/aplikacija/rad/${T3}/predaja/potvrda`);
    const withdraw = banner.getByRole("link", { name: "Povuci predaju" });
    await expect(withdraw).toHaveAttribute("href", `/aplikacija/rad/${T3}/predaja/potvrda#povuci`);
    await axe(page, info, `predano-banner-${width}`);
    await withdraw.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/rad/${T3}/predaja/potvrda$`));
    await expect(page.getByRole("dialog", { name: "Povući predaju?" })).toBeVisible();
  });
}

test("PR-1 (E-7a): no withdrawal from the banner when the server says it is closed", async ({ page }) => {
  await student(page, { withdrawable: false });
  await page.goto(`/aplikacija/rad/${T3}`);
  const banner = page.getByRole("status").filter({ hasText: "Rad je predan, pa se ovdje više ne može pisati." });
  await expect(banner.getByRole("link", { name: "Otvori potvrdu o predaji" })).toBeVisible();
  await expect(banner.getByRole("link", { name: "Povuci predaju" })).toHaveCount(0);
});

for (const [name, declaration, words, missing] of [
  ["a draft", DRAFT, "Izjava je ispunjena, ali još nije potvrđena.", "Potvrda izjave (blokira predaju)."],
  ["a confirmed declaration", CONFIRMED, "Potvrđena 4. 11. 2026. u 11:00.", "Ništa ne blokira predaju."],
] as const) {
  test(`PR-2: step 3 and the rehearsal say the same for ${name}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await student(page, { declaration });
    await page.goto(`/aplikacija/rad/${T1}/predaja/pregled`);
    await expect(page.getByText(words, { exact: true })).toBeVisible();
    await expect(page.getByText(missing, { exact: true })).toBeVisible();
    await expect(page.getByText("Mjesta za izvor, lijepljenja i pravila oblika ne zaustavljaju predaju.")).toBeVisible();
    await axe(page, info, `pregled-${name}`);

    await page.goto(`/aplikacija/rad/${T1}`);
    await skipGuide(page);
    await page.getByRole("tab", { name: "Mentor" }).click();
    await page.getByRole("button", { name: "Proba predaje" }).click();
    const dialog = page.getByRole("dialog", { name: "Proba predaje" });
    await expect(dialog.getByText(words, { exact: true })).toBeVisible();
    // P-16: the mentor's proofs and the faculty's form from the server, the rules said honestly.
    await expect(dialog.getByText("Još 1 od 2 čeka potvrdu.", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Obrazac izjave: test-izjava, verzija 1.", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Provjera pravila fakulteta još nije dostupna.", { exact: true })).toBeVisible();
    await axe(page, info, `proba-${name}`);
  });
}
