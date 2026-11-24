// WEB-NF5-IZVOZ-MOB (NF-5 PG-11, PG-12, PG-13): export, print, the phone and accessibility of "Pregled rada", against
// a fake institution server. Invented work, student and course only; no request leaves the browser.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "./fixtures/test";

import type ContractVectors from "../../../src/client/migration-contract-vectors.generated.json";

import { axe, setTheme } from "./a11y/check";
import { exportMessages as x } from "../src/host/teacher/work/review/export-messages.hr";
import { reviewMessages as t } from "../src/host/teacher/work/review/messages.hr";
import { pgMessages as p } from "../src/host/teacher/work/review/pg-messages.hr";

const BYTES = Buffer.from("%PDF-1.7 izmisljeni rad za e2e izvoza");
const PDF = { filename: "rad.pdf", pdfBase64: BYTES.toString("base64"), outputSha256: createHash("sha256").update(BYTES).digest("hex"),
  format: "pdf", reportHash: null, docxBase64: "UEsDBA==", noticeKey: "workExport.plainPdf" };

const vectors = JSON.parse(readFileSync(
  new URL("../../../src/client/migration-contract-vectors.generated.json", import.meta.url), "utf8",
)) as typeof ContractVectors;
const profile = vectors.find((v) => v.route === "profile.me.get" && v.name === "teacher-without-name")!.response.body;
const profileBody = { ...profile, roles: ["teacher"] };
const documentId = "rad-izmisljeni-pregled";
const previousId = "rad-izmisljeni-prethodni";
const assignmentId = "00000000-0000-4000-8000-0000000000a1";
const studentId = "00000000-0000-4000-8000-0000000000e1";
const review = `/app/web/nastavnik/rad/${documentId}/pregled`;
const SUMMARY = {
  summaryFormat: "ductus-process-summary-v1",
  sessions: { evidenceKind: "observed", breakAboveMinutes: 30, count: 0, items: [] },
  pastes: { evidenceKind: "observed", listedAboveCharacters: 200, listed: [{ at: { from: "2026-11-10T09:40:00.000Z", to: "2026-11-10T09:40:00.000Z" }, characters: 420, origin: "not_observed" }], smallerCount: 1 },
  gaps: { evidenceKind: "observed", items: [] },
  recordState: "complete",
};
const FINDING = {
  segmentRef: "odsjecak-1", conversationId: "00000000-0000-4000-8000-0000000000c1", messageId: "00000000-0000-4000-8000-0000000000f1",
  runWords: 12, recordedAt: "2026-11-01T10:00:00.000Z", attachedAt: "2026-11-02T10:00:00.000Z", explanation: null,
};

async function fakeServer(page: Page, { practice = false }: { practice?: boolean } = {}) {
  let detailsFail = false;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    switch (path) {
      case "/api/v1/me": return route.fulfill({ json: profileBody });
      case "/api/v1/teacher/access": return route.fulfill({ json: { access: "allowed", scope: "a".repeat(64) } });
      case "/api/v1/profile/interface-locale": return route.fulfill({ json: { locale: null } });
      case "/api/v1/teacher/courses": return route.fulfill({ json: { courses: [{
        id: "00000000-0000-4000-8000-0000000000b1", name: "Kolegij A", academicYear: "2026/2027", aiPolicy: "partially_allowed",
        assignments: [{ id: assignmentId, title: "Lokalni mediji", workType: "seminar_paper", opensAt: "2026-10-01T08:00:00.000Z",
          dueAt: "2026-11-30T22:59:00.000Z", currentVersion: 1, enrolledStudents: 12 }],
      }] } });
      case `/api/v1/teacher/works/${documentId}`: return route.fulfill({ json: {
        documentId, studentId, studentName: "Student A", assignmentId, state: "nije_predano", prevDocumentId: previousId, nextDocumentId: null,
      } });
      case `/api/v1/teacher/assignments/${assignmentId}/grade`: return practice
        ? route.fulfill({ status: 409, json: { error: "practice_assignment" } }) : route.fulfill({ json: { eligible: true } });
      case `/api/v1/assignments/${assignmentId}/works/${documentId}/export/pdf`: return route.fulfill({ json: PDF });
      case "/api/v1/process-summary": return route.fulfill({ json: SUMMARY });
      case "/api/v1/process-summary/details": return detailsFail ? route.fulfill({ status: 503, json: { error: "unavailable" } })
        : route.fulfill({ json: { summary: SUMMARY, activeEditingMinutes: 12, keyEvents: [{ kind: "ai-transfer", at: { from: "2026-11-10T09:10:00.000Z", to: "2026-11-10T09:10:00.000Z" } }] } });
      case `/api/v1/works/${documentId}/event-disputes`: return route.fulfill({ json: { disputes: [{ disputeId: "00000000-0000-4000-8000-0000000000d1", kind: "dispute", eventId: "paste.1", text: "Izmišljeno objašnjenje studenta.", createdAt: "2026-11-11T10:00:00.000Z" }] } });
      case `/api/v1/works/${documentId}/comment-drafts`: return route.fulfill({ json: { drafts: [{ threadId: "00000000-0000-4000-8000-0000000000a9", commentId: "00000000-0000-4000-8000-0000000000a8", position: 1, text: "Izmišljen nacrt.", anchor: null, state: "open", createdWindow: "2026-11-12T12:00:00.000Z" }] } });
      case `/api/v1/works/${documentId}/origin-thresholds`: return route.fulfill({ json: { comparison: [{ origin: "pasted_unknown", state: "for_review" }] } });
      case `/api/v1/works/${documentId}/assistant-match`: return route.fulfill({ json: { findings: [FINDING] } });
      case "/api/v1/comments/list": return route.fulfill({ json: { comments: [{
        threadId: "00000000-0000-4000-8000-0000000000a7", commentId: "00000000-0000-4000-8000-0000000000a6", position: 1, authorRole: "teacher", isOwn: true,
        body: "Izmišljen komentar.", anchor: null, state: "open", createdWindow: "2026-11-12T10:00:00.000Z", deletedWindow: null, revision: 1 }] } });
      case `/api/v1/works/${documentId}/origin-composition`: return route.fulfill({ json: { parts: [
        { kind: "typed", percent: 86 }, { kind: "assistant_inserted", percent: 0 }, { kind: "assistant_match", percent: 4 },
        { kind: "imported_file", percent: 0 }, { kind: "pasted_known", percent: 0 }, { kind: "pasted_unknown", percent: 10 },
      ] } });
      case `/api/v1/teacher/assignments/${assignmentId}/students/${studentId}/declaration`:
        return route.fulfill({ json: { state: "none", payload: null, declarationSha256: null } });
      default: return route.fallback();
    }
  });
  return { failDetails: () => { detailsFail = true; }, recoverDetails: () => { detailsFail = false; } };
}


test("PG-11: „Izvezi PDF rada” downloads the file the server vouched for and says its fingerprint", async ({ page }) => {
  await fakeServer(page);
  await page.goto(review);
  const panel = page.locator('[data-nf5="PG-11"]');
  await expect(panel.getByText(x.warning)).toBeVisible();
  const download = page.waitForEvent("download");
  await panel.getByRole("button", { name: x.pdf }).click();
  expect((await download).suggestedFilename()).toMatch(/^rad-Student-A-\d{4}-\d{2}-\d{2}\.pdf$/);
  await expect(panel.getByRole("status")).toContainText(`Otisak datoteke: ${PDF.outputSha256.slice(0, 12)}…`);
});

test("PG-11: on paper every view prints under the header, without tabs or buttons", async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => { (window as { printed?: number }).printed = ((window as { printed?: number }).printed ?? 0) + 1; window.dispatchEvent(new Event("beforeprint")); };
  });
  await fakeServer(page);
  await page.goto(review);
  await page.getByRole("button", { name: x.print }).click();
  expect(await page.evaluate(() => (window as { printed?: number }).printed)).toBe(1);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("[data-print-only]")).toBeVisible();
  await expect(page.locator("[data-print-only]")).toContainText("nije dokaz autorstva");
  await expect(page.getByRole("tablist")).toBeHidden();
  await expect(page.locator('[data-nf5="PG-11"]')).toBeHidden();
  for (const nf of ["PG-3", "PG-5", "PG-7", "PG-9"]) await expect(page.locator(`[data-nf5="${nf}"]`)).toBeVisible();
  await expect(page.getByRole("heading", { name: t.tabSummary })).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await expect(page.locator("[data-print-only]")).toBeHidden();
  await expect(page.locator('[data-nf5="PG-3"]')).toBeHidden();
});

test("PG-11: a practice assignment offers neither export nor print", async ({ page }) => {
  await fakeServer(page, { practice: true });
  await page.goto(review);
  const panel = page.locator('[data-nf5="PG-11"]');
  await expect(panel.getByText(x.practice)).toBeVisible();
  await expect(panel.getByRole("button")).toHaveCount(0);
});

test("PG-12: on a 390 px phone the tables are cards, the controls 44 px and nothing scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeServer(page);
  await page.goto(`${review}?kartica=podrijetlo`);
  const section = page.locator('[data-nf5="PG-3"]');
  await expect(section.locator("li")).toHaveCount(3);
  await expect(section.locator("table")).toHaveCount(0);
  await expect(section.locator("li").first().locator("dt").first()).toHaveText(p.colKind);
  for (const control of [page.getByRole("tab", { name: t.tabOrigin }), page.getByRole("button", { name: x.pdf }), page.getByRole("button", { name: x.print })]) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(scroll).toBeLessThanOrEqual(0);
});

test("PG-13: the tabs work by keyboard and the export is reachable with Tab", async ({ page }) => {
  await fakeServer(page);
  await page.goto(review);
  await page.getByRole("tab", { name: t.tabText }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: t.tabSummary })).toBeFocused();
  await expect(page.getByRole("tab", { name: t.tabSummary })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: t.tabDeclaration })).toBeFocused();
  await page.getByRole("button", { name: x.pdf }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: x.print })).toBeFocused();
});

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    for (const tab of ["sazetak", "izjava"]) {
      test(`PG-13 axe: the review tab ${tab} with export at ${width} px, ${theme} theme`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await fakeServer(page);
        await page.goto(`${review}?kartica=${tab}`);
        await expect(page.locator('[data-nf5="PG-11"]')).toBeVisible();
        await expect(page.getByText(/Učitavam/)).toHaveCount(0);
        await setTheme(page, theme);
        await axe(page, info, `pregled-nf5-izvoz-${tab}-${width}-${theme}`);
        const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(scroll).toBeLessThanOrEqual(0);
      });
    }
  }
}
