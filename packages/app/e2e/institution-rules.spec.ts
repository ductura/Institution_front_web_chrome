// WEB-1406 (A-04): /ustanova/pravila over a fake institution server (page.route).
// The history is read only, a 422 shows beside its field, and only the
// administrator opens the page. Invented people and rules only.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ME = (role: string) => ({ role, displayName: "Ana Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet za testove" } });
const version = (versionNo: number, over: object = {}) => ({
  versionNo, aiPolicy: "prohibited", aiPurposes: [], evidenceProfile: "basic", importAllowed: false,
  origin: "operator", publishedAt: "2026-10-01T10:00:00.000Z", ...over,
});
const RULES = { rules: [{ workType: "seminar_paper", versions: [version(1), version(2, { aiPolicy: "partially_allowed", aiPurposes: ["formatting"], origin: "administrator" })] }] };

type Fake = { posts: unknown[]; rules: typeof RULES; reply?: { status: number; body: unknown } };

async function fakeServer(page: Page, role: string, fake: Fake) {
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: ME(role) }));
  await page.route("**/api/v1/institution/faculty-rules", async (route) => {
    if (route.request().method() === "POST") {
      fake.posts.push(JSON.parse(route.request().postData() ?? "null"));
      const reply = fake.reply ?? { status: 201, body: { versionNo: 3, publishedAt: "2026-11-21T09:00:00.000Z" } };
      await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
      return;
    }
    await route.fulfill({ json: fake.rules });
  });
}

test("the administrator reads the history, compares and publishes a new version", async ({ page }) => {
  const fake: Fake = { posts: [], rules: RULES };
  await fakeServer(page, "institution_admin", fake);
  await page.goto("/app/web/ustanova/pravila");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pravila fakulteta");
  const history = page.getByRole("table", { name: /Povijest verzija: Seminarski rad/ });
  await expect(history.getByRole("row")).toHaveCount(3);
  // An old version is only read: nothing in the history can be changed.
  await expect(history.locator("input, select, textarea, button")).toHaveCount(0);

  await page.getByLabel("Uvoz teksta je dopušten").check();
  await page.getByRole("button", { name: "Pregledaj razliku" }).click();
  await expect(page.getByRole("heading", { name: "Razlika prema verziji 2" })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

  await page.getByRole("button", { name: "Objavi novu verziju" }).click();
  await expect(page.getByText("Objavljena je verzija 3.")).toBeVisible();
  expect(fake.posts).toEqual([{
    workType: "seminar_paper", basedOnVersionNo: 2, aiPolicy: "partially_allowed", aiPurposes: ["formatting"], evidenceProfile: "basic", importAllowed: true,
  }]);
});

test("a 422 is shown beside its field and nothing is published as done", async ({ page }) => {
  const fake: Fake = {
    posts: [], rules: RULES,
    reply: { status: 422, body: { error: "invalid_ai_purposes", code: "invalid_ai_purposes", messageKey: "errors.invalid_ai_purposes", status: 422 } },
  };
  await fakeServer(page, "institution_admin", fake);
  await page.goto("/app/web/ustanova/pravila");
  await page.getByLabel("Profil zapisa").selectOption("extended");
  await page.getByRole("button", { name: "Pregledaj razliku" }).click();
  await page.getByRole("button", { name: "Objavi novu verziju" }).click();
  const group = page.getByRole("group", { name: "Dopuštene uporabe" });
  await expect(group.getByText("Poslužitelj nije prihvatio odabrane uporabe.")).toBeVisible();
  await expect(page.getByText(/Objavljena je verzija/)).toHaveCount(0);
});

test("the check before sending stops purposes under a prohibition, with no request", async ({ page }) => {
  const fake: Fake = { posts: [], rules: RULES };
  await fakeServer(page, "institution_admin", fake);
  await page.goto("/app/web/ustanova/pravila");
  await page.getByLabel("AI pomoć").selectOption("prohibited");
  await page.getByRole("button", { name: "Pregledaj razliku" }).click();
  await expect(page.getByRole("group", { name: "Dopuštene uporabe" }).getByText(/ne može se odabrati nijedna uporaba/)).toBeVisible();
  expect(fake.posts).toEqual([]);
});

test("a teacher does not see the page", async ({ page }) => {
  const fake: Fake = { posts: [], rules: RULES };
  await fakeServer(page, "teacher", fake);
  await page.goto("/app/web/ustanova/pravila");
  await expect(page.getByRole("table", { name: /Povijest verzija/ })).toHaveCount(0);
  await expect(page.getByText("Nova verzija pravila")).toHaveCount(0);
});
