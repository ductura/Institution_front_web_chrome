import { expect, it } from "vitest";

import { loadPortfolio, portfolioView, submittedDate, type PortfolioRaw } from "./model";
import { portfolioText as t } from "./messages.hr";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const raw = (n: number, over: Partial<PortfolioRaw> = {}): PortfolioRaw => ({
  submissionId: id(n), documentId: id(n + 100), versionId: id(n + 200), title: `Izmišljeni rad ${n}`,
  submittedAt: `2026-0${n}-10T10:00:00Z`, courseEnded: false, status: "submitted", ...over,
});

it("offers only submitted versions, newest first", () => {
  const view = portfolioView({ kind: "ok", entries: [raw(1), raw(3), raw(2, { status: "draft" }), raw(4, { status: "withdrawn" })] });
  expect(view.kind).toBe("ready");
  if (view.kind === "ready") expect(view.entries.map((e) => e.submissionId)).toEqual([id(3), id(1)]);
});

it("entries do not carry the status on, and ill-formed ids are dropped", () => {
  const view = portfolioView({ kind: "ok", entries: [raw(1), raw(2, { versionId: "x" })] });
  expect(view).toEqual({ kind: "ready", entries: [{ ...raw(1), status: undefined }].map(({ status: _s, ...e }) => e) });
});

it("nothing submitted is empty; a course that ended still lists the work", () => {
  expect(portfolioView({ kind: "ok", entries: [raw(1, { status: "draft" })] })).toEqual({ kind: "empty" });
  const view = portfolioView({ kind: "ok", entries: [raw(1, { courseEnded: true })] });
  expect(view.kind === "ready" && view.entries[0]?.courseEnded).toBe(true);
});

it("a failing port is unavailable, never a made-up list; signed out passes through", async () => {
  expect(await loadPortfolio({ read: async () => { throw new Error("x"); } })).toEqual({ kind: "unavailable" });
  expect(await loadPortfolio({ read: async () => ({ kind: "signedOut" }) })).toEqual({ kind: "signedOut" });
});

it("the date is the Zagreb calendar day", () => {
  expect(submittedDate("2026-03-10T23:30:00Z")).toBe("11. 03. 2026.");
});

it("the texts are Croatian and plain", () => {
  const all = [t.title, t.lead, t.empty, t.unavailable, t.courseEnded, t.packageLead].join(" ");
  expect(all).not.toMatch(/\b(hash|checksum|payload|endpoint|API|JSON|token)\b/i);
  expect(all).toMatch(/portfelj/);
});
