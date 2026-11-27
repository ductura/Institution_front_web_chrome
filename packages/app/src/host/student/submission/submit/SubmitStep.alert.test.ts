// @vitest-environment jsdom
// S-08 (Ductus#2059): the frames in the error colour of step 4 and the colour of an outcome that is an error.
// D3: the work could not be read; D13: the deadline could not be read; an outcome is red only when it says an
// error (blocked, incomplete, unknown, errors) and plain when it only reports a state (waiting, not recorded).
// Invented work, title and deadline only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ASSIGNMENT, CONFIRMED, gateServer } from "../summary/declaration-gate.fixture";
import { submitText as t } from "./messages.hr";
import { isErrorLine, nextOf } from "./model";
import SubmitStep from "./SubmitStep";
import type { SubmitStage } from "./model";

const submitWork = vi.fn();
const readSubmissionState = vi.fn();
const readWork = vi.fn();
const router = { push: vi.fn() };
const hostContext = { base: "" };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../../context", () => ({ useHost: () => hostContext }));
vi.mock("../../../../../../../src/client/online-status", () => ({ useOnline: () => true }));
vi.mock("../../../ProblemReportHelp", () => ({ default: () => h("button", { type: "button" }, "Prijavi problem") }));
vi.mock("./local-hold", () => ({ deviceHasNewer: async () => false, sendLatestFromDevice: async () => null }));
vi.mock("../../../../../../../src/components/student/Submission", async (actual) => ({
  ...(await actual<object>()),
  readWork: (...a: unknown[]) => readWork(...a),
}));
vi.mock("../../../../../../../src/client/submission", async (actual) => ({
  ...(await actual<object>()),
  submitWork: (...a: unknown[]) => submitWork(...a),
  readSubmissionState: (...a: unknown[]) => readSubmissionState(...a),
}));
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const READY = { kind: "ready", documentId: "izmisljeni-dokument-1", revision: 2, nodes: [{ type: "paragraph", children: [{ text: "Izmišljen tekst rada.", marks: [] }] }] };
const DUE = "2027-01-12T22:59:00.000Z";

let root: Root | null = null;
beforeEach(() => { submitWork.mockReset(); readSubmissionState.mockReset(); readWork.mockReset(); readWork.mockResolvedValue(READY); });
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });

const settle = () => act(async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); });
async function mount(stage: SubmitStage = { kind: "open" }, dueAt: string | null = DUE) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const gate = gateServer(() => CONFIRMED).read;
  await act(async () => {
    root?.render(h(SubmitStep, { assignmentId: ASSIGNMENT, title: "Izmišljeni rad", stage, dueAt, declarationGate: gate }));
  });
  await settle();
  return host;
}
const alerts = (host: HTMLElement) => [...host.querySelectorAll('[role="alert"]')];

describe("S-08 D3: the work could not be read", () => {
  it("is a role=alert frame in the error colour; 'Pokušaj ponovno' stays the button, with no extra link", async () => {
    readWork.mockResolvedValue({ kind: "unavailable" });
    const host = await mount();
    const frame = alerts(host).find((a) => a.textContent === t.loadError);
    expect(frame?.tagName).toBe("DIV");
    expect(frame?.className).toMatch(/alert/);
    expect([...host.querySelectorAll("button")].filter((b) => b.textContent === t.retry)).toHaveLength(1);
    expect([...host.querySelectorAll("a")].some((a) => a.textContent === t.retry)).toBe(false);
    // and the retry really reads again
    readWork.mockResolvedValue(READY);
    await act(async () => { [...host.querySelectorAll("button")].find((b) => b.textContent === t.retry)?.click(); });
    await settle();
    expect(host.textContent).not.toContain(t.loadError);
  });
});

describe("S-08 D13: the deadline could not be read", () => {
  it("is a role=alert frame instead of a note", async () => {
    const host = await mount({ kind: "unavailable" }, null);
    const frame = alerts(host).find((a) => a.textContent === t.stageUnavailable);
    expect(frame?.tagName).toBe("DIV");
    expect(host.querySelector('[role="note"]')?.textContent ?? "").not.toContain(t.stageUnavailable);
  });
});

describe("S-08: the outcome line is red only for an error", () => {
  it("tells the error outcomes from the state outcomes", () => {
    expect(isErrorLine(nextOf({ kind: "odbijeno", reason: "segment_unsigned" }) as never)).toBe(true);
    expect(isErrorLine(nextOf({ kind: "nedovrseno" } as never) as never)).toBe(true);
    expect(isErrorLine(nextOf({ kind: "greska", code: "internal" } as never) as never)).toBe(true);
    expect(isErrorLine(nextOf({ kind: "nepoznato" } as never) as never)).toBe(true);
    // D9 waiting, and not recorded: they report a state, so they stay plain text.
    expect(isErrorLine(nextOf({ kind: "check", state: { kind: "ceka", revision: 1, requestedAt: "2027-01-12T10:00:00Z" } }) as never)).toBe(false);
    expect(isErrorLine(nextOf({ kind: "check", state: { kind: "none" } }) as never)).toBe(false);
    // The declaration warning is not an error either.
    expect(isErrorLine(nextOf({ kind: "izjava" }) as never)).toBe(false);
  });

  it("writes the refused line in the error class on the page", async () => {
    submitWork.mockResolvedValue({ kind: "odbijeno", reason: "segment_unsigned" });
    const host = await mount();
    await act(async () => { [...host.querySelectorAll("button")].find((b) => b.textContent === t.submit && !b.closest("dialog"))?.click(); });
    await act(async () => { ([...document.querySelectorAll("dialog button")].find((b) => b.textContent === t.submit) as HTMLElement | undefined)?.click(); });
    await settle();
    const line = alerts(host).find((a) => a.textContent === t.blocked.segment_unsigned);
    expect(line?.className).toMatch(/error/);
  });

  it("keeps the waiting line plain", async () => {
    submitWork.mockResolvedValue({ kind: "stanje", state: { kind: "ceka", revision: 2, requestedAt: "2027-01-12T10:00:00Z" } });
    const host = await mount();
    await act(async () => { [...host.querySelectorAll("button")].find((b) => b.textContent === t.submit && !b.closest("dialog"))?.click(); });
    await act(async () => { ([...document.querySelectorAll("dialog button")].find((b) => b.textContent === t.submit) as HTMLElement | undefined)?.click(); });
    await settle();
    const line = [...host.querySelectorAll("p")].find((p) => p.textContent === t.waiting);
    expect(line).toBeDefined();
    expect(line?.className).not.toMatch(/error/);
  });
});
