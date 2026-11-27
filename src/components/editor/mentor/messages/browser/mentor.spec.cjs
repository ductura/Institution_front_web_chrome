const { expect, test } = require("@playwright/test");

const fixture = "/__fixture/mentor";
const api = "**/api/v1/works/demo-work";
const milestoneId = "d1911bec-aec8-4774-ac96-e6792dfb280b";

function serveFixture(page) {
  return page.route(`**${fixture}*`, (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html lang="hr"><head><meta charset="utf-8"><title>Mentor</title></head>
      <body><main id="app"></main>
      <script type="module" src="/src/components/editor/mentor/messages/browser/fixture.spec.tsx"></script></body></html>`,
  }));
}

test("the teacher changes a deadline and both accounts read the same saved time", async ({ browser }) => {
  const teacher = await browser.newPage({ timezoneId: "America/Los_Angeles" });
  const student = await browser.newPage({ timezoneId: "Asia/Tokyo" });
  // Shape of work.milestone-states.get (the "Etape" card, WEB-1520), not the retired /milestones read.
  let milestone = {
    id: milestoneId, title: "Izmišljeni nacrt", description: "Raspored poglavlja.", state: "not_submitted",
    dueAt: "2026-11-27T16:00:00.000Z", everSubmitted: false, submittedRevisionId: null, submittedAt: null,
    revisionComment: null, revisionDueAt: null, revisionRequestedAt: null, approvedAt: null, approvalMessage: null,
  };
  let writes = 0;

  for (const page of [teacher, student]) {
    await serveFixture(page);
    await page.route(`${api}/milestone-states`, (route) => {
      expect(route.request().method()).toBe("GET");
      expect(route.request().postData()).toBeNull();
      return route.fulfill({ json: { milestones: [milestone] } });
    });
    await page.route(`${api}/messages`, (route) => route.fulfill({ json: { messages: [] } }));
  }
  await teacher.route(`${api}/milestones/${milestoneId}/details`, (route) => {
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().postDataJSON()).toEqual({ dueAt: "2026-12-01T14:30:00.000Z" });
    writes++;
    milestone = { ...milestone, ...route.request().postDataJSON() };
    return route.fulfill({ json: milestone });
  });

  await student.goto(`${fixture}?role=student`);
  await student.getByText("Etape, 0 od 1 odobreno").click();
  await expect(student.locator("time")).toHaveText("27. studenoga 2026. 17:00");

  await teacher.goto(`${fixture}?role=teacher`);
  await teacher.getByText("Etape, 0 od 1 odobreno").click();
  await expect(teacher.locator("time")).toHaveText("27. studenoga 2026. 17:00");
  await teacher.getByRole("button", { name: "Uredi etape" }).click();
  const editor = teacher.getByRole("dialog", { name: "Uredi etape" });
  await editor.getByRole("textbox", { name: "Rok" }).fill("2026-12-01T15:30");
  await editor.getByRole("button", { name: "Spremi" }).click();
  await editor.getByRole("button", { name: "Zatvori" }).click();
  await expect(teacher.locator("time")).toHaveText("1. prosinca 2026. 15:30");
  expect(writes).toBe(1);

  await student.reload();
  await student.getByText("Etape, 0 od 1 odobreno").click();
  await expect(student.locator("time")).toHaveText("1. prosinca 2026. 15:30");
  await expect(student.getByRole("button", { name: "Uredi etape" })).toHaveCount(0);

  await teacher.goto(`${fixture}?role=teacher&submitted`);
  await teacher.getByText("Etape, 0 od 1 odobreno").click();
  await expect(teacher.locator("time")).toHaveText("1. prosinca 2026. 15:30");
  await expect(teacher.getByRole("button", { name: "Uredi etape" })).toHaveCount(0);
  await teacher.close();
  await student.close();
});

test("blank and refused messages keep the draft, and a saved message survives refresh", async ({ page }) => {
  await serveFixture(page);
  const messages = [];
  let attempts = 0;
  const text = "Ovo je izmišljena poruka uz rad.";
  await page.route(`${api}/milestone-states`, (route) => route.fulfill({ json: { milestones: [] } }));
  await page.route(`${api}/messages`, (route) => {
    if (route.request().method() === "GET") {
      expect(route.request().postData()).toBeNull();
      return route.fulfill({ json: { messages } });
    }
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ text });
    if (++attempts === 1) return route.fulfill({ status: 422, json: { error: "invalid_input" } });
    const saved = {
      id: "c1911bec-aec8-4774-ac96-e6792dfb282b", senderRole: "student", text, createdAt: "2026-12-01T14:30:00.000Z",
    };
    messages.push(saved);
    return route.fulfill({ status: 201, json: saved });
  });

  await page.goto(fixture);
  await page.getByText("Poruke (0)", { exact: true }).click();
  const field = page.getByRole("textbox", { name: "Poruka mentoru" });
  const send = page.getByRole("button", { name: "Pošalji" });
  await field.fill("   ");
  await send.click();
  await expect(field).toHaveValue("   ");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Upišite poruku.")).toBeVisible();
  expect(attempts).toBe(0);

  await field.fill(text);
  await send.click();
  await expect(page.getByText("Poslužitelj je odbio poruku. Provjerite tekst.")).toBeVisible();
  await expect(field).toHaveValue(text);
  await send.click();
  await expect(field).toHaveValue("");
  await expect(page.getByText(text, { exact: true })).toBeVisible();

  await page.reload();
  await page.getByText("Poruke (1)", { exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();

  await page.goto(`${fixture}?role=teacher`);
  await page.getByText("Poruke (1)", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Poruka studentu" })).toBeVisible();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
});
