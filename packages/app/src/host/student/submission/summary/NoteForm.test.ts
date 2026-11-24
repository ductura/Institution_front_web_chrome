// @vitest-environment jsdom
// NF-3 PR-6 (E-8d, R-66, G-9): the note is shown as added only on the server's note; an answer that
// leaves it unknown is an alert, and a second click while the first is on its way sends nothing.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { messagesHr } from "../../../../../../../src/lib/i18n/messages.hr.ts";
import type { NoteAdded } from "../../../../../../../src/components/predaja/NoteDialog.tsx";
import NoteForm from "./NoteForm";
import { summaryText } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOTE = { id: "00000000-0000-4000-8000-00000000a001", text: "Izmišljena napomena.", createdAt: "2026-11-20T10:00:00.000Z" };

let root: Root | null = null;
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });

async function mount(onAdd: (text: string) => Promise<NoteAdded>) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const onAdded = vi.fn();
  await act(async () => { root?.render(h(NoteForm, { online: true, onAdd, onAdded, onCancel: () => undefined })); });
  return { host, onAdded };
}

async function type(host: HTMLElement, text: string) {
  const field = host.querySelector("textarea") as HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const submit = (host: HTMLElement) => act(async () => {
  host.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
});

describe("NoteForm (NF-3 PR-6)", () => {
  it("says who reads the note", async () => {
    const { host } = await mount(async () => ({ kind: "added", note: NOTE }));
    expect(host.textContent).toContain(summaryText.notes.seenBy);
  });

  it("adds the note only on the server's note", async () => {
    const onAdd = vi.fn(async () => ({ kind: "added", note: NOTE }) as NoteAdded);
    const { host, onAdded } = await mount(onAdd);
    await type(host, "  Izmišljena napomena.  ");
    await submit(host);
    expect(onAdd).toHaveBeenCalledWith("Izmišljena napomena.");
    expect(onAdded).toHaveBeenCalledWith(NOTE);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it("an answer that does not say the note was added is an alert, and nothing is shown as added", async () => {
    const { host, onAdded } = await mount(async () => ({ kind: "nepoznato" }) as NoteAdded);
    await type(host, "Izmišljena napomena.");
    await submit(host);
    expect(onAdded).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(messagesHr.beforeSubmit.noteUnknown);
    expect(document.activeElement).toBe(host.querySelector("textarea"));
  });

  it("the server's refusal of the text marks the field, not an alert", async () => {
    const { host, onAdded } = await mount(async () => ({ kind: "greska", code: "invalid" }) as NoteAdded);
    await type(host, "Izmišljena napomena.");
    await submit(host);
    expect(onAdded).not.toHaveBeenCalled();
    expect(host.querySelector("textarea")?.getAttribute("aria-invalid")).toBe("true");
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it("a blank note is not sent", async () => {
    const onAdd = vi.fn(async () => ({ kind: "added", note: NOTE }) as NoteAdded);
    const { host } = await mount(onAdd);
    await type(host, "   ");
    await submit(host);
    expect(onAdd).not.toHaveBeenCalled();
    expect(host.querySelector("textarea")?.getAttribute("aria-invalid")).toBe("true");
  });

  it("a second submit while the first is on its way sends nothing", async () => {
    let finish: (value: NoteAdded) => void = () => undefined;
    const onAdd = vi.fn(() => new Promise<NoteAdded>((resolve) => { finish = resolve; }));
    const { host, onAdded } = await mount(onAdd);
    await type(host, "Izmišljena napomena.");
    await submit(host);
    await submit(host);
    expect(onAdd).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ kind: "added", note: NOTE }); await new Promise((r) => setTimeout(r, 0)); });
    expect(onAdded).toHaveBeenCalledTimes(1);
  });
});
