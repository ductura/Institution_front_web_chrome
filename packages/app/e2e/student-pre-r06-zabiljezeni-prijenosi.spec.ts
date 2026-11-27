// F4-PRE-R06 (WEB): transfers recorded in the declaration. The server fills no `recorded` block yet, so
// step 2 says nothing is recorded, offers no "Obrazac izjave" menu (R-34) even when Asistent conversations
// exist, and has no "Dodaj objašnjenje" (R-35 waits for the field from F4-PRE-R02-SRV2).
// The server is the VIZ "puno" scenario with the declaration and conversations of this test.
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
const CONVERSATIONS = [
  { conversationId: "00000000-0000-4000-8000-0000000000c1", purposeKey: "summary", createdAt: "2026-11-18T09:00:00.000Z", requestCount: 1, lastActivityAt: "2026-11-18T09:02:00.000Z" },
];

/** The "puno" student on T1 with a draft declaration and one Asistent conversation. */
async function student(page: Page) {
  const server = generatedServer("puno");
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path.endsWith("/declaration-v2") && req.method() === "GET") return route.fulfill({ json: DRAFT });
    if (req.method() === "GET" && path.endsWith("/assistant-conversations")) {
      return route.fulfill({ json: { assignmentId: T1, conversations: CONVERSATIONS } });
    }
    const result = server.answer("student", req.method(), path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
}

const main = (page: Page) => page.locator("main");

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`PRE-R06: nothing recorded is said, with no "Obrazac izjave" menu and no "Dodaj objašnjenje" (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await student(page);
      await page.goto(`/aplikacija/rad/${T1}/predaja/izjava`);
      await setTheme(page, theme);
      await expect(main(page).getByText("U ovom radu nije zabilježen razgovor s Asistentom.", { exact: true })).toBeVisible();
      await expect(main(page).getByRole("button", { name: "Pregledaj razgovor" })).toHaveCount(1);
      await expect(main(page).getByLabel("Obrazac izjave")).toHaveCount(0);
      await expect(main(page).getByRole("combobox")).toHaveCount(0);
      await expect(main(page).getByText("Dodaj objašnjenje")).toHaveCount(0);
      await axe(page, info, `pre-r06-izjava-${width}-${theme}`);
    });
  }
}
