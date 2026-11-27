// @vitest-environment jsdom
// F4-NAS-R09 (NAS-07): a significant change on /uredi is published only after the teacher confirms it.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import AssignmentVersionForm from "@/components/teacher/AssignmentVersionForm";
import type { CurrentVersion } from "@/components/teacher/assignment-version";
import { messagesHr } from "@/lib/i18n/messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
const n = messagesHr.teacher.newVersion;
const CURRENT: CurrentVersion = {
  assignmentId: "00000000-0000-4000-8000-0000000000a1", versionNo: 3, title: "Izmišljeni esej", instructions: "Izmišljene upute.",
  workType: "essay", evidenceProfile: "basic", importAllowed: false, opensAt: "2026-11-01T08:00:00.000Z", dueAt: "2026-11-30T22:59:00.000Z",
  aiPolicy: "partially_allowed", aiPurposes: ["formatting", "proofreading"], wordMin: 1000, wordMax: 2000,
};

describe("AssignmentVersionForm confirmation (F4-NAS-R09, NAS-07)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; vi.unstubAllGlobals(); });

  const fetchOk = () => vi.fn(async () => new Response(JSON.stringify({ assignmentId: CURRENT.assignmentId, versionNo: 4 }), { status: 201, headers: { "content-type": "application/json" } }));
  async function mount() {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(AssignmentVersionForm, { current: CURRENT })); });
    return host;
  }
  const typeInto = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    await act(async () => {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const click = async (el: Element) => { await act(async () => { (el as HTMLElement).click(); }); };
  const publishButton = () => [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === n.publish.replace("{n}", "4") && b.type === "submit")!;
  const inDialog = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("dialog button")].find((b) => b.textContent === label)!;
  const dialogLabel = n.confirm.publish.replace("{n}", "4");

  it("asks before publishing a changed word range, and publishes only on confirm", async () => {
    const send = fetchOk();
    vi.stubGlobal("fetch", send);
    const host = await mount();
    await typeInto(host.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]')[1]!, "3000");
    await click(publishButton());
    expect(send).not.toHaveBeenCalled();
    expect(document.querySelector("dialog")?.textContent).toContain(n.fields.wordRange);
    await click(inDialog(dialogLabel));
    expect(send).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain(n.published.replace("{n}", "4"));
  });

  it("publishes nothing when the teacher goes back, and the draft stays", async () => {
    const send = fetchOk();
    vi.stubGlobal("fetch", send);
    const host = await mount();
    const due = host.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]')[1]!;
    await typeInto(due, "2026-12-15T10:00");
    await click(publishButton());
    expect(document.querySelector("dialog")?.textContent).toContain(n.fields.dueAt);
    await click(inDialog(n.confirm.cancel));
    expect(send).not.toHaveBeenCalled();
    expect(document.querySelector("dialog")).toBeNull();
    expect(host.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]')[1]!.value).toBe("2026-12-15T10:00");
  });

  it("does not ask for a change that is not significant (title only)", async () => {
    const send = fetchOk();
    vi.stubGlobal("fetch", send);
    const host = await mount();
    await typeInto(host.querySelector<HTMLInputElement>('input[maxlength="200"]')!, "Drugi naslov");
    await click(publishButton());
    expect(document.querySelector("dialog")).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
