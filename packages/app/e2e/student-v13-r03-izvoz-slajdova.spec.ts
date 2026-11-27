// F4-V13-R03 (WEB-V13-IZVOZ): the student's slides editor offers "Preuzmi .pptx" and "Preuzmi PDF". The work opens
// at revision 0 (contract §7: its exact JCS bytes and hash), so the server has not yet confirmed a revision this
// session saved: both buttons are off and the note says why, and no export is asked for. The verified-receipt
// state that turns them on is covered by work.mount.test.ts. The receipt keys are the contract's own invented
// test keys; people, courses and ids are invented.
import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

const ID = "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e61";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d62";
const DOCUMENT_ID = "dokument-izmisljeni-slajdovi-1";
// packages/editor-core/src/slides/model.ts: SLIDES_REVISION_ZERO_JCS and SLIDES_REVISION_ZERO_SHA256.
const ZERO_JCS = '{"documentKind":"slides","schemaVersion":1,"slides":[{"blocks":[],"id":"00000000-0000-4000-8000-000000000000","layout":"titleContent"}]}';
const ZERO_SHA256 = "f593200307d93c988cc050521ab02853510a424d59763d575de83fda1cf8a0d8";

type Vector = { route: string; name: string; response?: { body?: { receiptKeys?: unknown } } };
const vectors = JSON.parse(readFileSync(new URL("../../../src/client/migration-contract-vectors.generated.json", import.meta.url), "utf8")) as Vector[];
const receiptKeys = vectors.find((v) => v.route === "evidence.open.post" && v.name === "opened")?.response?.body?.receiptKeys;

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
}

async function slidesWork(page: Page) {
  const seen: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/")) seen.push(new URL(request.url()).pathname); });
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: "d".repeat(64), sessionTag: "izmisljena-oznaka-prijave-v13" },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljena prezentacija o mjesnim knjižnicama", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false, documentKind: "slides" },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
  await page.route("**/api/v1/evidence/open", (route) => route.fulfill({
    json: {
      status: "opened", documentId: DOCUMENT_ID, evidenceProfileId: "standard-v1", currentRevision: 0, documentHash: ZERO_SHA256,
      headSegmentHash: null, lastSequenceTo: 0, document: Buffer.from(ZERO_JCS, "utf8").toString("base64"), receiptKeys,
      submitted: false, lastSignedAt: null, documentKind: "slides", workKind: "slides", slidesSchemaVersion: 1,
    },
  }));
  // Nothing is sent in this test; a commit, if one left, would wait unanswered on this device.
  await page.route("**/api/v1/evidence/commit", () => { /* never answered */ });
  return seen;
}

test("V13-R03: the slides editor offers .pptx and PDF, off with the reason until the server confirms", async ({ page }) => {
  expect(receiptKeys).toBeDefined();
  const seen = await slidesWork(page);
  await page.goto(`/app/web/rad/${ID}`);
  await expect(page.getByLabel("Uređivač slajdova").first()).toBeVisible({ timeout: 20_000 });
  const region = page.getByRole("region", { name: "Izvoz slajdova" });
  await expect(region).toBeVisible();
  await expect(region.getByRole("button", { name: "Preuzmi .pptx" })).toBeDisabled();
  await expect(region.getByRole("button", { name: "Preuzmi PDF" })).toBeDisabled();
  await expect(region.getByRole("note")).toHaveText("Izvoz je moguć tek kad poslužitelj potvrdi zadnju reviziju slajdova.");
  expect(seen.filter((path) => path.endsWith("/export-slides"))).toEqual([]);
  await axe(page);
});
