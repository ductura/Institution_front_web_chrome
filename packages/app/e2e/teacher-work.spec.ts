import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import type ContractVectors from "../../../src/client/migration-contract-vectors.generated.json";
import { canonicalizeJcs } from "../../editor-core/src/document/forensics/jcs";
import { REVISION_ZERO_JCS } from "../../editor-core/src/document/document/revision-zero";
import { mentorWorkHr } from "../../../src/components/editor/mentor/work-state/messages.hr";
import { consultationMessages } from "../../../src/components/teacher/consultation-records/messages.hr";
import { messagesHr as t } from "../../../src/lib/i18n/messages.hr";
import { n07Messages } from "../src/host/teacher/n07/messages.hr";

const assignmentId = "00000000-0000-4000-8000-0000000000a1";
const studentId = "00000000-0000-4000-8000-0000000000e1";
const vectors = JSON.parse(readFileSync(
  new URL("../../../src/client/migration-contract-vectors.generated.json", import.meta.url), "utf8",
)) as typeof ContractVectors;
const signed = vectors.find((v) => v.route === "teacher.submission-receipt.get"
  && "state" in v.response.body && v.response.body.state === "potvrdeno")!.response.body;
if (!("receipt" in signed) || !signed.receipt) throw new Error("Missing signed receipt vector");
const documentId = signed.receipt.payload.documentId;
if (typeof documentId !== "string") throw new Error("Missing documentId in signed receipt vector");
const workBody = vectors.find((v) => v.route === "teacher.work.get" && v.name === "submitted-work")!.response.body;
const profile = vectors.find((v) => v.route === "profile.me.get" && v.name === "teacher-without-name")!.response.body;
const profileBody = { ...profile, roles: ["teacher"] };
const path = `/nastavnik/rad/${encodeURIComponent(documentId)}`;
const work = `/app/web${path}`;
const receiptPath = `/api/v1/teacher/assignments/${assignmentId}/students/${studentId}/submission`;
const consultationPath = `/api/v1/works/${documentId}/consultation-records`;
const text = "Izmišljeni odlomak o gradskim vrtovima.";
const manuscript = JSON.parse(REVISION_ZERO_JCS);
manuscript.nodes[0].children = [{ type: "text", marks: [], text }];
const snapshot = canonicalizeJcs(manuscript);
const etag = `"${createHash("sha256").update(snapshot).digest("hex")}"`;

async function fakeServer(page: Page, initial: 200 | 401 | 503 = 200) {
  let access = initial;
  const seen: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    seen.push(url.pathname);
    switch (url.pathname) {
      case "/api/v1/me": return route.fulfill({ json: profileBody });
      case "/api/v1/teacher/access": return route.fulfill({ status: access,
        json: access === 200 ? { access: "allowed", scope: "a".repeat(64) }
          : { error: access === 401 ? "unauthorized" : "unavailable" } });
      case "/api/v1/teacher/courses": return route.fulfill({ json: { courses: [] } });
      // WEB-1804: the host reads the saved interface language once signed in; none is saved here.
      case "/api/v1/profile/interface-locale": return route.fulfill({ json: { locale: null } });
      case "/api/v1/auth/login": return route.fulfill({ contentType: "text/html", body: "<p>Lažni AAI@EduHr</p>" });
      case `/api/v1/live/${documentId}`: return route.fulfill({
        contentType: "application/json", body: snapshot, headers: { etag },
      });
      case "/api/v1/process-summary": return route.fulfill({ status: 404, json: { error: "not_found" } });
      case "/api/v1/comments/list": return route.fulfill({ json: { comments: [] } });
      case "/api/v1/evidence/replay": return route.fulfill({ json: {
        replayFormat: "ductus-evidence-replay-v1", segmentCount: 0, head: null,
        from: 0, next: null, startDocument: null, segments: [], resumeDocuments: {},
      } });
      case `/api/v1/teacher/works/${documentId}`: return route.fulfill({ json: workBody });
      case receiptPath: return route.fulfill({ json: signed });
      case consultationPath: return route.fulfill({ json: { records: [] } });
      case `/api/v1/works/${documentId}/milestones`: return route.fulfill({ json: { milestones: [] } });
      case `/api/v1/works/${documentId}/versions`: return route.fulfill({ json: {
        versions: [{ kind: "submission", revision: 1, savedMinute: "2026-11-20T12:00:00.000Z", afterDeadline: false }],
        nextBeforeRevision: null,
      } });
      default: throw new Error(`Unexpected fake API request ${url.pathname}`);
    }
  });
  return { seen, allow: () => { access = 200; } };
}

test("teacher opens the live text, replay, signed receipt and consultations under the same base", async ({ page }) => {
  const { seen } = await fakeServer(page);
  await page.goto(work);
  await expect(page.getByText(text)).toBeVisible();
  await expect(page.getByRole("heading", { name: t.comments.title })).toBeVisible();
  await page.getByText(mentorWorkHr.mentor, { exact: true }).click();
  await expect(page.getByRole("link", { name: mentorWorkHr.receipt, exact: true })).toHaveAttribute("href", `${work}/predaja`);
  await page.getByRole("link", { name: t.replay.titleTeacher }).click();
  await expect(page).toHaveURL(`${work}/reprodukcija`);
  await expect(page.getByText(t.replay.empty)).toBeVisible();
  await page.getByRole("link", { name: consultationMessages.backToWork }).click();
  await page.getByRole("link", { name: t.receipt.title }).click();
  await expect(page).toHaveURL(`${work}/predaja`);
  await expect(page.getByText("Iva Izmišljena")).toBeVisible();
  await expect(page.getByText(/\bPredano\b/)).toBeVisible();
  await page.getByRole("link", { name: t.receipt.summary }).click();
  await expect(page).toHaveURL(`${work}#sazetak-procesa`);
  await page.getByRole("link", { name: consultationMessages.title, exact: true }).click();
  await expect(page).toHaveURL(`${work}/konzultacije`);
  await expect(page.getByText(consultationMessages.empty)).toBeVisible();
  await expect(page.getByRole("link", { name: consultationMessages.backToWork })).toHaveAttribute("href", work);
  await page.getByRole("button", { name: consultationMessages.new }).click();
  await expect(page).toHaveURL(`${work}/konzultacije?novi=1`);
  expect(seen).toContain("/api/v1/comments/list");
  expect(seen).toContain(receiptPath);
});

test("teacher access 401 sends the browser back to the requested view after login", async ({ page }) => {
  const { seen } = await fakeServer(page, 401);
  const requested = `/app/chrome${path}/reprodukcija`;
  await page.goto(requested);
  await expect(page).toHaveURL(/\/api\/v1\/auth\/login\?returnTo=/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(requested);
  expect(seen).not.toContain("/api/v1/evidence/replay");
});

test("access and receipt errors show a retry and recover after a fresh read", async ({ page }) => {
  const { allow } = await fakeServer(page, 503);
  let failReceipt = true;
  await page.route(`**${receiptPath}`, (route) => failReceipt
    ? route.fulfill({ status: 503, json: { error: "unavailable" } }) : route.fallback());
  await page.goto(`${work}/predaja`);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Pristup radu trenutačno nije moguće provjeriti.");
  await expect(page.getByText(/\bPredano\b/)).toHaveCount(0);
  allow();
  await page.getByRole("button", { name: t.teacherLiveWork.retry }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(n07Messages.error);
  failReceipt = false;
  await page.getByRole("button", { name: n07Messages.retry }).click();
  await expect(page.getByText(/\bPredano\b/)).toBeVisible();
});

test("the anchored comment is shown after the server confirms and returns it", async ({ page }) => {
  await fakeServer(page);
  const comment = "Pojasnite kako ste odabrali primjere vrtova.";
  const id = "00000000-0000-4000-8000-000000000001";
  let finish!: () => void;
  const accepted = new Promise<void>((resolve) => { finish = resolve; });
  let recorded: unknown;
  await page.route("**/api/v1/comments/create", async (route) => {
    expect(route.request().method()).toBe("POST");
    const input = route.request().postDataJSON();
    expect(input).toMatchObject({ documentId, body: comment, anchor: { quote: text } });
    await accepted;
    recorded = { threadId: id, commentId: id, position: 1, authorRole: "teacher", isOwn: true,
      body: comment, anchor: input.anchor, state: "open", createdWindow: "2026-11-20T12:00:00.000Z", deletedWindow: null };
    await route.fulfill({ json: { id } });
  });
  await page.route("**/api/v1/comments/list", (route) => route.fulfill({ json: { comments: recorded ? [recorded] : [] } }));
  try {
    await page.goto(work);
    await expect(page.getByText(t.teacherComments.empty)).toBeVisible();
    await page.getByText(text).evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    const form = page.getByRole("form", { name: t.teacherComments.newTitle });
    await form.getByRole("textbox").fill(comment);
    await form.getByRole("button", { name: t.teacherComments.publish }).click();
    await expect(form.getByRole("button", { name: t.teacherComments.publishing })).toBeVisible();
    await expect(page.getByText(t.teacherComments.empty)).toBeVisible();
  } finally {
    finish();
  }
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
});
