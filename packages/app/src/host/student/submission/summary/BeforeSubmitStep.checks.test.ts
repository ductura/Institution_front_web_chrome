// @vitest-environment jsdom
// WEB-NUZ-PREDAJA-2 (NF-3 PR-3, PR-17): step 3 lists the places left for a source and the pastes instead of a
// fixed sentence, says the form check is not available in the pilot, and says a late submission already here.
// Invented text, times and deadlines only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BeforeSubmitStep from "./BeforeSubmitStep";
import { ASSIGNMENT, CONFIRMED, gateServer } from "./declaration-gate.fixture";
import { checksText as c } from "./messages.hr";

const router = { push: vi.fn() };
const work = vi.fn();
const summary = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../../../../../../src/client/online-status.ts", () => ({ useOnline: () => true }));
vi.mock("../../../../../../../src/components/student/Submission.tsx", () => ({ readWork: (...a: unknown[]) => work(...a) }));
vi.mock("../../../../../../../src/client/process-summary.ts", () => ({ fetchProcessSummary: (...a: unknown[]) => summary(...a) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const p = (text: string) => ({ type: "paragraph", children: [{ text, marks: [] }] });
const SUMMARY = {
  summaryFormat: "process-summary-v1", recordState: "continuous",
  sessions: { evidenceKind: "observed", breakAboveMinutes: 30, count: 0, items: [] },
  gaps: { evidenceKind: "observed", items: [] },
  pastes: { evidenceKind: "observed", listedAboveCharacters: 200, smallerCount: 2, listed: [{ at: { from: "2026-11-18T09:00:00.000Z", to: "2026-11-18T09:05:00.000Z" }, characters: 420, origin: "not_observed" }] },
};

let root: Root | null = null;
beforeEach(() => { vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined))); work.mockReset(); summary.mockReset(); });
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; vi.unstubAllGlobals(); });

async function mount(props: Record<string, unknown> = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(h(BeforeSubmitStep, {
      assignmentId: ASSIGNMENT, stage: { kind: "open" }, hrefOf: (path: string) => path, workHref: "/rad/x",
      onSignIn: () => undefined, declarationGate: gateServer(() => CONFIRMED).read, ...props,
    }));
  });
  await act(async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); });
  return host;
}
const section = (host: HTMLElement, label: string) => [...host.querySelectorAll("*")].find((e) => e.firstChild?.textContent === label)?.parentElement;

describe("step 3 lists (PR-3)", () => {
  it("lists the places in the server's text and the pastes, each a way into the work", async () => {
    work.mockResolvedValue({ kind: "ready", documentId: "izmisljeni-dokument-1", revision: 2, nodes: [p("Kompost u gradu [izvor] i dvorišta."), { type: "heading", level: 1, children: [{ text: "2. Analiza", marks: [] }] }, p("Broj kućanstava [?].")] });
    summary.mockResolvedValue({ kind: "ok", summary: SUMMARY });
    const host = await mount();
    const links = [...host.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toContainEqual(["Odlomak 1 ([izvor])", "/rad/x"]);
    expect(links).toContainEqual(["2. Analiza, odlomak 1 ([?])", "/rad/x"]);
    expect(host.textContent).toContain("Manja lijepljenja (do 200 znakova): 2.");
    // WEB-V17-FORMAT-CHECK: the form check is now a real section (its own tests are in editor/format-check).
    expect(host.textContent).toContain(c.form);
    expect(host.textContent).not.toContain(c.formNotRun);
    expect(host.textContent).not.toContain("Ovaj redak samo obavještava");
  });

  it("says there are none, honestly, and that unread lists do not hold the submission", async () => {
    work.mockResolvedValue({ kind: "ready", documentId: "izmisljeni-dokument-1", revision: 2, nodes: [p("Tekst bez oznaka.")] });
    summary.mockResolvedValue({ kind: "ok", summary: { ...SUMMARY, pastes: { ...SUMMARY.pastes, listed: [], smallerCount: 0 } } });
    let host = await mount();
    expect(host.textContent).toContain(c.placeholdersNone);
    expect(host.textContent).toContain(c.pastedNone);
    act(() => root?.unmount());
    work.mockResolvedValue({ kind: "unavailable" });
    host = await mount();
    expect(host.textContent).toContain(c.placeholdersUnknown);
    expect(host.textContent).toContain(c.pastedUnknown);
    // Neither list holds "Dalje" (PRODUCT §5).
    expect([...host.querySelectorAll("button")].find((b) => b.textContent === c.next)?.hasAttribute("aria-disabled")).toBe(false);
  });
});

describe("step 3 deadline (PR-17)", () => {
  it("says a late submission and the teacher's exception before step 4", async () => {
    work.mockResolvedValue(new Promise(() => undefined));
    let host = await mount({ timing: { kind: "late", dueAt: "2026-11-12T22:59:00.000Z" } });
    expect(host.querySelector("#sb-late")?.textContent).toContain("Rok je prošao 12. 11. 2026. u 23:59.");
    act(() => root?.unmount());
    host = await mount({ timing: { kind: "exception", dueAt: "2026-11-12T22:59:00.000Z", until: "2026-11-25T22:59:00.000Z" } });
    expect(host.querySelector("#sb-late")?.textContent).toContain("iznimno odobrio kasnu predaju do 25. 11. 2026. u 23:59");
    expect(host.textContent).toContain("Iznimka do 25. 11. 2026.");
    expect(section(host, c.placeholders)).toBeDefined();
  });
});
