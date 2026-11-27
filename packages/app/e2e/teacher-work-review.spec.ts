// WEB-NUZ-PG (NF-5 PG-1, PG-4, PG-10, PG-14): "Pregled rada" on next start, against a fake institution server.
// Invented work, student and course only; no request leaves the browser.
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "./fixtures/test";

import type ContractVectors from "../../../src/client/migration-contract-vectors.generated.json";

import { axe, setTheme } from "./a11y/check";
import { reviewMessages as t } from "../src/host/teacher/work/review/messages.hr";

const vectors = JSON.parse(readFileSync(
  new URL("../../../src/client/migration-contract-vectors.generated.json", import.meta.url), "utf8",
)) as typeof ContractVectors;
const profile = vectors.find((v) => v.route === "profile.me.get" && v.name === "teacher-without-name")!.response.body;
const profileBody = { ...profile, roles: ["teacher"] };
const documentId = "rad-izmisljeni-pregled";
const previousId = "rad-izmisljeni-prethodni";
const assignmentId = "00000000-0000-4000-8000-0000000000a1";
const studentId = "00000000-0000-4000-8000-0000000000e1";
const review = `/aplikacija/nastavnik/rad/${documentId}/pregled`;
const SUMMARY = {
  summaryFormat: "ductus-process-summary-v1",
  sessions: { evidenceKind: "observed", breakAboveMinutes: 30, count: 3, items: [] },
  pastes: { evidenceKind: "observed", listedAboveCharacters: 200, listed: [], smallerCount: 1 },
  gaps: { evidenceKind: "observed", items: [] },
  recordState: "complete",
};
const FINDING = {
  segmentRef: "odsjecak-1", conversationId: "00000000-0000-4000-8000-0000000000c1", messageId: "00000000-0000-4000-8000-0000000000f1",
  runWords: 12, recordedAt: "2026-11-01T10:00:00.000Z", attachedAt: "2026-11-02T10:00:00.000Z", explanation: null,
};

async function fakeServer(page: Page) {
  let matchFails = true;
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
      case "/api/v1/process-summary/details": return route.fulfill({ status: 404, json: { error: "not_found" } });
      case `/api/v1/works/${documentId}/origin-thresholds`: return route.fulfill({ json: { comparison: [{ origin: "pasted_unknown", state: "for_review" }] } });
      case `/api/v1/works/${documentId}/assistant-match`: return matchFails
        ? route.fulfill({ status: 503, json: { error: "unavailable" } })
        : route.fulfill({ json: { findings: [FINDING] } });
      case `/api/v1/works/${documentId}/origin-composition`: return route.fulfill({ json: { parts: [
        { kind: "typed", percent: 86 }, { kind: "assistant_inserted", percent: 0 }, { kind: "assistant_match", percent: 4 },
        { kind: "imported_file", percent: 0 }, { kind: "pasted_known", percent: 0 }, { kind: "pasted_unknown", percent: 10 },
      ] } });
      case `/api/v1/teacher/assignments/${assignmentId}/students/${studentId}/declaration`:
        return route.fulfill({ json: { state: "none", payload: null, declarationSha256: null } });
      default: return route.fallback();
    }
  });
  return { recover: () => { matchFails = false; } };
}

test("PG-1/PG-10: the review names the work, keeps the tab across works and says the grade is in Merlin and Studomat", async ({ page }) => {
  await fakeServer(page);
  await page.goto(`${review}?kartica=sazetak`);
  await expect(page.getByRole("heading", { level: 1, name: "Student A · Seminarski rad „Lokalni mediji”" })).toBeVisible();
  await expect(page.getByText("Kolegij A · zadatak „Lokalni mediji”")).toBeVisible();
  await expect(page.getByText(t.gradeExternal)).toBeVisible();
  await expect(page.getByRole("tab", { name: t.tabSummary })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: t.prev })).toHaveAttribute("href", `/aplikacija/nastavnik/rad/${previousId}/pregled?kartica=sazetak`);
  await expect(page.getByRole("link", { name: t.backToTask })).toHaveAttribute("href", `/aplikacija/nastavnik/zadatak/${assignmentId}/predaje`);
  // Keyboard: the tab list is one stop; arrows move and open.
  await page.getByRole("tab", { name: t.tabSummary }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: t.tabOrigin })).toBeFocused();
  await expect(page.getByRole("tab", { name: t.tabOrigin })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(`${review}?kartica=podrijetlo`);
  await expect(page.getByRole("link", { name: t.prev })).toHaveAttribute("href", `/aplikacija/nastavnik/rad/${previousId}/pregled?kartica=podrijetlo`);
});

test("PG-4: not given reads apart from an error, and the failed part recovers on its own", async ({ page }) => {
  const { recover } = await fakeServer(page);
  await page.goto(`${review}?kartica=sazetak`);
  const assistant = page.locator('[data-part="pg-assistant"]');
  await expect(assistant).toHaveAttribute("data-state", "notGiven");
  await expect(assistant.getByText(t.notGiven)).toBeVisible();
  await expect(assistant.getByRole("button")).toHaveCount(0);
  const match = page.locator('[data-part="pg-match"]');
  await expect(match.getByRole("alert")).toHaveText(t.partError(t.matchHeading));
  await expect(page.locator('[data-part="pg-rules"]')).toContainText("Zalijepljeno, podrijetlo nepoznato: za pregled");
  // NF5-Q4: the input rhythm is not read and has no part here.
  await expect(page.locator('[data-part="pg-rhythm"]')).toHaveCount(0);
  recover();
  await match.getByRole("button", { name: t.retry }).click();
  await expect(match).toHaveAttribute("data-state", "ready");
  await expect(match).toContainText("4 % · nije dokaz autorstva");
  await expect(match).toContainText(t.matchNote);
});

test("the live work links to the review", async ({ page }) => {
  await fakeServer(page);
  await page.goto(`${review}`);
  await expect(page.getByRole("tab", { name: t.tabText })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: t.textOpen })).toHaveAttribute("href", `/aplikacija/nastavnik/rad/${documentId}`);
});

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`axe: the review at ${width} px, ${theme} theme`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await fakeServer(page);
      await page.goto(`${review}?kartica=sazetak`);
      await expect(page.locator('[data-part="pg-match"] [role="alert"]')).toBeVisible();
      await setTheme(page, theme);
      await axe(page, info, `pregled-${width}-${theme}`);
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(scroll).toBeLessThanOrEqual(0);
    });
  }
}
