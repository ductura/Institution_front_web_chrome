// @vitest-environment jsdom
// ED-23 (NF2-P24): the editor's citation dialog says the style is the institution's setting and that
// FPZG applies in the pilot, next to the style it reads. The settings read is a fake; texts are invented.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const read = vi.hoisted(() => ({ next: null as null | { styleId: string; profileId: string | null; formattingStyle: object | null } }));
vi.mock("./institution-citation-settings", () => ({
  readInstitutionCitationSettings: () => (read.next === null ? new Promise(() => {}) : Promise.resolve(read.next)),
}));

import { EditorCitationSettings } from "./EditorCitationSettings";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no modal dialogs; the shared Dialog only needs `open` set.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
const NOTE = "Stil citiranja postavka je ustanove, a ne Vaš izbor u editoru. U pilotu na FPZG-u vrijedi stil FPZG.";

describe("EditorCitationSettings", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; read.next = null; });

  const mount = async () => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(<EditorCitationSettings onClose={() => {}} />); });
    return document.body;
  };

  it("names the style as the institution's setting, with FPZG in the pilot", async () => {
    read.next = { styleId: "fpzg", profileId: null, formattingStyle: {} };
    const body = await mount();
    expect(body.textContent).toContain("FPZG");
    expect(body.querySelector("[data-style-note]")?.textContent).toBe(NOTE);
    expect(body.textContent).not.toContain("Editor trenutačno ne može oblikovati");
  });

  it("keeps the note beside a style the editor cannot format yet", async () => {
    read.next = { styleId: "apa", profileId: null, formattingStyle: null };
    const body = await mount();
    expect(body.textContent).toContain("APA");
    expect(body.querySelector("[data-style-note]")?.textContent).toBe(NOTE);
    expect(body.textContent).toContain("Editor trenutačno ne može oblikovati navode i literaturu u ovom stilu.");
  });

  it("says nothing about the style before the settings are read", async () => {
    const body = await mount();
    expect(body.textContent).toContain("Učitavamo postavke citiranja.");
    expect(body.querySelector("[data-style-note]")).toBeNull();
  });
});
