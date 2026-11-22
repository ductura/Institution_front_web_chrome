import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import type ContractVectors from "../../../src/client/migration-contract-vectors.generated.json";
import { canonicalizeJcs } from "../../editor-core/src/document/forensics/jcs";
import { REVISION_ZERO_JCS } from "../../editor-core/src/document/document/revision-zero";
import { mentorWorkHr } from "../../../src/components/editor/mentor/work-state/messages.hr";
import { consultationMessages } from "../../../src/components/teacher/consultation-records/messages.hr";
import { mobileReviewMessages as mobile } from "../src/host/teacher/mobile-review/messages.hr";
import { messagesHr as t } from "../../../src/lib/i18n/messages.hr";

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
const text = "Izmišljeni odlomak o gradskim vrtovima. Nadkompostiranjeigradskihvrtovanaizmišljenomkvartu"
  + "nadkompostiranjeigradskihvrtovanaizmišljenomkvartu i još nekoliko riječi da redak prijeđe širinu zaslona.";
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
      case "/api/v1/comments/list": return route.fulfill({ json: { comments: [{
        threadId: "00000000-0000-4000-8000-000000000001", commentId: "00000000-0000-4000-8000-000000000001",
        position: 1, authorRole: "teacher", isOwn: true, body: "Izmišljeni komentar mentora uz ovaj odlomak.",
        anchor: { nodeId: "n1", start: 0, end: 10, quote: text.slice(0, 10) }, state: "open",
        createdWindow: "2026-11-20T12:00:00.000Z", deletedWindow: null }] } });
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


test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

test("mentor reads the work and its comments at 360 px without sideways scrolling", async ({ page }) => {
  await fakeServer(page);
  await page.goto(work);
  await expect(page.getByText(text)).toBeVisible();
  await expect(page.getByText("Izmišljeni komentar mentora uz ovaj odlomak.")).toBeVisible();
  const overflow = () => page.evaluate(() => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(await overflow()).toEqual({ page: 0, body: 0 });
  expect(await page.locator("[contenteditable=true], [contenteditable=''], textarea[name=text]").count()).toBe(0);
  await expect(page.getByRole("region", { name: mobile.region })).toBeVisible();
  await expectTargets(page);
  // The comment form (the only place text is typed) keeps the same guarantees.
  await page.getByText(text).evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await expect(page.getByRole("form", { name: t.teacherComments.newTitle })).toBeVisible();
  expect(await overflow()).toEqual({ page: 0, body: 0 });
  await expectTargets(page);
});

async function expectTargets(page: Page) {
  const small = await page.evaluate(() => {
    const controls = document.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]), textarea, select, summary, [role=button]");
    return [...controls].flatMap((el) => {
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) return [];
      return box.width < 24 || box.height < 24
        ? [`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`]
        : [];
    });
  });
  expect(small).toEqual([]);
}
