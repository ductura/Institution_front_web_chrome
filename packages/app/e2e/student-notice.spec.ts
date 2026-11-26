import { expect, test, type Page } from "./fixtures/test";

const ID = "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a60";
const PATH = `/zadatak/${ID}`;
const API = `**/api/v1/student/assignments/${ID}/notice`;
const TITLE = "Izmišljeni seminar o kompostiranju";
const TIME = "2026-11-03T09:20:00.000Z";
const notice = {
  assignmentId: ID, versionNo: 2, templateVersion: 1, title: TITLE,
  instructions: "Opišite izmišljeni pokus kompostiranja.",
  workType: "seminar_paper", opensAt: "2025-11-02T08:00:00.000Z", dueAt: "2099-12-15T22:59:00.000Z",
  aiPolicy: "partially_allowed", aiPurposes: ["proofreading"], evidenceProfile: "basic",
  wordMin: 1500, wordMax: 3000, readAt: null, acknowledgedAt: null,
};

async function studentSession(page: Page) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" } },
  }));
}

function pauseResponse() {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  return { wait, release };
}

test("renders the notice, writes nothing on opening, waits for the acknowledgment and restores the confirmation on reload", async ({ page }) => {
  await studentSession(page);
  const readAt: string | null = null;
  let acknowledgedAt: string | null = null;
  let writes = 0;
  let opens = 0;
  const ackResponse = pauseResponse();

  await page.route(API, (route) => route.fulfill({ json: { ...notice, readAt, acknowledgedAt } }));
  // P-9 (a): opening the notice sends nothing; a request to the "read" route would be a regression.
  await page.route(`${API}-read`, async (route) => {
    opens++;
    await route.fulfill({ json: { readAt: TIME } });
  });
  await page.route(`**/api/v1/institution/assignments/${ID}/acknowledgment`, async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({
      versionNo: notice.versionNo, fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    writes++;
    await ackResponse.wait;
    acknowledgedAt = TIME;
    await route.fulfill({ json: { acknowledgedAt } });
  });

  await page.goto(`/app/web${PATH}`);
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  await expect(page.getByRole("link", { name: "Moji kolegiji i zadaci" })).toHaveAttribute("href", "/app/web/zadaci");
  // P-8: five lines on top, with the line that a confirmation is not a consent.
  const summary = page.getByRole("region", { name: "Ukratko" });
  await expect(summary.getByRole("listitem")).toHaveCount(5);
  await expect(summary).toContainText("lektoriranje i jezična provjera");
  await expect(summary).toContainText("Potvrda nije privola.");
  await expect(page.getByText(/otvorena|zabilježeno da je obavijest/)).toHaveCount(0);
  expect(opens).toBe(0);

  const submit = page.getByRole("button", { name: "Potvrdi i otvori editor" });
  // E-6: the button stays in the tab order (aria-disabled, not disabled) and does nothing until the box is ticked.
  await expect(submit).toHaveAttribute("aria-disabled", "true");
  await expect(submit).not.toHaveAttribute("disabled", /.*/);
  // Playwright treats aria-disabled as not actionable, so the click is forced.
  await submit.click({ force: true });
  expect(writes).toBe(0);
  await page.getByRole("checkbox", { name: /Pročitao\/la sam obavijest/ }).check();
  await expect(submit).toHaveAttribute("aria-disabled", "false");
  await submit.click();
  await expect(page.getByRole("button", { name: "Potvrđivanje…" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("link", { name: "Otvori rad" })).toHaveCount(0);
  ackResponse.release();
  // R-19: a fresh confirmation goes straight to the work.
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/app/web/rad/${ID}`);
  expect(writes).toBe(1);
  expect(opens).toBe(0);

  // R-20: a returning student sees "Pročitana obavijest", the card, "Otvori rad" and the notice behind a details.
  await page.goto(`/app/web${PATH}`);
  await expect(page.getByRole("heading", { name: "Pročitana obavijest", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: TITLE })).toContainText("Potvrđeno");
  const open = page.getByRole("link", { name: "Otvori rad" });
  await expect(open).toHaveJSProperty("pathname", `/app/web/rad/${ID}`);
  await expect(open).toHaveJSProperty("search", "");
  const details = page.locator("details", { hasText: "Prikaži obavijest" });
  await expect(details).not.toHaveAttribute("open", "");
  await details.getByText("Prikaži obavijest").click();
  await expect(details.getByRole("heading", { name: "Što se bilježi" })).toBeVisible();
  await open.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/app/web/rad/${ID}`);
  expect(writes).toBe(1);
});

async function ackWith(page: Page, status: number, code: string) {
  await studentSession(page);
  await page.route(API, (route) => route.fulfill({ json: { ...notice, readAt: null, acknowledgedAt: null } }));
  await page.route(`**/api/v1/institution/assignments/${ID}/acknowledgment`, (route) => route.fulfill({ status, json: { code } }));
  await page.goto(`/app/web${PATH}`);
  await page.getByRole("checkbox", { name: /Pročitao\/la sam obavijest/ }).check();
  await page.getByRole("button", { name: "Potvrdi i otvori editor" }).click();
}

test("a 409 on the acknowledgment names the version and reloads the notice", async ({ page }) => {
  let version = 2;
  await ackWith(page, 409, "conflict");
  await page.route(API, (route) => route.fulfill({ json: { ...notice, versionNo: version, title: `${TITLE} (nova)`, readAt: null, acknowledgedAt: null } }));
  await expect(page.getByText("Nova verzija uputa (prikazana je v2), još nije potvrđena")).toBeVisible();
  await expect(page.getByText("Nastavnik je u međuvremenu objavio novu verziju")).toBeVisible();
  version = 3;
  await page.getByRole("button", { name: "Ponovno učitaj" }).click();
  await expect(page.getByRole("heading", { name: `${TITLE} (nova)` })).toBeVisible();
  await expect(page.getByText("Nova verzija uputa")).toHaveCount(0);
});

test("a 403 on the acknowledgment links back to the courses and stays on the notice", async ({ page }) => {
  await ackWith(page, 403, "forbidden");
  await expect(page.locator("p[role=alert]")).toHaveText("Ovaj račun ne može potvrditi obavijest za ovaj zadatak.");
  await expect(page.getByRole("link", { name: "Natrag na moje kolegije i zadatke" }).last()).toHaveAttribute("href", "/app/web/zadaci");
  expect(new URL(page.url()).pathname).toBe(`/app/web${PATH}`);
});

test("before the assignment opens only the card is shown, without the notice or the confirmation", async ({ page }) => {
  await studentSession(page);
  await page.route(API, (route) => route.fulfill({ json: { ...notice, opensAt: "2099-01-05T08:00:00.000Z", readAt: null, acknowledgedAt: null } }));
  await page.goto(`/app/web${PATH}`);
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Zadatak se otvara" })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Potvrdi i otvori editor" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Što se bilježi" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Ukratko" })).toHaveCount(0);
});

test("a 401 from the notice sends the student to AAI@EduHr with the current base", async ({ page }) => {
  await studentSession(page);
  await page.route(API, (route) => route.fulfill({ status: 401, json: { code: "unauthorized" } }));
  await page.route("**/api/v1/auth/login**", (route) => route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: '<!doctype html><html lang="hr"><title>AAI@EduHr</title><p>Lažni AAI@EduHr</p></html>',
  }));
  await page.goto(`/app/chrome${PATH}`);
  await expect(page).toHaveURL(/\/api\/v1\/auth\/login\?returnTo=/);
  await expect(page.getByText("Lažni AAI@EduHr")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(`/app/chrome${PATH}`);
});

test("a server error shows a message and retry can load the notice", async ({ page }) => {
  await studentSession(page);
  let available = false;
  await page.route(API, (route) => available
    ? route.fulfill({ json: { ...notice, readAt: TIME } })
    : route.fulfill({ status: 503, json: { code: "unavailable" } }));
  await page.goto(`/app/web${PATH}`);
  await expect(page.getByText("Zadatak trenutačno nije moguće učitati. Pokušajte ponovno.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Pročitao/ })).toHaveCount(0);
  available = true;
  await page.getByRole("button", { name: "Pokušaj ponovno" }).click();
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
});
