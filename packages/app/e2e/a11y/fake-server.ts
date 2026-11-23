// A fake institution server for the accessibility pass (WEB-1805, M11.6): the
// session of one role and the reads the main screens make, from the same
// invented vectors the e2e suite uses. Any other /api/v1 read answers 404, so
// the screen shows its own "cannot be read" state, which is checked as well.
// Invented people, institutions and courses only; no request leaves the browser.
import { readFileSync } from "node:fs";

import type { Page } from "@playwright/test";

export type Role = "student" | "teacher" | "institution_admin" | null;

export const INSTITUTION = "Izmišljeni fakultet za provjeru pristupačnosti";
/** "Izmišljeni zadatak 1" of the "ready" vector of student.assignments.get, and its course. */
export const ASSIGNMENT_ID = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01";
export const COURSE_ID = "0b9f6c1e-1d2a-4c3b-8e4f-5a6b7c8d9e01";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as unknown;
const assignmentVectors = read("../../../../src/components/student/fixtures/student.assignments.get.json") as {
  vectors: { name: string; response: { body: unknown } }[];
};
const assignments = assignmentVectors.vectors.find((v) => v.name === "ready")!.response.body;
const teacher = read("../fixtures/teacher.json") as Record<string, unknown>;

const STATUS = {
  checkedAt: "2026-11-20T08:30:00Z",
  components: { writing: "radi", submission: "radi", mentorView: "nije_ukljuceno" },
};

const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

/** Routes every /api/v1 read of the page for one role (null: signed out, 401). Returns the count of session reads. */
export async function fakeServer(page: Page, role: Role) {
  const seen = { me: 0 };
  // Registered first, so the specific routes below take precedence (Playwright matches the latest route first).
  await page.route("**/api/v1/**", (route) => route.fulfill(json({ code: "not_found" }, 404)));
  await page.route("**/api/v1/me", (route) => {
    seen.me += 1;
    return route.fulfill(role === null
      ? json({ code: "unauthenticated" }, 401)
      : json({ role, displayName: "Iva Izmišljena", institution: { slug: "izm", displayName: INSTITUTION } }));
  });
  await page.route("**/api/v1/profile/interface-locale", (route) => route.fulfill(json({ locale: null })));
  await page.route("**/api/v1/status", (route) => route.fulfill(json(STATUS)));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill(json(assignments)));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill(json({ assignments: [{ assignmentId: ASSIGNMENT_ID, workState: "in_progress" }] })));
  await page.route("**/api/v1/teacher/courses", (route) => route.fulfill(json(teacher["teacher.courses.get"])));
  // PIL-P1-PRAGOVI-ADMIN: two invented thresholds, so the form shows both a kind with one and kinds without.
  await page.route("**/api/v1/institution/origin-thresholds", (route) => route.fulfill(json({ thresholds: [
    { origin: "pasted_unknown", thresholdPercent: 15, strictness: "soft" },
    { origin: "assistant_inserted", thresholdPercent: 10, strictness: "hard" },
  ] })));
  await page.route("**/api/v1/teacher/mentorships", (route) => route.fulfill(json(teacher["teacher.mentorships.get"])));
  await page.route("**/api/v1/auth/login**", (route) => route.fulfill({
    status: 200, contentType: "text/html; charset=utf-8",
    body: "<!doctype html><html lang=\"hr\"><title>AAI@EduHr</title><main><h1>Lažni AAI@EduHr</h1></main></html>",
  }));
  return seen;
}
