// @vitest-environment jsdom
// NF-3 PR-10: a version chosen on step 3 for this revision is not asked again on step 4; without it
// the INT-16 warning stands as before. Invented data only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ASSIGNMENT, CONFIRMED, gateServer } from "../summary/declaration-gate.fixture";
import { submitText as t } from "./messages.hr";
import { rememberChoice } from "./newer-choice";
import SubmitStep from "./SubmitStep";

const submitWork = vi.fn();
const router = { push: vi.fn() };
const hostContext = { base: "" };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../../context", () => ({ useHost: () => hostContext }));
vi.mock("../../../../../../../src/client/online-status", () => ({ useOnline: () => true }));
vi.mock("./local-hold", () => ({ deviceHasNewer: async () => true, sendLatestFromDevice: async () => null }));
vi.mock("../../../../../../../src/components/student/Submission", async (actual) => ({
  ...(await actual<object>()),
  readWork: async () => ({ kind: "ready", documentId: "izmisljeni-dokument-1", revision: 2, nodes: [{ children: [{ text: "Izmišljen tekst rada." }] }] }),
}));
vi.mock("../../../../../../../src/client/submission", async (actual) => ({ ...(await actual<object>()), submitWork: (...a: unknown[]) => submitWork(...a) }));
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
beforeEach(() => { submitWork.mockReset(); submitWork.mockResolvedValue({ kind: "nepoznato" }); });
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });

const settle = () => act(async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); });
async function submitOnce() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(h(SubmitStep, { assignmentId: ASSIGNMENT, title: "Izmišljeni rad", stage: { kind: "open" }, dueAt: "2026-12-01T10:00:00.000Z", declarationGate: gateServer(() => CONFIRMED).read }));
  });
  await settle();
  await act(async () => { [...host.querySelectorAll("button")].find((b) => b.textContent === t.submit && !b.closest("dialog"))?.click(); });
  await act(async () => { ([...document.querySelectorAll("dialog button")].find((b) => b.textContent === t.submit) as HTMLButtonElement | undefined)?.click(); });
  await settle();
}

describe("step 4 takes the version chosen on step 3 (PR-10)", () => {
  it("submits the confirmed revision without asking again", async () => {
    rememberChoice(ASSIGNMENT, { documentId: "izmisljeni-dokument-1", revision: 2 }, "confirmed");
    await submitOnce();
    expect(document.querySelector("dialog h2")?.textContent).not.toBe(t.newer.title);
    expect(submitWork).toHaveBeenCalledTimes(1);
    expect(submitWork.mock.calls[0]?.[0]).toEqual({ assignmentId: ASSIGNMENT, documentId: "izmisljeni-dokument-1", revision: 2 });
  });

  it("without a choice for this revision, the INT-16 warning is shown and nothing is submitted", async () => {
    rememberChoice(ASSIGNMENT, { documentId: "izmisljeni-dokument-1", revision: 1 }, "confirmed");
    await submitOnce();
    expect(document.querySelector("dialog h2")?.textContent).toBe(t.newer.title);
    expect(submitWork).not.toHaveBeenCalled();
  });
});
