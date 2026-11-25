// @vitest-environment jsdom
// NF-3 PR-10 (E-8c, R-64) and PR-5 (PD-10) on step 3: a newer version on this device is named before the
// dialog, with the same two choices as step 4, and "Dalje" waits for the choice; the declaration opens
// as a dialog on this step, a stale one as "Potvrdi izjavu ponovno". Invented data only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BeforeSubmitStep from "./BeforeSubmitStep";
import { ASSIGNMENT, CONFIRMED, DRAFT, gateServer } from "./declaration-gate.fixture";
import { checksText as c } from "./messages.hr";
import { dialogTexts as d } from "../declaration/dialog-model";
import { submitText } from "../submit/messages.hr";
import { takeChoice } from "../submit/newer-choice";

const push = vi.fn();
const router = { push };
const WORK = { documentId: "izmisljeni-dokument-1", revision: 3 };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../../../../../../src/client/online-status.ts", () => ({ useOnline: () => true }));
vi.mock("../../../../../../../src/components/student/Submission.tsx", () => ({
  readWork: async () => ({ kind: "ready", ...WORK, nodes: [{ children: [{ text: "Izmišljen tekst rada." }] }] }),
}));
vi.mock("../../../../../../../src/client/process-summary.ts", () => ({ fetchProcessSummary: async () => ({ kind: "error" }) }));
vi.mock("../submit/local-hold", () => ({ deviceHasNewer: async () => false }));
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
beforeEach(() => { vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined))); push.mockReset(); });
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; vi.unstubAllGlobals(); takeChoice(ASSIGNMENT, WORK); });

const settle = () => act(async () => { for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r, 0)); });
async function mount(state: unknown, hasNewer: (documentId: string) => Promise<boolean>) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(h(BeforeSubmitStep, {
      assignmentId: ASSIGNMENT, stage: { kind: "open" } as never, hrefOf: (p: string) => p, workHref: "/rad/x",
      onSignIn: () => undefined, declarationGate: gateServer(() => state).read, hasNewer,
    }));
  });
  await settle();
  return host;
}
const nextButton = (host: HTMLElement) => [...host.querySelectorAll("button")].find((b) => b.textContent === c.next)!;
const radio = (host: HTMLElement, value: string) => host.querySelector<HTMLInputElement>(`input[name="sb-ver"][value="${value}"]`)!;

describe("step 3: a newer version on this device (PR-10)", () => {
  it("is named before the dialog, and Dalje waits for the choice, which step 4 then takes once", async () => {
    const asked: string[] = [];
    const host = await mount(CONFIRMED, async (id) => { asked.push(id); return true; });
    expect(asked).toEqual([WORK.documentId]);
    expect(host.textContent).toContain(submitText.newer.title);
    expect(radio(host, "latest").closest("label")?.textContent).toBe(submitText.newer.latest);
    expect(radio(host, "confirmed").closest("label")?.textContent).toBe(submitText.newer.confirmed.replace("{n}", "3"));
    expect(nextButton(host).getAttribute("aria-disabled")).toBe("true");
    expect(host.querySelector(`#${nextButton(host).getAttribute("aria-describedby")}`)?.textContent).toBe(c.newerWhy);
    await act(async () => nextButton(host).click());
    expect(push).not.toHaveBeenCalled();

    await act(async () => radio(host, "confirmed").click());
    expect(nextButton(host).hasAttribute("aria-disabled")).toBe(false);
    await act(async () => nextButton(host).click());
    expect(push).toHaveBeenCalledWith(`/rad/${ASSIGNMENT}/predaja/slanje`);
    expect(takeChoice(ASSIGNMENT, WORK)).toBe("confirmed");
    expect(takeChoice(ASSIGNMENT, WORK)).toBeNull();
  });

  it("without a newer version nothing is asked and Dalje leads on", async () => {
    const host = await mount(CONFIRMED, async () => false);
    expect(host.textContent).not.toContain(submitText.newer.title);
    expect(host.querySelector('input[name="sb-ver"]')).toBeNull();
    expect(nextButton(host).hasAttribute("aria-disabled")).toBe(false);
  });

  it("a read of the device that fails never holds the submission", async () => {
    const host = await mount(CONFIRMED, async () => { throw new Error("izmišljen kvar"); });
    expect(host.textContent).not.toContain(submitText.newer.title);
    expect(nextButton(host).hasAttribute("aria-disabled")).toBe(false);
  });
});

describe("step 3: the declaration as a dialog (PR-5)", () => {
  it("a stale confirmation is one sentence with Potvrdi izjavu ponovno, which opens the dialog on this step", async () => {
    const host = await mount({ ...CONFIRMED, currentRevision: 3 }, async () => false);
    const open = [...host.querySelectorAll("button")].find((b) => b.textContent === d.reconfirm);
    expect(open).toBeDefined();
    await act(async () => open?.click());
    expect(document.querySelector("dialog h2")?.textContent).toBe(d.title);
    expect(document.querySelector("dialog")?.textContent).toContain(d.stale);
    expect(push).not.toHaveBeenCalled();
  });

  it("a draft offers Otvori izjavu; a confirmed declaration offers nothing", async () => {
    const draft = await mount(DRAFT, async () => false);
    expect([...draft.querySelectorAll("button")].some((b) => b.textContent === d.open)).toBe(true);
    act(() => root?.unmount());
    root = null;
    const confirmed = await mount(CONFIRMED, async () => false);
    expect([...confirmed.querySelectorAll("button")].some((b) => b.textContent === d.open || b.textContent === d.reconfirm)).toBe(false);
  });
});
