// @vitest-environment jsdom
// #594 review, point 1: the banner of the teacher's revision request as a teacher meets it, over a stand-in port.
// Invented request and text only.
import { act, createElement as h, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RevisionRequest } from "@/client/revision-requests";
import { revisionMessages as t } from "./messages.hr";
import type { ActionOutcome, RevisionPort } from "./port";
import RevisionSection, { type RevisionSlots } from "./RevisionSection";

vi.mock("../n06/read", () => ({
  readFrame: async () => ({ kind: "ready", facts: { state: "predano" } }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no modal dialog; the dialog only needs to be open.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

const INSTRUCTION = "Izmišljena uputa: dopunite uvod jednim izvorom.";
const COMPARE = "/app/web/nastavnik/rad/izmisljeni-rad-0001/usporedba";
const answered = { kind: "done", explanation: "Dopunjeno.", revision: 9, isOwn: false, window: "2026-11-06T09:00:00.000Z" };
const request = (state: RevisionRequest["state"], response: object | null = null): RevisionRequest => ({
  id: "8b7a6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c01", number: 1, state, rowSeq: 4, anchor: null,
  versions: [{ version: 1, instruction: INSTRUCTION, requestedRevision: 4, openedIsOwn: true, openedWindow: "2026-11-05T20:40:00.000Z", response, closed: null }],
}) as unknown as RevisionRequest;

let root: Root | null = null;
let host: HTMLElement | null = null;

function portWith(requests: () => RevisionRequest[], withdraw: RevisionPort["withdraw"]) {
  const list = vi.fn(async () => ({ kind: "ok" as const, requests: requests() }));
  const port: RevisionPort = { list, withdraw, create: async () => "ok", accept: async () => "ok", reopen: async () => "ok" };
  return { port, list };
}

async function show(port: RevisionPort, compareHref?: string) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const slots = (s: RevisionSlots) => h(Fragment, null, s.action, s.banner, s.dialog);
  await act(async () => { root!.render(h(RevisionSection, { documentId: "izmisljeni-rad-0001", current: () => true, port, compareHref, children: slots })); });
  await act(async () => {});
}

const button = (label: string) => [...host!.querySelectorAll("button")].find((b) => b.textContent === label) ?? null;
async function click(label: string) {
  const target = button(label);
  if (target === null) throw new Error(`no button ${label}`);
  await act(async () => { target.click(); });
}
const dialog = () => host!.querySelector("dialog");

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null; host = null;
});

describe("doradaBanner of an open request", () => {
  it("shows what the student sees, the comparison link and Povuci zahtjev", async () => {
    await show(portWith(() => [request("open")], async () => "ok").port, COMPARE);
    const banner = host!.querySelector(".banner")!;
    expect(banner.textContent).toContain(`${t.studentSees} „${INSTRUCTION}”`);
    const link = [...banner.querySelectorAll("a")].find((a) => a.textContent === t.compare);
    expect(link?.getAttribute("href")).toBe(COMPARE);
    expect(button(t.withdraw)).not.toBeNull();
    expect(button(t.accept)).toBeNull();
  });

  it("has no comparison link when the frame gives none", async () => {
    await show(portWith(() => [request("open")], async () => "ok").port);
    expect([...host!.querySelectorAll("a")].map((a) => a.textContent)).not.toContain(t.compare);
  });

  it("offers no Povuci zahtjev once the student answered", async () => {
    await show(portWith(() => [request("responded", answered)], async () => "ok").port, COMPARE);
    expect(button(t.withdraw)).toBeNull();
    expect(button(t.accept)).not.toBeNull();
  });
});

describe("Povuci zahtjev", () => {
  it("asks first; Odustani sends nothing", async () => {
    const withdraw = vi.fn(async (): Promise<ActionOutcome> => "ok");
    await show(portWith(() => [request("open")], withdraw).port, COMPARE);
    await click(t.withdraw);
    expect(dialog()?.textContent).toContain(t.withdrawTitle);
    expect(dialog()?.textContent).toContain(t.withdrawExplain);
    await click(t.cancel);
    expect(dialog()).toBeNull();
    expect(withdraw).not.toHaveBeenCalled();
  });

  it("says withdrawn only after the server confirmed, then reads the requests again", async () => {
    let state: RevisionRequest["state"] = "open";
    let confirm: (o: ActionOutcome) => void = () => {};
    const withdraw = vi.fn(() => new Promise<ActionOutcome>((resolve) => { confirm = resolve; }));
    const { port, list } = portWith(() => [request(state)], withdraw);
    await show(port, COMPARE);
    await click(t.withdraw);
    await click(t.withdrawConfirm);
    expect(withdraw).toHaveBeenCalledWith(expect.objectContaining({ id: "8b7a6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c01", rowSeq: 4 }));
    expect(host!.textContent).not.toContain(t.withdrawn);
    expect(button(t.withdraw)?.disabled).toBe(true);
    state = "withdrawn";
    await act(async () => { confirm("ok"); });
    await act(async () => {});
    expect(host!.textContent).toContain(t.withdrawn);
    expect(list).toHaveBeenCalledTimes(2);
    expect(host!.querySelector(".banner")).toBeNull();
    expect(host!.querySelector('p[role="alert"]')).toBeNull();
  });

  it("keeps the request and names a refusal in role=alert, without a toast", async () => {
    const outcomes: [Exclude<ActionOutcome, "ok">, string][] = [["conflict", t.errors.conflict], ["forbidden", t.errors.forbidden], ["unavailable", t.errors.unavailable]];
    for (const [outcome, message] of outcomes) {
      await show(portWith(() => [request("open")], async () => outcome).port, COMPARE);
      await click(t.withdraw);
      await click(t.withdrawConfirm);
      expect(host!.querySelector('p[role="alert"]')?.textContent).toBe(message);
      expect(host!.textContent).not.toContain(t.withdrawn);
      expect(button(t.withdraw)).not.toBeNull();
      act(() => root?.unmount());
      host?.remove();
    }
  });
});
