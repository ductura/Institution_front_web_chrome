import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import type { SubmissionRead } from "../../../../../../src/client/submission";
import { PAGES, pathMatches } from "../../../routes";
import type { CoursesCall } from "../courses/read";
import ReceiptScreen from "../submission/receipt/ReceiptScreen";
import { receiptPath } from "../submission/receipt/model";
import { loadPortfolio } from "./model";
import { portfolioPort } from "./port";

// Invented data only: made-up ids, titles and times.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const HEX = "ab".repeat(32);
const receipt = (n: number): SubmissionRead => ({
  kind: "potvrdeno",
  receipt: { payload: {
    receiptSchema: "ductus-submission-receipt-v2", submissionId: id(n + 500), evidenceDomainId: id(900), principalId: id(901),
    assignmentId: id(n), assignmentVersion: 1, documentId: id(n + 100), evidencePackageId: id(n + 700), revision: 4,
    artifactSha256: HEX, evidenceHeadSegmentHash: HEX, evidenceRecord: "continuous",
    requestedAt: `2026-0${n}-10T10:00:00.000000Z`, dueAt: `2026-0${n}-11T10:00:00.000000Z`, afterDeadline: false, signedAt: `2026-0${n}-10T10:01:00.000000Z`,
  } },
} as never);

/** A fake of the existing reads: four works, of which 1 and 3 are submitted and 3 still awaits its signed receipt. */
function fakeReads(over: { courses?: number; work?: number; submission?: Partial<Record<string, SubmissionRead>> } = {}) {
  const calls: string[] = [];
  const asked: string[] = [];
  const call = (async (op: string) => {
    calls.push(op);
    if (op === "student.assignments.get") {
      if (over.courses) return { ok: false, status: over.courses };
      return { ok: true, status: 200, body: { courses: [
        { id: id(800), name: "Izmišljeni kolegij A", assignments: [1, 2].map((n) => ({ id: id(n), title: `Izmišljeni rad ${n}`, dueAt: "2026-12-01T10:00:00Z", noticeFirst: false })) },
        { id: id(801), name: "Izmišljeni kolegij B", assignments: [3, 4].map((n) => ({ id: id(n), title: `Izmišljeni rad ${n}`, dueAt: "2026-12-01T10:00:00Z", noticeFirst: false })) },
      ] } };
    }
    if (over.work) return { ok: false, status: over.work };
    return { ok: true, status: 200, body: { assignments: [
      { assignmentId: id(1), workState: "submitted" }, { assignmentId: id(2), workState: "in_progress" },
      { assignmentId: id(3), workState: "submitted" }, { assignmentId: id(4), workState: "not_started" },
    ] } };
  }) as unknown as CoursesCall;
  const submission = async (assignmentId: string): Promise<SubmissionRead> => {
    asked.push(assignmentId);
    const given = over.submission?.[assignmentId];
    if (given !== undefined) return given;
    return assignmentId === id(3) ? { kind: "ceka", revision: 2, requestedAt: "2026-03-10T10:00:00Z" } : receipt(1);
  };
  return { port: portfolioPort({ call, submission }), calls, asked };
}

it("offers only submitted versions: in-progress, not started and unsigned works are left out", async () => {
  const { port, asked } = fakeReads();
  const view = await loadPortfolio(port);
  expect(view).toEqual({ kind: "ready", entries: [{
    submissionId: id(501), assignmentId: id(1), documentId: id(101), versionId: id(501), title: "Izmišljeni rad 1",
    submittedAt: "2026-01-10T10:00:00.000000Z", courseEnded: false,
  }] });
  expect(asked).toEqual([id(1), id(3)]);
});

it("reads only through the existing list reads; nothing submitted is empty", async () => {
  const { port, calls } = fakeReads({ submission: { [id(1)]: { kind: "none" } } });
  expect(await loadPortfolio(port)).toEqual({ kind: "empty" });
  expect([...new Set(calls)].sort()).toEqual(["student.assignment-work.get", "student.assignments.get"]);
});

it("401 anywhere is signed out; any other failure is unavailable, never a shorter list", async () => {
  expect(await loadPortfolio(fakeReads({ courses: 401 }).port)).toEqual({ kind: "signedOut" });
  expect(await loadPortfolio(fakeReads({ courses: 503 }).port)).toEqual({ kind: "unavailable" });
  expect(await loadPortfolio(fakeReads({ work: 503 }).port)).toEqual({ kind: "unavailable" });
  expect(await loadPortfolio(fakeReads({ submission: { [id(1)]: { kind: "session-expired" } } }).port)).toEqual({ kind: "signedOut" });
  expect(await loadPortfolio(fakeReads({ submission: { [id(1)]: { kind: "nepoznato" } } }).port)).toEqual({ kind: "unavailable" });
});

it("after sign-in the student comes back to the receipt page, a page the host has", () => {
  const here = receiptPath(id(1));
  expect(here).toBe(`/rad/${id(1)}/predaja/potvrda`);
  expect(PAGES.some((p) => pathMatches(p.path, here))).toBe(true);
  expect(PAGES.some((p) => pathMatches(p.path, "/portfelj"))).toBe(false);
  const source = readFileSync(join(import.meta.dirname, "PortfolioExport.tsx"), "utf8");
  expect(source).not.toMatch(/\/portfelj/);
  expect(source).toMatch(/goToSignIn\(appHref\(base, here\)\)/);
});

it("the PDF and the package go through the existing components, not a route of their own", () => {
  const source = readFileSync(join(import.meta.dirname, "PortfolioExport.tsx"), "utf8");
  expect(source).toMatch(/from "\.\.\/\.\.\/editor\/export\/PdfExport"/);
  expect(source).toMatch(/from "\.\.\/submission-package\/SubmissionPackage"/);
  // INT-31: "Provjerljivi paket" is the verifiable package, not the registrar's confirmation.
  expect(source).toMatch(/<SubmissionPackage [^>]*kind="package"/);
  expect(source).not.toMatch(/createApi|\/api\/v1/);
});

it("the receipt offers \"Izvoz za portfelj\", closed until asked, and builds no port before that", () => {
  let made = 0;
  const html = renderToStaticMarkup(createElement(ReceiptScreen, {
    read: receipt(1) as never, retryHref: "/r", workHref: "/w", homeHref: "/",
    portfolioPort: () => { made += 1; return fakeReads().port; },
  }));
  expect(html).toContain("Izvoz za portfelj");
  expect(html).toContain('aria-controls="sb-portfolio"');
  expect(made).toBe(0);
  for (const read of [{ kind: "none" }, { kind: "loading" }, { kind: "error" }] as const) {
    expect(renderToStaticMarkup(createElement(ReceiptScreen, { read, retryHref: "/r", workHref: "/w", homeHref: "/" }))).not.toContain("Izvoz za portfelj");
  }
});
