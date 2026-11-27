// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assistHr } from "../assist";
import { leftSectionsFor, ThreadHelp, WritingHelp } from "./LeftSectionsHost";

// EDI-R16: the writing-help cards are mounted in the left panel's sections. Invented work id only; no editor is open
// (what the sheet gets before it has loaded), so the cards show the empty work.
vi.mock("@/components/editor/LocalDocument", async (original) => ({ ...(await original<Record<string, unknown>>()), useLocalEditor: () => null }));
vi.mock("../../../../../../src/components/editor/LocalDocument.tsx", async (original) => ({ ...(await original<Record<string, unknown>>()), useLocalEditor: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no modal dialog; the wizard's dialog opens through these.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
let host: HTMLDivElement | null = null;
afterEach(() => { host?.remove(); host = null; window.localStorage.clear(); });

async function mount(node: ReactNode) {
  host = document.createElement("div");
  document.body.append(host);
  await act(async () => { createRoot(host!).render(node); });
  return host;
}

describe("writing help in the left panel (EDI-R16)", () => {
  it("Napredak carries Sljedeći korak, Nastavi gdje ste stali, Brzi skok and Ravnoteža; Nit rada carries the thread", async () => {
    const sections = leftSectionsFor("rad-1", "dok-1", null, { min: 3000, max: 5000 });
    const progress = await mount(sections.progress);
    expect(progress.querySelector("[data-next-step]")).not.toBeNull();
    expect(progress.querySelector("[data-resume]")).not.toBeNull();
    expect(progress.querySelector("[data-quick-jump]")).not.toBeNull();
    expect(progress.querySelector("[data-balance]")).not.toBeNull();
    host?.remove();
    const thread = await mount(sections.thread);
    expect(thread.querySelector("[data-thread]")).not.toBeNull();
    expect(thread.textContent).toContain(assistHr.wizard.title);
  });

  it("an empty work offers the wizard as the next step, and a work with no open editor cannot be written into", async () => {
    const el = await mount(createElement(WritingHelp, { workId: "rad-2" }));
    const next = el.querySelector<HTMLButtonElement>("[data-next-step] button");
    expect(next?.textContent).toBe(assistHr.next.empty);
    await act(async () => { next!.click(); });
    expect(document.body.textContent).toContain(assistHr.wizard.steps[0]);
  });

  it("the thread's entry to the wizard is off without an editable work", async () => {
    const el = await mount(createElement(ThreadHelp, { workId: "rad-3" }));
    const open = [...el.querySelectorAll("button")].find((b) => b.textContent === assistHr.wizard.title);
    expect(open?.disabled).toBe(true);
  });
});
