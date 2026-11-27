// @vitest-environment jsdom
// NF-3 PR-14 (E-9b, R-57): beside a submitted declaration, a note to it that the teacher sees; the
// declaration itself never changes, and the section carries the tag for legal review. Invented data only.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NoteAdded } from "../../../../../../../src/components/predaja/NoteDialog.tsx";
import DeclarationCorrection from "./DeclarationCorrection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
let root: Root | null = null;
let host: HTMLElement | null = null;
const settle = () => act(async () => { for (let i = 0; i < 4; i += 1) await new Promise((r) => setTimeout(r, 0)); });
async function render(add: (id: string, text: string) => Promise<NoteAdded>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(createElement(DeclarationCorrection, { assignmentId: ASSIGNMENT, receiptHref: "/aplikacija/rad/a1/predaja/potvrda", add })));
  return host;
}
const link = (name: string) => [...host!.querySelectorAll("a")].find((a) => a.textContent === name)!;
function type(value: string) {
  const field = host!.querySelector("textarea")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => { setter.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
}
async function send() {
  await act(async () => host!.querySelector("form")!.requestSubmit());
  await settle();
}
afterEach(() => { act(() => root?.unmount()); host?.remove(); });

describe("Ispravak izjave (PR-14)", () => {
  it("carries the legal review tag and points to the withdrawal", async () => {
    const el = await render(vi.fn());
    expect(el.querySelector("h2")?.textContent).toBe("Ispravak izjave");
    expect(el.textContent).toContain("za pravni pregled");
    expect(el.textContent).toContain("Tekst ovog odjeljka čeka pravni pregled.");
    expect(el.textContent).toContain("Potvrđena izjava se ne mijenja.");
    expect(link("Povlačenje predaje").getAttribute("href")).toBe("/aplikacija/rad/a1/predaja/potvrda");
  });

  it("adds the note only on the server's answer, and a blank one marks the field", async () => {
    const add = vi.fn(async (_id: string, text: string): Promise<NoteAdded> => ({ kind: "added", note: { id: "00000000-0000-4000-8000-0000000000f1", text, createdAt: "2026-11-24T10:00:00.000Z" } }));
    await render(add);
    await act(async () => link("Dodaj napomenu uz izjavu").click());
    expect(host!.querySelector("label")?.textContent).toContain("Napomena uz izjavu");
    await send();
    expect(add).not.toHaveBeenCalled();
    expect(host!.querySelector("textarea")?.getAttribute("aria-invalid")).toBe("true");
    type("Izmišljeno: izostavio sam alat za provjeru pravopisa.");
    await send();
    expect(add).toHaveBeenCalledWith(ASSIGNMENT, "Izmišljeno: izostavio sam alat za provjeru pravopisa.");
    expect(host!.querySelector("[role=status]")?.textContent).toBe("Napomena uz izjavu je dodana.");
    expect(host!.textContent).toContain("Izmišljeno: izostavio sam alat za provjeru pravopisa.");
    expect(host!.querySelector("textarea")).toBeNull();
  });

  it("keeps the form open with an alert when the server does not confirm the note", async () => {
    await render(async () => ({ kind: "nepoznato" }));
    await act(async () => link("Dodaj napomenu uz izjavu").click());
    type("Izmišljena napomena.");
    await send();
    expect(host!.querySelector("[role=alert]")).not.toBeNull();
    expect(host!.querySelector("textarea")).not.toBeNull();
    expect(host!.textContent).not.toContain("Napomena uz izjavu je dodana.");
  });
});
