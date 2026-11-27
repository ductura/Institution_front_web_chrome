// F4-PRE-R02 (WEB): the student's Asistent conversations go with the declaration. Step 2 lists the server's
// conversations oldest first and attaches one on declaration-v2, step 3 says how many are attached, and
// step 4 names them. A failed list or count is said, never shown as "none". The server is the VIZ "puno"
// scenario with the conversations of this test. Every person, course, text and identifier is invented.
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
    ai: { use: "used", declaredTools: [], attachments: [] as unknown[], externalAttachmentIds: [] }, confirm: false,
  },
};
const C1 = "00000000-0000-4000-8000-0000000000c1";
const C2 = "00000000-0000-4000-8000-0000000000c2";
const CONVERSATIONS = [
  // Out of order on purpose: the step numbers them oldest first.
  { conversationId: C2, purposeKey: "summary", createdAt: "2026-11-20T10:00:00.000Z", requestCount: 1, lastActivityAt: "2026-11-20T10:05:00.000Z" },
  { conversationId: C1, purposeKey: "summary", createdAt: "2026-11-18T09:00:00.000Z", requestCount: 1, lastActivityAt: "2026-11-18T09:02:00.000Z" },
];
const message = (seq: number, id: string, role: string, content: string, hash: string) => ({
  seq, id, requestId: "00000000-0000-4000-8000-0000000000f1", role, content, contentSha256: hash.repeat(64),
  createdAt: "2026-11-18T09:00:30.000Z", requestState: "completed",
});
const MESSAGES: Record<string, unknown[]> = {
  [C1]: [message(1, "00000000-0000-4000-8000-0000000000e1", "student_paragraph", "Izmišljeni odlomak.", "a"), message(2, "00000000-0000-4000-8000-0000000000e2", "provider_response", "Izmišljeni odgovor.", "b")],
  [C2]: [message(1, "00000000-0000-4000-8000-0000000000e3", "student_paragraph", "Drugi odlomak.", "c")],
};

/** The "puno" student on T1 with a draft declaration on declaration-v2 and two Asistent conversations. */
async function student(page: Page, { listFails = false } = {}) {
  const server = generatedServer("puno");
  const declarations: string[] = [];
  let state = structuredClone(DRAFT);
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (/\/declaration(-v2)?$/u.test(path)) {
      declarations.push(`${req.method()} ${path}`);
      if (req.method() === "PUT") {
        const body = req.postDataJSON() as typeof DRAFT.draft;
        state = { ...state, version: state.version + 1, draft: { ...body, baseVersion: state.version } };
      }
      return route.fulfill({ json: state });
    }
    if (req.method() === "GET" && path.endsWith("/assistant-conversations")) {
      if (listFails) return route.fulfill({ status: 503, json: { status: "unavailable" } });
      return route.fulfill({ json: { assignmentId: T1, conversations: CONVERSATIONS } });
    }
    const conversation = /\/assistant\/conversations\/([^/]+)$/u.exec(path)?.[1];
    if (req.method() === "GET" && conversation !== undefined && MESSAGES[conversation]) {
      return route.fulfill({ json: { conversationId: conversation, messages: MESSAGES[conversation] } });
    }
    const result = server.answer("student", req.method(), path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
  return { declarations, state: () => state };
}

const main = (page: Page) => page.locator("main");

for (const width of [390, 1280]) {
  test(`PRE-R02: step 2 lists the server's conversations and attaches one on declaration-v2 (${width} px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const s = await student(page);
    await page.goto(`/aplikacija/rad/${T1}/predaja/izjava`);
    const attach = main(page).getByRole("button", { name: "Priloži izjavi" });
    await expect(attach).toHaveCount(2);
    await expect(main(page).getByText("Prilaganje razgovora trenutačno nije dostupno.", { exact: true })).toHaveCount(0);
    await expect(main(page).getByText("Nema razgovora za prilaganje.", { exact: true })).toHaveCount(0);
    await axe(page, info, `pre-r02-izjava-${width}`);
    await attach.first().click();
    await expect.poll(() => (s.state().draft.ai.attachments as { conversationId: string }[]).map((a) => a.conversationId)).toEqual([C1]);
    // Every read and write of the declaration went to declaration-v2.
    expect(s.declarations.length).toBeGreaterThan(0);
    expect(s.declarations.every((d) => d.endsWith("/declaration-v2"))).toBe(true);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`PRE-R02: step 3 says how many conversations are attached (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await student(page);
      await page.goto(`/aplikacija/rad/${T1}/predaja/pregled`);
      await setTheme(page, theme);
      await expect(main(page).getByText("Razgovori uz izjavu", { exact: true }).first()).toBeVisible();
      await expect(main(page).getByText("Razgovora: 2, priloženo: 0. Nastavnik vidi samo priložene razgovore.", { exact: true })).toBeVisible();
      await expect(main(page).getByText("Broj priloženih razgovora trenutačno nije dostupan.", { exact: true })).toHaveCount(0);
      await axe(page, info, `pre-r02-pregled-${width}-${theme}`);
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

test("PRE-R02: step 3 says the count is unknown when the list fails, never \"none\"", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await student(page, { listFails: true });
  await page.goto(`/aplikacija/rad/${T1}/predaja/pregled`);
  await expect(main(page).getByText("Broj priloženih razgovora trenutačno nije dostupan.", { exact: true })).toBeVisible();
});

test("PRE-R02: step 4 names the attached conversations", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await student(page);
  await page.goto(`/aplikacija/rad/${T1}/predaja/slanje`);
  await expect(main(page).getByRole("button", { name: "Predaj rad", exact: true })).toBeVisible();
  await expect(main(page).getByText("0 priloženo", { exact: true })).toBeVisible();
});
