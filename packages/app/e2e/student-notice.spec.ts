import { expect, test, type Page } from "@playwright/test";

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

test("renders the notice, waits for both writes and restores the confirmation on reload", async ({ page }) => {
  await studentSession(page);
  let readAt: string | null = null;
  let acknowledgedAt: string | null = null;
  let writes = 0;
  const markResponse = pauseResponse();
  const ackResponse = pauseResponse();

  await page.route(API, (route) => route.fulfill({ json: { ...notice, readAt, acknowledgedAt } }));
  await page.route(`${API}-read`, async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ versionNo: notice.versionNo });
    await markResponse.wait;
    readAt = TIME;
    await route.fulfill({ json: { readAt } });
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
  await expect(page.getByText("Bilježi se da je obavijest otvorena…")).toBeVisible();
  await expect(page.getByText(/^Na poslužitelju je zabilježeno/)).toHaveCount(0);
  markResponse.release();
  await expect(page.getByText(/^Na poslužitelju je zabilježeno/)).toBeVisible();

  const submit = page.getByRole("button", { name: "Potvrdi i otvori editor" });
  await expect(submit).toBeDisabled();
  await page.getByRole("checkbox", { name: /Pročitao\/la sam obavijest/ }).check();
  await submit.click();
  await expect(page.getByRole("button", { name: "Potvrđivanje…" })).toBeDisabled();
  const editor = page.getByRole("link", { name: "Otvori editor" });
  await expect(editor).toHaveCount(0);
  ackResponse.release();
  await expect(editor).toHaveJSProperty("pathname", `/app/web/rad/${ID}`);
  await expect(editor).toHaveJSProperty("search", "");
  await page.reload();
  await expect(editor).toHaveJSProperty("pathname", `/app/web/rad/${ID}`);
  await editor.click();
  // The editor link routes on the client; wait for the address rather than read it once.
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/app/web/rad/${ID}`);
  expect(writes).toBe(1);
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
