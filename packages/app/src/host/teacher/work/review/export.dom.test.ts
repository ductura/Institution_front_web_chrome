// @vitest-environment jsdom
// NF-5 PG-11, PG-12, PG-13 of "Pregled rada": export and print, the cards on a phone, the names of the cards and
// the print header, over stand-in calls. Invented work, student and course only; no request leaves the test.
import { createHash } from "node:crypto";
import { act, createElement as h, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Raw } from "../../../editor/export/preparation";
import type { PdfCall } from "../../../editor/export/pdf";
import { HostContext, type HostValue } from "../../../context";
import type { ProvenanceCall } from "../../provenance/read";
import { CardTable } from "./CardTable";
import ExportPanel, { type ExportDeps } from "./ExportPanel";
import { exportFileName } from "./export-model";
import { exportMessages as x } from "./export-messages.hr";
import type { ReviewExtras } from "./extras";
import { forbiddenInReview, NEVER } from "./forbidden";
import type { Outcome } from "./model";
import type { HeaderRead, ReviewReads } from "./read";
import ReviewPage from "./ReviewPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const DOCUMENT = "rad-izmisljeni-izvoz";
const BYTES = Buffer.from("%PDF-1.7 izmisljeni rad za test izvoza");
const PDF = { filename: "rad.pdf", pdfBase64: BYTES.toString("base64"), outputSha256: createHash("sha256").update(BYTES).digest("hex"), format: "pdf", reportHash: null, docxBase64: "UEsDBA==", noticeKey: "workExport.plainPdf" };
const DAY = new Date(2026, 10, 24, 10, 30);

const answer = (raw: Raw): (() => PdfCall) => () => async () => raw;
const deps = (raw: Raw, over: Partial<ExportDeps> = {}) => {
  const saved: { name: string; size: number }[] = [];
  const spies = { print: vi.fn(), signIn: vi.fn() };
  const value: ExportDeps = { call: answer(raw), save: (blob, name) => { saved.push({ name, size: blob.size }); }, now: () => DAY, ...spies, ...over };
  return { value, saved, ...spies };
};

describe("NF-5 PG-11, PG-12, PG-13", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; vi.unstubAllGlobals(); });
  const settle = async () => { for (let i = 0; i < 8; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
  const mount = async (node: ReactElement) => {
    const el = document.createElement("div");
    document.body.append(el);
    root = createRoot(el);
    await act(async () => { root!.render(node); });
    await settle();
    return el;
  };
  const press = async (el: HTMLElement, name: string) => {
    const button = [...el.querySelectorAll("button")].find((b) => b.textContent === name);
    if (!button) throw new Error(`no button ${name}`);
    await act(async () => { button.click(); });
    await settle();
  };

  it("PG-11: the PDF of the work is saved only when its bytes match the server's SHA-256; the warning stands next to it", async () => {
    const d = deps({ ok: true, status: 200, body: PDF });
    const el = await mount(h(ExportPanel, { assignmentId: ASSIGNMENT, documentId: DOCUMENT, student: "Student A", grade: "eligible", deps: d.value }));
    expect(el.querySelector("[data-export-warning]")?.textContent).toBe(x.warning);
    await press(el, x.pdf);
    expect(d.saved).toEqual([{ name: "rad-Student-A-2026-11-24.pdf", size: BYTES.length }]);
    const done = el.querySelector('[role="status"][data-export-done]');
    expect(done?.textContent).toContain(x.pdfDone);
    expect(done?.textContent).toContain(`Otisak datoteke: ${PDF.outputSha256.slice(0, 12)}…`);
    expect(done?.textContent).toContain(x.pdfPlain);
  });

  it("PG-11: a file that does not match its fingerprint is never saved, and the failure is said with a retry", async () => {
    const d = deps({ ok: true, status: 200, body: { ...PDF, outputSha256: "0".repeat(64) } });
    const el = await mount(h(ExportPanel, { assignmentId: ASSIGNMENT, documentId: DOCUMENT, student: "Student A", grade: "unknown", deps: d.value }));
    await press(el, x.pdf);
    expect(d.saved).toEqual([]);
    expect(el.querySelector('[role="alert"]')?.textContent).toBe(x.mismatch);
    expect([...el.querySelectorAll("button")].map((b) => b.textContent)).toContain(x.retry);
  });

  it.each([
    [403, x.forbidden], [404, x.notFound], [503, x.unavailable],
  ])("PG-11: %i is said as its own failure, not as an empty file", async (status, line) => {
    const d = deps({ ok: false, status, body: { error: "x" } } as Raw);
    const el = await mount(h(ExportPanel, { assignmentId: ASSIGNMENT, documentId: DOCUMENT, student: null, grade: "eligible", deps: d.value }));
    await press(el, x.pdf);
    expect(d.saved).toEqual([]);
    expect(el.querySelector('[role="alert"]')?.textContent).toBe(line);
  });

  it("PG-11: an ended session leads to the sign-in and saves nothing", async () => {
    const d = deps({ ok: false, status: 401, body: { error: "unauthorized" } } as Raw);
    const el = await mount(h(ExportPanel, { assignmentId: ASSIGNMENT, documentId: DOCUMENT, student: null, grade: "eligible", deps: d.value }));
    await press(el, x.pdf);
    expect(d.signIn).toHaveBeenCalledOnce();
    expect(d.saved).toEqual([]);
  });

  it("PG-11: „Ispiši pregled” opens the browser's print; a practice assignment has neither export nor print", async () => {
    const d = deps({ ok: true, status: 200, body: PDF });
    const el = await mount(h(ExportPanel, { assignmentId: ASSIGNMENT, documentId: DOCUMENT, student: null, grade: "eligible", deps: d.value }));
    await press(el, x.print);
    expect(d.print).toHaveBeenCalledOnce();
    expect(el.querySelector('[data-missing="summary-pdf"]')).not.toBeNull();
    act(() => root?.unmount());
    const practice = await mount(h(ExportPanel, { assignmentId: ASSIGNMENT, documentId: DOCUMENT, student: null, grade: "practice", deps: d.value }));
    expect(practice.querySelectorAll("button")).toHaveLength(0);
    expect(practice.textContent).toContain(x.practice);
  });

  it("PG-11: the file name keeps out the characters a disk refuses", () => {
    expect(exportFileName("Ana / B: C.", DAY)).toBe("rad-Ana-_-B_-C-2026-11-24.pdf");
    expect(exportFileName(null, DAY)).toBe("rad-2026-11-24.pdf");
  });

  it("PG-14: the new texts name no provider, draw no conclusion and use no forbidden term", () => {
    const all = Object.values(x).map((v) => (typeof v === "function" ? (v as (s: string) => string)("x") : v)).join(" ");
    expect(forbiddenInReview(all)).toEqual([]);
    expect(NEVER.test(all)).toBe(false);
  });

  describe("PG-12 cards", () => {
    type Row = { id: string; kind: string; share: string };
    const props = (rows: Row[]) => ({
      caption: "Izmišljeni sastav", rowKey: (r: Row) => r.id, empty: "Nema redaka.", rows,
      columns: [{ id: "kind", header: "Način unosa", cell: (r: Row) => r.kind }, { id: "share", header: "Udio", cell: (r: Row) => r.share }],
    });
    const narrow = (matches: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({
      matches, media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));

    it("below 760 px every row is a card that names each value with its column header, under the caption", async () => {
      narrow(true);
      const el = await mount(h(CardTable<Row>, props([{ id: "a", kind: "Tipkano", share: "86 %" }, { id: "b", kind: "Zalijepljeno", share: "10 %" }])));
      expect(el.querySelector("table")).toBeNull();
      const list = el.querySelector("ul")!;
      expect(document.getElementById(list.getAttribute("aria-labelledby")!)?.textContent).toBe("Izmišljeni sastav");
      const cards = [...list.querySelectorAll("li")];
      expect(cards).toHaveLength(2);
      expect([...cards[0]!.querySelectorAll("dt")].map((n) => n.textContent)).toEqual(["Način unosa", "Udio"]);
      expect([...cards[0]!.querySelectorAll("dd")].map((n) => n.textContent)).toEqual(["Tipkano", "86 %"]);
    });

    it("from 760 px, and without matchMedia, it stays the table with column headers", async () => {
      narrow(false);
      const el = await mount(h(CardTable<Row>, props([{ id: "a", kind: "Tipkano", share: "86 %" }])));
      expect(el.querySelector("table caption")?.textContent).toBe("Izmišljeni sastav");
      expect([...el.querySelectorAll('th[scope="col"]')].map((n) => n.textContent)).toEqual(["Način unosa", "Udio"]);
    });

    it("an empty list says so and draws no empty card", async () => {
      narrow(true);
      const el = await mount(h(CardTable<Row>, props([])));
      expect(el.querySelector("li")).toBeNull();
      expect(el.textContent).toContain("Nema redaka.");
    });
  });

  describe("the review page", () => {
    const HOST = { base: "/app/web", page: { path: "/nastavnik/rad/[id]/pregled" }, role: "teacher" } as unknown as HostValue;
    const header = (grade: "eligible" | "practice"): HeaderRead => ({ kind: "ready", header: {
      facts: { studentName: "Student A", assignmentId: ASSIGNMENT, state: "nije_predano", previousId: null, nextId: null, receipt: null },
      context: { course: "Kolegij A", title: "Lokalni mediji", workType: "essay", dueAt: "2026-11-30T22:59:00.000Z" }, grade,
    } } as HeaderRead);
    const reads = (grade: "eligible" | "practice"): ReviewReads => ({
      header: async () => header(grade),
      summary: async (): Promise<Outcome<never>> => ({ kind: "notFound" }),
      details: async (): Promise<Outcome<never>> => ({ kind: "notFound" }),
      thresholds: async (): Promise<Outcome<never>> => ({ kind: "notFound" }),
    });
    const QUIET: ReviewExtras = {
      composition: async () => ({ kind: "empty" }), disputes: async () => ({ kind: "ok", disputes: [] }),
      comments: async () => ({ kind: "ok", threads: [] }), drafts: async () => ({ kind: "ready", drafts: [] }),
    };
    const provenance: ProvenanceCall = async () => ({ kind: "noMarks" });
    beforeEach(() => { window.history.replaceState(null, "", `/app/web/nastavnik/rad/${DOCUMENT}/pregled`); });

    const page = (grade: "eligible" | "practice", d: ExportDeps) => mount(h(HostContext.Provider, { value: HOST },
      h(ReviewPage, { documentId: DOCUMENT, reads: reads(grade), extras: QUIET, provenanceCall: provenance, matchCall: async () => ({ kind: "none" }), exportDeps: d })));

    it("PG-11, PG-12: the export sits under the header, inside the review region with 44 px controls", async () => {
      const el = await page("eligible", deps({ ok: true, status: 200, body: PDF }).value);
      const region = el.querySelector('section[aria-label="Pregled rada"][data-touch="large"]');
      expect(region).not.toBeNull();
      expect(region!.querySelector('[data-nf5="PG-11"]')).not.toBeNull();
      expect(el.querySelector('[data-review-head] ~ [data-nf5="PG-11"]')).not.toBeNull();
    });

    it("PG-11: just before a print the header gains the time of the print and „nije dokaz autorstva”", async () => {
      const el = await page("eligible", deps({ ok: true, status: 200, body: PDF }).value);
      expect(el.querySelector("[data-print-only]")).toBeNull();
      await act(async () => { window.dispatchEvent(new Event("beforeprint")); });
      const line = el.querySelector("[data-print-only]");
      expect(line?.textContent).toContain("Ispisano 24. studenoga 2026.");
      expect(line?.textContent).toContain("nije dokaz autorstva");
    });

    it("PG-10, PG-11: a practice assignment offers no export in the review", async () => {
      const el = await page("practice", deps({ ok: true, status: 200, body: PDF }).value);
      expect(el.querySelector('[data-nf5="PG-11"] button')).toBeNull();
      expect(el.querySelector('[data-nf5="PG-11"]')?.textContent).toContain(x.practice);
    });
  });
});
