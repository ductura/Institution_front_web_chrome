// @vitest-environment jsdom
// WEB-V21-STEM-FORMULA-DIJALOG: the host's formula dialog (invented formulas only).
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FormulaDialog, type FormulaDialogProps } from "./FormulaDialog.tsx";
import { MAX_FORMULA_TEX_CODE_POINTS, MAX_INLINE_FORMULA_TEX_CODE_POINTS } from "./limits.ts";
import { formulaDialogHr as t } from "./messages.hr.ts";
import { FORMULA_TEMPLATES, applyTemplate, hasHoles, nextHole } from "./templates.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no modal <dialog>: open/close just toggle the attribute.
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };

let mount: HTMLDivElement | null = null;
let root: Root | null = null;
afterEach(() => { act(() => root?.unmount()); mount?.remove(); mount = null; root = null; });

async function render(props: Partial<FormulaDialogProps> = {}) {
  const onConfirm = props.onConfirm ?? vi.fn();
  const onClose = props.onClose ?? vi.fn();
  mount = document.createElement("div");
  document.body.append(mount);
  root = createRoot(mount);
  await act(async () => {
    root!.render(createElement(FormulaDialog, { open: true, kind: "block", onConfirm, onClose, ...props }));
  });
  return { onConfirm, onClose };
}

const field = () => document.querySelector("textarea")!;
const button = (label: string) => Array.from(document.querySelectorAll("button")).find((b) => b.textContent === label)!;
const preview = () => document.querySelector(`[aria-label="${t.previewLabel}"]`)!;
const type = async (value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field(), value);
    field().dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const click = async (el: HTMLElement) => { await act(async () => { el.click(); }); };

describe("formula dialog", () => {
  it("the preview follows the typed text", async () => {
    await render();
    expect(preview().textContent).toBe(t.previewEmpty);
    await type("x^{2}+1");
    expect(preview().querySelector(".katex")).not.toBeNull();
    expect(preview().querySelector("annotation")?.textContent).toBe("x^{2}+1");
    await type("\\frac{a}{b}");
    expect(preview().querySelector(".mfrac")).not.toBeNull();
    await type("");
    expect(preview().textContent).toBe(t.previewEmpty);
  });

  it("a template changes the field, and confirming stays off while a blank is left", async () => {
    const { onConfirm } = await render();
    await click(button(t.templateNames.fraction));
    expect(field().value).toBe("\\frac{□}{□}");
    expect(button(t.confirm).disabled).toBe(true);
    expect(document.querySelector("[role=alert]")?.textContent).toBe(t.holes);
    await click(button(t.confirm));
    expect(onConfirm).not.toHaveBeenCalled();
    await type("\\frac{1}{2}");
    expect(button(t.confirm).disabled).toBe(false);
  });

  it("every template is offered and its example renders", async () => {
    await render();
    for (const template of FORMULA_TEMPLATES) {
      await type("");
      await click(button(t.templateNames[template.id as keyof typeof t.templateNames]));
      expect(field().value).toBe(template.tex);
      await type(template.example);
      expect(button(t.confirm).disabled, template.id).toBe(false);
    }
  });

  it("over the limit turns confirming off; the limit is 1000 inline and 4000 as a block", async () => {
    const { onConfirm } = await render();
    await type("x".repeat(MAX_FORMULA_TEX_CODE_POINTS));
    expect(button(t.confirm).disabled).toBe(false);
    await type("x".repeat(MAX_FORMULA_TEX_CODE_POINTS + 1));
    expect(button(t.confirm).disabled).toBe(true);
    expect(document.querySelector("[role=alert]")?.textContent).toBe(t.tooLong(MAX_FORMULA_TEX_CODE_POINTS + 1, MAX_FORMULA_TEX_CODE_POINTS));
    expect(field().value.length).toBe(MAX_FORMULA_TEX_CODE_POINTS + 1);
    await click(button(t.confirm));
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => root!.unmount());
    mount!.remove();
    await render({ kind: "inline" });
    await type("x".repeat(MAX_INLINE_FORMULA_TEX_CODE_POINTS + 1));
    expect(button(t.confirm).disabled).toBe(true);
  });

  it("a broken or refused formula shows a message and keeps the text", async () => {
    const onConfirm = vi.fn(() => false);
    await render({ onConfirm });
    await type("\\frac{1}{");
    expect(button(t.confirm).disabled).toBe(true);
    expect(document.querySelector("[role=alert]")?.textContent).toBe(t.broken);
    expect(field().value).toBe("\\frac{1}{");
    await type("\\href{https://example.org}{x}");
    expect(button(t.confirm).disabled).toBe(true);
    await type("a+b");
    await click(button(t.confirm));
    expect(onConfirm).toHaveBeenCalledWith({ kind: "block", tex: "a+b" });
    expect(document.querySelector("[role=alert]")?.textContent).toBe(t.refused);
    expect(field().value).toBe("a+b");
  });

  it("confirming gives { kind, tex } for both the block and the inline dialog", async () => {
    const block = await render({ initialTex: " E=mc^{2} " });
    expect(document.querySelector("h2")?.textContent).toBe(t.title);
    await click(button(t.confirm));
    expect(block.onConfirm).toHaveBeenCalledWith({ kind: "block", tex: "E=mc^{2}" });
    act(() => root!.unmount());
    mount!.remove();
    const inline = await render({ kind: "inline", initialTex: "a_{1}" });
    expect(document.querySelector("h2")?.textContent).toBe(t.inlineTitle);
    await click(button(t.confirm));
    expect(inline.onConfirm).toHaveBeenCalledWith({ kind: "inline", tex: "a_{1}" });
  });

  it("Escape closes without a change; Cancel as well", async () => {
    const { onConfirm, onClose } = await render({ initialTex: "a+b" });
    await type("changed");
    await act(async () => {
      document.querySelector("dialog")!.dispatchEvent(new Event("cancel", { bubbles: false, cancelable: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    await click(button(t.cancel));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("formula dialog sessions and Tab", () => {
  it("reopening with another formula starts from that formula, not the old draft", async () => {
    mount = document.createElement("div");
    document.body.append(mount);
    root = createRoot(mount);
    const draw = (props: Partial<FormulaDialogProps>) => act(async () => {
      root!.render(createElement(FormulaDialog, { open: true, kind: "block", onConfirm: () => false, onClose: () => {}, ...props }));
    });
    await draw({ initialTex: "a+b" });
    await type("edited");
    await click(button(t.confirm));
    expect(document.querySelector("[role=alert]")?.textContent).toBe(t.refused);
    await draw({ open: false, initialTex: "a+b" });
    await draw({ open: true, initialTex: "c+d" });
    expect(field().value).toBe("c+d");
    expect(document.querySelector("[role=alert]")).toBeNull();
    await draw({ open: true, initialTex: "e+f" });
    expect(field().value).toBe("e+f");
  });

  it("Tab on a blank selects it and keeps the focus in the field", async () => {
    await render();
    await click(button(t.templateNames.fraction));
    field().focus();
    field().setSelectionRange(0, 0);
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    await act(async () => { field().dispatchEvent(tab); });
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(field());
    expect([field().selectionStart, field().selectionEnd]).toEqual([6, 7]);
  });
});

describe("templates", () => {
  it("finds blanks, wraps round, and a selection fills the first blank", () => {
    expect(hasHoles("a")).toBe(false);
    expect(nextHole("□+□", 1)).toBe(2);
    expect(nextHole("□+□", 3)).toBe(0);
    expect(nextHole("abc", 0)).toBe(-1);
    expect(applyTemplate("xy", 0, 2, "\\sqrt{□}")).toEqual({ tex: "\\sqrt{xy}", caret: 9, caretEnd: 9 });
    expect(applyTemplate("", 0, 0, "\\frac{□}{□}")).toEqual({ tex: "\\frac{□}{□}", caret: 6, caretEnd: 7 });
    expect(applyTemplate("ab", 99, 120, "c")).toEqual({ tex: "abc", caret: 3, caretEnd: 3 });
  });
});
