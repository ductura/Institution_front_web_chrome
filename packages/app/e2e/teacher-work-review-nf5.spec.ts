// WEB-NF5-PREGLED (NF-5 PG-3, PG-5, PG-7, PG-9): "Pregled rada", against a fake institution server.
// Invented work, student and course only; no request leaves the browser.
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "./fixtures/test";

import type ContractVectors from "../../../src/client/migration-contract-vectors.generated.json";

import { axe, setTheme } from "./a11y/check";
import { reviewMessages as t } from "../src/host/teacher/work/review/messages.hr";
import { pgMessages as p } from "../src/host/teacher/work/review/pg-messages.hr";

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

async function fakeServer(page: Page) {
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
      case `/api/v1/teacher/assignments/${assignmentId}/grade`: return route.fulfill({ json: { eligible: true } });
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

test("PG-3: every share carries what it means, what it does not and „nije dokaz autorstva”; the help is closed", async ({ page }) => {
  await fakeServer(page);
  await page.goto(`${review}?kartica=podrijetlo`);
  const section = page.locator('[data-nf5="PG-3"]');
  await expect(section.getByRole("heading", { name: p.compositionHeading })).toBeVisible();
  await expect(section.locator("tbody tr")).toHaveCount(3);
  await expect(section.locator("tbody tr").filter({ hasText: p.notProof })).toHaveCount(3);
  await expect(section.getByText(p.unknownNotice)).toBeVisible();
  await expect(section.locator("details")).not.toHaveAttribute("open", "");
  await section.getByText(p.helpSummary).focus();
  await page.keyboard.press("Enter");
  await expect(section.locator("details")).toHaveAttribute("open", "");
});

test("PG-5: the important places list, with no automatic playback; without the details it is never „nema”", async ({ page }) => {
  const { failDetails } = await fakeServer(page);
  failDetails();
  await page.goto(`${review}?kartica=reprodukcija`);
  const section = page.locator('[data-nf5="PG-5"]');
  await expect(section.locator("[data-details-unavailable]")).toBeVisible();
  await expect(section.getByText(p.placesNone)).toHaveCount(0);
  await expect(section.getByText("Lijepljenje, 420 znakova")).toBeVisible();
  await expect(section.locator("[aria-live]")).toHaveCount(0);
  await expect(section.getByRole("link", { name: p.placesJump })).toHaveAttribute("href", `/app/web/nastavnik/rad/${documentId}/reprodukcija`);
});

test("PG-5: with the details the transfer from the Asistent is listed too", async ({ page }) => {
  await fakeServer(page);
  await page.goto(`${review}?kartica=reprodukcija`);
  await expect(page.locator('[data-nf5="PG-5"] tbody tr')).toHaveCount(2);
  await expect(page.locator('[data-nf5="PG-5"]').getByText(p.transfer)).toBeVisible();
});

test("PG-7: the student's explanation is read before any conclusion, with the finding read said to be missing", async ({ page }) => {
  await fakeServer(page);
  await page.goto(`${review}?kartica=podrijetlo`);
  const section = page.locator('[data-nf5="PG-7"]');
  await expect(section.getByText("Izmišljeno objašnjenje studenta.")).toBeVisible();
  await expect(section.getByText(p.eventOrdinal(1))).toBeVisible();
  await expect(section.locator('[data-missing="finding-explanation"]')).toBeVisible();
});

test("PG-9: published comments and drafts marked „nije objavljeno”, read only", async ({ page }) => {
  await fakeServer(page);
  await page.goto(`${review}`);
  const section = page.locator('[data-nf5="PG-9"]');
  await expect(section.locator("tbody tr")).toHaveCount(2);
  await expect(section.getByText(p.givenDraft)).toBeVisible();
  await expect(section.getByText(p.givenPublished)).toBeVisible();
  await expect(section.locator('[data-missing="seen"]')).toBeVisible();
  await expect(section.locator("textarea, input")).toHaveCount(0);
});

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    for (const tab of ["tekst", "podrijetlo", "reprodukcija"]) {
      test(`axe: the review tab ${tab} at ${width} px, ${theme} theme`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await fakeServer(page);
        await page.goto(`${review}?kartica=${tab}`);
        await expect(page.locator(`[data-nf5]:visible`).first()).toBeVisible();
        await expect(page.getByText(/Učitavam/)).toHaveCount(0);
        await setTheme(page, theme);
        await axe(page, info, `pregled-nf5-${tab}-${width}-${theme}`);
        const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(scroll).toBeLessThanOrEqual(0);
      });
    }
  }
}
