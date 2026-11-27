// F4-PRE-R02 (WEB): the student's Asistent conversations go with the declaration. Step 2 lists the server's
// conversations oldest first and, on declaration-v2 (the extract has student.declaration-second.*), offers
// attaching; step 3 and step 4 say the count the server holds. When the v2 read fails, attaching is said to
// be unavailable, step 3 says the count is unknown rather than "none", and step 4 shows no conversations row. The server is the VIZ "puno" scenario with the conversations of this test.
// Every person, course, text and identifier is invented.
import { axe, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

const FORM = { formId: "test-izjava", formVersion: 1, formSha256: "a".repeat(64) };
const DRAFT = {
  submitted: false, currentRevision: 2, formText: "Izmišljeni obrazac.", currentForm: { ...FORM, text: "Izmišljeni obrazac." },
  uploads: [], state: "draft", version: 1, payload: null, declarationSha256: null,
  draft: {
    baseVersion: 0, revision: 2, form: FORM, ownWork: { confirmed: false }, humanHelp: { received: false, entries: [] },
    ai: { use: "used", declaredTools: [], attachments: [], externalAttachmentIds: [] }, confirm: false,
  },
};
const C1 = "00000000-0000-4000-8000-0000000000c1";
const C2 = "00000000-0000-4000-8000-0000000000c2";
const CONVERSATIONS = [
  // Out of order on purpose: the step numbers them oldest first.
  { conversationId: C2, purposeKey: "summary", createdAt: "2026-11-20T10:00:00.000Z", requestCount: 1, lastActivityAt: "2026-11-20T10:05:00.000Z" },
  { conversationId: C1, purposeKey: "summary", createdAt: "2026-11-18T09:00:00.000Z", requestCount: 1, lastActivityAt: "2026-11-18T09:02:00.000Z" },
];

/** The "puno" student on T1 with a draft declaration and two Asistent conversations (or a failed list). */
async function student(page: Page, { listFails = false, v2Fails = false } = {}) {
  const server = generatedServer("puno");
  const attaching: string[] = [];
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path.endsWith("/declaration-v2") && req.method() !== "GET") attaching.push(`${req.method()} ${path}`);
    if (path.endsWith("/declaration-v2") && req.method() === "GET") {
      return v2Fails ? route.fulfill({ status: 503, json: { status: "unavailable" } }) : route.fulfill({ json: DRAFT });
    }
    if (path.endsWith("/declaration") && req.method() === "GET") return route.fulfill({ json: DRAFT });
    if (req.method() === "GET" && path.endsWith("/assistant-conversations")) {
      if (listFails) return route.fulfill({ status: 503, json: { status: "unavailable" } });
      return route.fulfill({ json: { assignmentId: T1, conversations: CONVERSATIONS } });
    }
    const result = server.answer("student", req.method(), path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
  return { attaching };
}

const main = (page: Page) => page.locator("main");

for (const width of [390, 1280]) {
  test(`PRE-R02: step 2 lists the server's conversations and offers attaching on declaration-v2 (${width} px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { attaching } = await student(page);
    await page.goto(`/aplikacija/rad/${T1}/predaja/izjava`);
    await expect(main(page).getByText("Nastavnik vidi samo priložene razgovore. Priloženo: 0 od 2.", { exact: true })).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Pregledaj razgovor" })).toHaveCount(2);
    await expect(main(page).getByRole("button", { name: "Priloži izjavi" })).toHaveCount(2);
    await expect(main(page).getByText("Prilaganje razgovora trenutačno nije dostupno.", { exact: true })).toHaveCount(0);
    await expect(main(page).getByText("Nema razgovora za prilaganje.", { exact: true })).toHaveCount(0);
    expect(attaching).toEqual([]);
    await axe(page, info, `pre-r02-izjava-${width}`);
  });

  test(`PRE-R02: step 2 says attaching is not available when declaration-v2 cannot be read (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await student(page, { v2Fails: true });
    await page.goto(`/aplikacija/rad/${T1}/predaja/izjava`);
    await expect(main(page).getByRole("button", { name: "Priloži izjavi" })).toHaveCount(0);
    await expect(main(page).getByText("Nema razgovora za prilaganje.", { exact: true })).toHaveCount(0);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`PRE-R02: step 3 says the count of attached conversations the server holds (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await student(page);
      await page.goto(`/aplikacija/rad/${T1}/predaja/pregled`);
      await setTheme(page, theme);
      await expect(main(page).getByText("Razgovori uz izjavu", { exact: true }).first()).toBeVisible();
      await expect(main(page).getByText("Razgovora: 2, priloženo: 0. Nastavnik vidi samo priložene razgovore.", { exact: true })).toBeVisible();
      await axe(page, info, `pre-r02-pregled-${width}-${theme}`);
    });

    test(`PRE-R02: step 3 says the count is unknown, never "none", when declaration-v2 cannot be read (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await student(page, { v2Fails: true });
      await page.goto(`/aplikacija/rad/${T1}/predaja/pregled`);
      await setTheme(page, theme);
      await expect(main(page).getByText("Broj priloženih razgovora trenutačno nije dostupan.", { exact: true })).toBeVisible();
      await expect(main(page).getByText("Nema razgovora za prilaganje.", { exact: true })).toHaveCount(0);
      await axe(page, info, `pre-r02-pregled-nepoznato-${width}-${theme}`);
    });
  }
}

test("PRE-R02: a failed list is said on step 2, not shown as no conversations", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await student(page, { listFails: true });
  await page.goto(`/aplikacija/rad/${T1}/predaja/izjava`);
  await expect(main(page).getByText("Razgovore s Asistentom trenutačno nije moguće učitati.", { exact: true })).toBeVisible();
  await expect(main(page).getByText("Nema razgovora za prilaganje.", { exact: true })).toHaveCount(0);
});

test("PRE-R02: step 4 shows the attached count the server holds, and no row while it is unknown", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await student(page);
  await page.goto(`/aplikacija/rad/${T1}/predaja/slanje`);
  await expect(main(page).getByRole("button", { name: "Predaj rad", exact: true })).toBeVisible();
  await expect(main(page).getByText("0 priloženo", { exact: true })).toBeVisible();
});

test("PRE-R02: step 4 shows no conversations row while the count is unknown", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await student(page, { v2Fails: true });
  await page.goto(`/aplikacija/rad/${T1}/predaja/slanje`);
  await expect(main(page).getByRole("button", { name: "Predaj rad", exact: true })).toBeVisible();
  await expect(main(page).getByText("Razgovori uz izjavu", { exact: true })).toHaveCount(0);
  await expect(main(page).getByText("0 priloženo", { exact: true })).toHaveCount(0);
});
