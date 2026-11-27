// ED-10 (NF2-P10, ASIST-1..9): the Asistent card asks, records and shows the conversation.
// Invented assignment, invented server: the request route answers as the contract says and the
// conversation route returns what was recorded.
import { axe, hiddenFocus, setTheme } from "./a11y/check";

import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c60";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d50";
const CONV = "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f";
const SCOPE = "d".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0010";
const PATH = `/aplikacija/rad/${ID}`;
const ANSWER = "Izmišljeni odgovor: rečenica je jasna, zarez nakon uvoda nije potreban.";

const noticeBody = (over: Record<string, unknown> = {}) => ({
  assignmentId: ID, versionNo: 1, templateVersion: 1, title: "Izmišljeni esej o gradskim vrtovima",
  instructions: "Opišite izmišljeni vrt.", workType: "essay", opensAt: "2025-11-02T08:00:00.000Z",
  dueAt: "2099-12-15T22:59:00.000Z", aiPolicy: "partially_allowed",
  aiPurposes: ["formatting", "proofreading", "transcription"], evidenceProfile: "basic",
  wordMin: 500, wordMax: 1500, readAt: null, acknowledgedAt: "2025-11-03T09:20:00.000Z", ...over,
});

type Reply = { status: number; json: unknown };
type Server = { requests: { body: Record<string, unknown>; key: string | null }[]; replies: Reply[] };

const completed = (text = ANSWER): Reply => ({ status: 200, json: {
  outcome: "completed", requestId: "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e", conversationId: CONV,
  response: { id: "2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f", text },
} });
const settled = (outcome: string, conversationId: string | null = null): Reply =>
  ({ status: 200, json: { outcome, requestId: null, conversationId } });

async function server(page: Page, notice: unknown, replies: Reply[]): Promise<Server> {
  const state: Server = { requests: [], replies };
  const recorded: { seq: number; role: string; content: string }[] = [];
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: SCOPE, sessionTag: TAG },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljeni esej o gradskim vrtovima", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
  await page.route(`**/api/v1/student/assignments/${ID}/notice`, (route) => route.fulfill({ json: notice }));
  await page.route("**/api/v1/student/assistant/requests", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    state.requests.push({ body, key: route.request().headers()["idempotency-key"] ?? null });
    const reply = state.replies.shift() ?? completed();
    const json = reply.json as { outcome?: string; conversationId?: string | null; response?: { text: string } };
    if (json.conversationId) {
      const at = recorded.length + 1;
      recorded.push({ seq: at, role: "student_paragraph", content: String(body.paragraph) });
      if (json.outcome === "completed") recorded.push({ seq: at + 1, role: "provider_response", content: json.response!.text });
    }
    await route.fulfill({ status: reply.status, json: reply.json });
  });
  await page.route(`**/api/v1/student/assistant/conversations/${CONV}`, (route) => route.fulfill({ json: {
    conversationId: CONV,
    messages: recorded.map((m) => ({
      seq: m.seq, id: `0${m.seq}0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f`, requestId: "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
      role: m.role, content: m.content, contentSha256: "e".repeat(64), createdAt: "2026-11-24T10:15:00.000Z", requestState: "completed",
    })),
  } }));
  return state;
}

async function skipGuide(page: Page) {
  const skip = page.getByRole("button", { name: "Preskoči vodič" });
  await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
}

async function openChat(page: Page, notice: unknown = noticeBody(), replies: Reply[] = []) {
  const state = await server(page, notice, replies);
  await page.goto(PATH);
  await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
  await skipGuide(page);
  if ((page.viewportSize()?.width ?? 1280) <= 640) {
    const drawer = page.getByRole("button", { name: "Bočni panel" });
    await drawer.focus();
    await page.keyboard.press("Enter");
  }
  const tab = page.getByRole("tab", { name: "Asistent" });
  await tab.focus();
  await page.keyboard.press("Enter");
  const chat = page.locator("[data-assistant-chat]");
  await expect(chat).toBeVisible({ timeout: 15_000 });
  return { chat, state };
}

test.describe("ED-10 Asistent", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("asks, records and shows the answer; the field gets focus back", async ({ page }) => {
    const { chat, state } = await openChat(page);
    await expect(chat.getByText("Odgovore daje Asistent, a ne Vi.")).toBeVisible();
    const purpose = chat.getByLabel("Svrha upita");
    await expect(purpose.locator("option")).toHaveText(["formatiranje", "lektura i jezična provjera"]);
    await purpose.selectOption("proofreading");
    const field = chat.getByLabel("Upit Asistentu");
    await field.fill("Je li ova izmišljena rečenica jasna?");
    await chat.getByRole("button", { name: "Pošalji Asistentu" }).click();
    await expect(chat.getByRole("status").filter({ hasText: "Asistent je odgovorio." })).toBeAttached();
    await expect(chat.getByText(ANSWER)).toBeVisible();
    await expect(chat.getByText("Razgovori (1)")).toBeVisible();
    await expect(field).toHaveValue("");
    await expect(field).toBeFocused();
    expect(state.requests).toHaveLength(1);
    expect(state.requests[0]!.body).toEqual({
      assignmentId: ID, conversationId: null, purposeCatalogVersion: 1, purposeKey: "proofreading",
      paragraph: "Je li ova izmišljena rečenica jasna?",
    });
    expect(state.requests[0]!.key).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("the next question continues the conversation; Novi razgovor starts a new one", async ({ page }) => {
    const { chat, state } = await openChat(page);
    const field = chat.getByLabel("Upit Asistentu");
    await field.fill("Prvo izmišljeno pitanje");
    await chat.getByRole("button", { name: "Pošalji Asistentu" }).click();
    await expect(chat.getByText(ANSWER)).toBeVisible();
    await field.fill("Drugo izmišljeno pitanje");
    await chat.getByRole("button", { name: "Pošalji Asistentu" }).click();
    await expect(chat.getByText("2 upita")).toBeVisible();
    expect(state.requests[1]!.body.conversationId).toBe(CONV);
    await chat.getByRole("button", { name: "Novi razgovor" }).click();
    await expect(chat.getByRole("status").filter({ hasText: "Novi razgovor. Sljedeći upit otvara novi zapis." })).toBeAttached();
    await expect(chat.getByRole("button", { name: "Novi razgovor" })).toBeDisabled();
  });

  test("an empty question is not sent", async ({ page }) => {
    const { chat, state } = await openChat(page);
    await chat.getByRole("button", { name: "Pošalji Asistentu" }).click();
    await expect(chat.getByText("Upišite upit.")).toBeVisible();
    await expect(chat.getByLabel("Upit Asistentu")).toBeFocused();
    expect(state.requests).toHaveLength(0);
  });

  test("a failed answer keeps the question; Pokušaj ponovno repeats it with the same key", async ({ page }) => {
    const { chat, state } = await openChat(page, noticeBody(), [{ status: 503, json: { error: "unavailable" } }]);
    await chat.getByLabel("Upit Asistentu").fill("Izmišljeno pitanje koje ne stigne");
    await chat.getByRole("button", { name: "Pošalji Asistentu" }).click();
    const alert = chat.getByRole("alert");
    await expect(alert).toContainText("Asistent trenutačno ne odgovara.");
    await expect(chat.getByLabel("Upit Asistentu")).toHaveValue("Izmišljeno pitanje koje ne stigne");
    await alert.getByRole("button", { name: "Pokušaj ponovno" }).click();
    await expect(chat.getByText(ANSWER)).toBeVisible();
    expect(state.requests).toHaveLength(2);
    expect(state.requests[1]!.key).toBe(state.requests[0]!.key);
  });

  test("another purpose after a failed answer is a new question with a new key", async ({ page }) => {
    const { chat, state } = await openChat(page, noticeBody(), [{ status: 503, json: { error: "unavailable" } }]);
    await chat.getByLabel("Svrha upita").selectOption("formatting");
    await chat.getByLabel("Upit Asistentu").fill("Izmišljeno pitanje koje ne stigne");
    await chat.getByRole("button", { name: "Pošalji Asistentu" }).click();
    await expect(chat.getByRole("alert")).toContainText("Asistent trenutačno ne odgovara.");
    await chat.getByLabel("Svrha upita").selectOption("proofreading");
    await chat.getByRole("button", { name: "Pošalji Asistentu" }).click();
    await expect(chat.getByText(ANSWER)).toBeVisible();
    expect(state.requests).toHaveLength(2);
    expect(state.requests[1]!.body.purposeKey).toBe("proofreading");
    expect(state.requests[1]!.key).not.toBe(state.requests[0]!.key);
  });

  test("the form stays busy until the conversation is read; a newer draft is never cleared", async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { chat, state } = await openChat(page);
    // Registered last, so it wins over the conversation route of server(): the read waits for the gate.
    await page.route(`**/api/v1/student/assistant/conversations/${CONV}`, async (route) => { await gate; await route.fallback(); });
    const field = chat.getByLabel("Upit Asistentu");
    await field.fill("Izmišljeno pitanje sa sporim čitanjem");
    await chat.getByRole("button", { name: "Pošalji Asistentu" }).click();
    await expect.poll(() => state.requests.length).toBe(1);
    await expect(field).toBeDisabled();
    await expect(chat.getByRole("button", { name: "Pošalji Asistentu" })).toBeDisabled();
    release();
    await expect(chat.getByText(ANSWER)).toBeVisible();
    await expect(field).toBeEnabled();
    await expect(field).toHaveValue("");
    expect(state.requests).toHaveLength(1);
  });

  test("an in-progress answer keeps the request: asking again repeats the same key", async ({ page }) => {
    const { chat, state } = await openChat(page, noticeBody(), [settled("in_progress")]);
    const field = chat.getByLabel("Upit Asistentu");
    await field.fill("Izmišljeno pitanje koje još traje");
    await chat.getByRole("button", { name: "Pošalji Asistentu" }).click();
    await expect(field).toHaveValue("Izmišljeno pitanje koje još traje");
    await expect(field).toBeEnabled();
    await chat.getByRole("button", { name: "Pošalji Asistentu" }).click();
    await expect(chat.getByText(ANSWER)).toBeVisible();
    expect(state.requests).toHaveLength(2);
    expect(state.requests[1]!.key).toBe(state.requests[0]!.key);
    expect(state.requests[1]!.body).toEqual(state.requests[0]!.body);
  });

  test("closing the panel on a narrow screen keeps the draft, the conversation and a failed request's key", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const { chat, state } = await openChat(page, noticeBody(), [completed(), { status: 503, json: { error: "unavailable" } }]);
    const field = chat.getByLabel("Upit Asistentu");
    await field.fill("Prvo izmišljeno pitanje");
    await chat.getByRole("button", { name: "Pošalji Asistentu" }).click();
    await expect(chat.getByText(ANSWER)).toBeVisible();
    await field.fill("Drugo izmišljeno pitanje koje ne stigne");
    await chat.getByRole("button", { name: "Pošalji Asistentu" }).click();
    await expect(chat.getByRole("alert")).toContainText("Asistent trenutačno ne odgovara.");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-assistant-chat]")).toHaveCount(0);
    const drawer = page.getByRole("button", { name: "Bočni panel" });
    await drawer.focus();
    await page.keyboard.press("Enter");
    const tab = page.getByRole("tab", { name: "Asistent" });
    await tab.focus();
    await page.keyboard.press("Enter");
    const again = page.locator("[data-assistant-chat]");
    await expect(again.getByLabel("Upit Asistentu")).toHaveValue("Drugo izmišljeno pitanje koje ne stigne");
    await again.getByRole("button", { name: "Pošalji Asistentu" }).click();
    await expect(again.getByText("2 upita")).toBeVisible();
    expect(state.requests).toHaveLength(3);
    expect(state.requests[2]!.key).toBe(state.requests[1]!.key);
    expect(state.requests[2]!.body.conversationId).toBe(CONV);
  });

  test("conversations are kept per person: another sign-in on the device sees none of them", async ({ page }) => {
    await page.addInitScript(([id, conv]) => {
      localStorage.setItem(`ductura.asistent.razgovori.${"b".repeat(64)}.${id}`, JSON.stringify([{ id: conv, purposeKey: "proofreading" }]));
    }, [ID, CONV]);
    const { chat } = await openChat(page);
    await expect(chat.getByText("Još nema razgovora.", { exact: false })).toBeVisible();
    await expect(chat.getByText("Učitavam razgovor…")).toHaveCount(0);
  });

  test("the usage limit stops new questions, without a number", async ({ page }) => {
    const { chat } = await openChat(page, noticeBody(), [settled("budget_exceeded")]);
    await chat.getByLabel("Upit Asistentu").fill("Izmišljeno pitanje");
    await chat.getByRole("button", { name: "Pošalji Asistentu" }).click();
    await expect(chat.getByText("Dosegnuto je ograničenje uporabe.")).toBeVisible();
    await expect(chat.getByRole("button", { name: "Pošalji Asistentu" })).toHaveCount(0);
    await expect(chat).not.toContainText(/\d+ upita/);
  });

  test("a switched-off Asistent says so", async ({ page }) => {
    const { chat } = await openChat(page, noticeBody(), [settled("ai_disabled")]);
    await chat.getByLabel("Upit Asistentu").fill("Izmišljeno pitanje");
    await chat.getByRole("button", { name: "Pošalji Asistentu" }).click();
    await expect(chat.getByText("Asistent trenutačno nije uključen.")).toBeVisible();
    await expect(chat.getByRole("button", { name: "Pošalji Asistentu" })).toHaveCount(0);
  });

  test("a notice that forbids tools shows no form", async ({ page }) => {
    const { chat } = await openChat(page, noticeBody({ aiPolicy: "prohibited", aiPurposes: [] }));
    await expect(chat.getByText("Asistent nije dostupan.")).toBeVisible();
    await expect(chat.getByLabel("Upit Asistentu")).toHaveCount(0);
  });

  test("without a network the form waits", async ({ page, context }) => {
    const { chat } = await openChat(page);
    await context.setOffline(true);
    await expect(chat.getByText("Bez mreže.")).toBeVisible();
    await expect(chat.getByLabel("Upit Asistentu")).toBeDisabled();
    await context.setOffline(false);
    await expect(chat.getByLabel("Upit Asistentu")).toBeEnabled();
  });

  test("keyboard: purpose, question, send", async ({ page }) => {
    const { chat, state } = await openChat(page);
    const purpose = chat.getByLabel("Svrha upita");
    await purpose.focus();
    await page.keyboard.press("Tab");
    await expect(chat.getByLabel("Upit Asistentu")).toBeFocused();
    await page.keyboard.type("Izmišljeno pitanje s tipkovnice");
    await page.keyboard.press("Tab");
    await expect(chat.getByRole("button", { name: "Pošalji Asistentu" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(chat.getByText(ANSWER)).toBeVisible();
    expect(state.requests).toHaveLength(1);
    expect(await hiddenFocus(page)).toEqual([]);
  });

  for (const width of [390, 1280]) {
    for (const theme of ["dark", "light"] as const) {
      test(`axe ${width} ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const { chat } = await openChat(page, noticeBody(), [settled("provider_failed", CONV)]);
        await chat.getByLabel("Upit Asistentu").fill("Izmišljeno pitanje");
        await chat.getByRole("button", { name: "Pošalji Asistentu" }).click();
        await expect(chat.getByRole("alert")).toBeVisible();
        await expect(chat.getByText("Razgovori (1)")).toBeVisible();
        await setTheme(page, theme);
        await axe(page, test.info(), `ed10-asistent-${width}-${theme}`);
      });
    }
  }
});
