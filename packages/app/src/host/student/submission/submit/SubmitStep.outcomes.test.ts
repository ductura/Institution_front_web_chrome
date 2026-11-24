// @vitest-environment jsdom
// WEB-NUZ-PREDAJA-2 (NF-3 PR-7, PR-8, PR-9, PR-17): the dialog says only what is true, a late submission is
// confirmed twice, a refused or unknown outcome is a panel of its own, and an unknown one is read again.
// Invented work, title and deadlines only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ASSIGNMENT, CONFIRMED, DRAFT, gateServer } from "../summary/declaration-gate.fixture";
import { submitText as t } from "./messages.hr";
import SubmitStep from "./SubmitStep";
import type { Timing } from "./timing";
import { rehearsalMessagesHr as r } from "../../../../../../../src/components/editor/submission-rehearsal/messages.hr.ts";

const push = vi.fn();
const submitWork = vi.fn();
const readSubmissionState = vi.fn();
const hasNewer = vi.fn(async (_documentId: string) => false);
const router = { push };
const hostContext = { base: "" };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../../context", () => ({ useHost: () => hostContext }));
vi.mock("../../../../../../../src/client/online-status", () => ({ useOnline: () => true }));
vi.mock("../../../ProblemReportHelp", () => ({ default: () => h("button", { type: "button" }, "Prijavi problem") }));
vi.mock("./local-hold", () => ({ deviceHasNewer: (id: string) => hasNewer(id), sendLatestFromDevice: async () => null }));
vi.mock("../../../../../../../src/components/student/Submission", async (actual) => ({
  ...(await actual<object>()),
  readWork: async () => ({ kind: "ready", documentId: "izmisljeni-dokument-1", revision: 2, nodes: [{ type: "paragraph", children: [{ text: "Izmišljen tekst rada.", marks: [] }] }] }),
}));
vi.mock("../../../../../../../src/client/submission", async (actual) => ({
  ...(await actual<object>()),
  submitWork: (...a: unknown[]) => submitWork(...a),
  readSubmissionState: (...a: unknown[]) => readSubmissionState(...a),
}));
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DUE = "2026-11-12T22:59:00.000Z";
const NOT_REQUIRED = { ...DRAFT, state: "none", currentForm: null, draft: null, payload: null };

let root: Root | null = null;
beforeEach(() => { push.mockReset(); submitWork.mockReset(); readSubmissionState.mockReset(); hasNewer.mockReset(); hasNewer.mockResolvedValue(false); });
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; vi.useRealTimers(); });

const settle = () => act(async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); });
async function mount(options: { gate?: unknown; timing?: Timing } = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const gate = gateServer(() => options.gate ?? CONFIRMED).read;
  await act(async () => {
    root?.render(h(SubmitStep, { assignmentId: ASSIGNMENT, title: "Izmišljeni rad", stage: { kind: "open" }, dueAt: DUE, timing: options.timing, declarationGate: gate }));
  });
  await settle();
  return host;
}
const pageSubmit = (host: HTMLElement) => [...host.querySelectorAll("button")].find((b) => b.textContent === t.submit && !b.closest("dialog"));
const dialogSubmit = () => [...document.querySelectorAll("dialog button")].find((b) => b.textContent === t.submit) as HTMLButtonElement | undefined;
const byText = (host: HTMLElement, text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === text);
async function openDialog(host: HTMLElement) { await act(async () => { pageSubmit(host)?.click(); }); }
async function submit(host: HTMLElement) {
  await openDialog(host);
  await act(async () => { dialogSubmit()?.click(); });
  await settle();
}

describe("PR-7 the dialog 'Predati rad?'", () => {
  it("says 's izjavom' only when the server holds a confirmed declaration, with the word count", async () => {
    const host = await mount();
    await openDialog(host);
    expect(document.querySelector("dialog")?.textContent).toContain("Predaje se tekst rada „Izmišljeni rad” spremljen na poslužitelju, s izjavom. Riječi: 3.");
    expect(document.activeElement).toBe(dialogSubmit());
  });

  it("without a declaration asked for, says nothing of one and names it in the panel", async () => {
    const host = await mount({ gate: NOT_REQUIRED });
    expect(host.textContent).toContain(r.declarationNotRequired);
    await openDialog(host);
    const text = document.querySelector("dialog")?.textContent ?? "";
    expect(text).toContain("spremljen na poslužitelju. Riječi: 3.");
    expect(text).not.toContain("izjav");
  });

  it("a late submission is confirmed a second time before 'Predaj rad' sends", async () => {
    submitWork.mockResolvedValue({ kind: "nepoznato" });
    const host = await mount({ timing: { kind: "late", dueAt: DUE } });
    expect(host.textContent).toContain("Rok je prošao 12. 11. 2026. u 23:59.");
    await openDialog(host);
    expect(document.querySelector("dialog")?.textContent).toContain(t.dialogLate);
    const box = document.getElementById("sb-late-ok") as HTMLInputElement;
    expect(document.activeElement).toBe(box);
    expect(dialogSubmit()?.getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById(dialogSubmit()?.getAttribute("aria-describedby") ?? "")?.textContent).toBe(t.lateConfirmWhy);
    await act(async () => { dialogSubmit()?.click(); });
    expect(submitWork).not.toHaveBeenCalled();
    await act(async () => { box.click(); });
    expect(dialogSubmit()?.hasAttribute("aria-disabled")).toBe(false);
    await act(async () => { dialogSubmit()?.click(); });
    await settle();
    expect(submitWork).toHaveBeenCalledTimes(1);
  });

  it("the teacher's exception names its deadline, its tag, and is confirmed like a late submission", async () => {
    const host = await mount({ timing: { kind: "exception", dueAt: DUE, until: "2026-11-25T22:59:00.000Z" } });
    expect(host.textContent).toContain("Iznimka do 25. 11. 2026.");
    expect(host.textContent).toContain(t.late.exceptionDue);
    await openDialog(host);
    expect(document.querySelector("dialog")?.textContent).toContain("iznimno odobrio kasnu predaju do 25. 11. 2026. u 23:59");
    expect(dialogSubmit()?.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("PR-8 a refused submission is a panel of its own", () => {
  it("without 'Predaj rad'; 'Pokušaj ponovno' waits while the device holds unconfirmed text", async () => {
    // The check before sending finds nothing newer (INT-16); afterwards the device still holds unconfirmed text.
    hasNewer.mockResolvedValueOnce(false).mockResolvedValue(true);
    submitWork.mockResolvedValue({ kind: "odbijeno", reason: "segment_unsigned" });
    const host = await mount();
    await submit(host);
    expect(host.textContent).toContain(t.refusedTitle);
    expect(pageSubmit(host)).toBeUndefined();
    expect(host.textContent).toContain(t.notSavedLine);
    const retry = byText(host, t.retryAgain);
    expect(retry?.getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById(retry?.getAttribute("aria-describedby") ?? "")?.textContent).toBe(t.retryWhy);
    expect([...host.querySelectorAll("a")].some((a) => a.textContent === t.openWorkspace)).toBe(true);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(t.blocked.segment_unsigned);
  });

  it("'Pokušaj ponovno' opens once the text is on the server, and leads back to the panel with 'Predaj rad'", async () => {
    submitWork.mockResolvedValue({ kind: "odbijeno", reason: "no_evidence" });
    const host = await mount();
    await submit(host);
    await settle();
    expect(host.textContent).toContain(t.retryReady);
    const retry = byText(host, t.retryAgain);
    expect(retry?.hasAttribute("aria-disabled")).toBe(false);
    await act(async () => { retry?.click(); });
    await settle();
    expect(pageSubmit(host)).toBeDefined();
    expect(submitWork).toHaveBeenCalledTimes(1);
  });

  it("an unfinished submission names the request time the server holds, and no procedure it does not name", async () => {
    submitWork.mockResolvedValue({ kind: "nedovrseno" });
    readSubmissionState.mockResolvedValue({ kind: "ceka", revision: 2, requestedAt: "2026-11-20T09:00:00.000000Z" });
    const host = await mount();
    await submit(host);
    expect(host.textContent).toContain(t.incompleteTitle);
    expect(host.textContent).toContain("Vrijeme Vašeg zahtjeva (20. 11. 2026. u 10:00) je zabilježeno");
    expect(host.textContent).toContain(t.incompleteUnavailable);
    expect(pageSubmit(host)).toBeUndefined();
  });

  it("409 not_open after the deadline is 'Predaja nije otvorena' with the deadline, 'Natrag' and the workspace", async () => {
    submitWork.mockResolvedValue({ kind: "greska", code: "not_open" });
    const host = await mount({ timing: { kind: "late", dueAt: DUE } });
    await openDialog(host);
    await act(async () => { (document.getElementById("sb-late-ok") as HTMLInputElement).click(); });
    await act(async () => { dialogSubmit()?.click(); });
    await settle();
    expect(host.textContent).toContain(t.late.forbiddenTitle);
    expect(host.textContent).toContain("Rok je bio 12. 11. 2026. u 23:59.");
    expect(pageSubmit(host)).toBeUndefined();
    await act(async () => { byText(host, t.back)?.click(); });
    expect(push).toHaveBeenCalledWith(expect.stringContaining(`/rad/${ASSIGNMENT}/predaja/pregled`));
  });

  // Review #590, 1: before the deadline the server's not_open names no deadline and no rule on late submission.
  it("409 not_open before the deadline is one neutral line, without a deadline", async () => {
    submitWork.mockResolvedValue({ kind: "greska", code: "not_open" });
    const host = await mount({ timing: { kind: "open" } });
    await submit(host);
    expect(host.textContent).toContain(t.late.forbiddenTitle);
    expect(host.textContent).toContain(t.late.notOpen);
    expect(host.textContent).not.toContain("Rok je bio");
    expect(host.textContent).not.toContain(t.late.forbiddenMeta);
    expect(pageSubmit(host)).toBeUndefined();
  });
});

describe("PR-9 an unknown outcome", () => {
  it("is one message, read again when the connection returns, and after the third read offers a problem report", async () => {
    submitWork.mockResolvedValue({ kind: "nepoznato" });
    readSubmissionState.mockResolvedValue({ kind: "nepoznato" });
    const host = await mount();
    await submit(host);
    expect(host.textContent).toContain(t.unknown);
    expect(host.textContent).toContain(t.unknownAlert);
    expect(host.textContent).toContain("Pokušaj 1 od 3.");
    expect(pageSubmit(host)).toBeUndefined();
    for (const n of [2, 3]) {
      await act(async () => { window.dispatchEvent(new Event("online")); });
      await settle();
      expect(host.textContent).toContain(`Pokušaj ${n} od 3.`);
    }
    expect(byText(host, "Prijavi problem")).toBeUndefined();
    await act(async () => { byText(host, t.check)?.click(); });
    await settle();
    expect(readSubmissionState).toHaveBeenCalledTimes(3);
    expect(host.textContent).toContain(t.gaveUp);
    expect(host.textContent).toContain(t.reportMeta);
    expect(byText(host, "Prijavi problem")).toBeDefined();
    // Review #590, 5: after the third read no check is offered that would do nothing.
    expect(byText(host, t.check)).toBeUndefined();
    expect(byText(host, t.checking)).toBeUndefined();
    expect(pageSubmit(host)).toBeUndefined();
  });

  it("reads the state by itself after 10 s, and a server with no submission opens 'Predaj rad' again", async () => {
    submitWork.mockResolvedValue({ kind: "nepoznato" });
    readSubmissionState.mockResolvedValue({ kind: "none" });
    const host = await mount();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await openDialog(host);
    await act(async () => { dialogSubmit()?.click(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(host.textContent).toContain(t.unknown);
    expect(readSubmissionState).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(readSubmissionState).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain(t.notRecorded);
    expect(pageSubmit(host)).toBeDefined();
  });
});
