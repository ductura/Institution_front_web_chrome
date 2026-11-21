// @vitest-environment jsdom
import axe from "axe-core";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssistantTransfer, type AssistantTransferProps } from "./AssistantTransfer";
import { changedSpan } from "./transfer-logic";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: AssistantTransferProps["labels"] = {
  transfer: "Prenesi u rad",
  compare: "Usporedba prije primjene",
  compareHint: "Uklonjeno je precrtano, dodano podcrtano.",
  before: "Prije",
  after: "Poslije",
  apply: "Primijeni",
  cancel: "Odustani",
  transferred: "Preneseno u rad.",
  busy: "Prenosim…",
  disabled: "Prijenos nije dostupan na ovom zadatku.",
};
const PARAGRAPH = "Izmišljeni grad Ravnica ima tri trga i jednu rijeku.";
const ANSWER = "Izmišljeni grad Ravnica ima četiri trga i jednu rijeku.";

let root: Root | undefined;
let host: HTMLElement | undefined;
function mount(node: ReactNode): HTMLElement {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
}
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
});

const button = (el: Element, text: string) => {
  const found = [...el.querySelectorAll("button")].find((b) => b.textContent === text);
  if (found === undefined) throw new Error(`no button ${text}`);
  return found;
};
const click = (target: HTMLElement) => act(() => target.click());
const side = (el: Element, name: string) => el.querySelector(`[data-side="${name}"]`);
const violations = async (el: Element) => (await axe.run(el, { rules: { region: { enabled: false }, "color-contrast": { enabled: false } } })).violations.map((v) => v.id);

describe("changedSpan", () => {
  it("rebuilds both texts exactly and isolates the changed stretch", () => {
    const span = changedSpan(PARAGRAPH, ANSWER);
    expect(span.prefix + span.removed + span.suffix).toBe(PARAGRAPH);
    expect(span.prefix + span.added + span.suffix).toBe(ANSWER);
    expect(span.removed).toBe("tri");
    expect(span.added).toBe("četiri");
  });

  it("handles identical, empty and surrogate-pair texts", () => {
    expect(changedSpan("isto", "isto")).toEqual({ prefix: "isto", removed: "", added: "", suffix: "" });
    expect(changedSpan("", "novo")).toEqual({ prefix: "", removed: "", added: "novo", suffix: "" });
    const span = changedSpan("a😀b", "a😁b");
    expect(span).toEqual({ prefix: "", removed: "a😀b", added: "a😁b", suffix: "" });
    expect(changedSpan("x 😀 y", "x 😁 y")).toEqual({ prefix: "x ", removed: "😀", added: "😁", suffix: " y" });
  });
});

describe("AssistantTransfer", () => {
  it("the comparison shows exactly the paragraph and the answer from props", async () => {
    const el = mount(<AssistantTransfer labels={labels} paragraph={PARAGRAPH} answer={ANSWER} onApply={vi.fn()} />);
    expect(side(el, "before")).toBeNull();
    click(button(el, "Prenesi u rad"));
    expect(side(el, "before")?.textContent).toBe(PARAGRAPH);
    expect(side(el, "after")?.textContent).toBe(ANSWER);
    expect(el.querySelector("del")?.textContent).toBe("tri");
    expect(el.querySelector("ins")?.textContent).toBe("četiri");
    expect(document.activeElement?.textContent).toBe("Usporedba prije primjene");
    expect(await violations(el)).toEqual([]);
  });

  it("cancel never calls apply and returns focus to the transfer button", () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    const el = mount(<AssistantTransfer labels={labels} paragraph={PARAGRAPH} answer={ANSWER} onApply={onApply} onCancel={onCancel} />);
    click(button(el, "Prenesi u rad"));
    click(button(el, "Odustani"));
    expect(onApply).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(side(el, "before")).toBeNull();
    expect(document.activeElement).toBe(button(el, "Prenesi u rad"));
  });

  it("Escape cancels like the cancel button", () => {
    const onApply = vi.fn();
    const el = mount(<AssistantTransfer labels={labels} paragraph={PARAGRAPH} answer={ANSWER} onApply={onApply} />);
    click(button(el, "Prenesi u rad"));
    act(() => { document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    expect(onApply).not.toHaveBeenCalled();
    expect(side(el, "after")).toBeNull();
    expect(document.activeElement).toBe(button(el, "Prenesi u rad"));
  });

  it("apply calls the callback once, closes and returns focus", () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    const el = mount(<AssistantTransfer labels={labels} paragraph={PARAGRAPH} answer={ANSWER} onApply={onApply} onCancel={onCancel} />);
    click(button(el, "Prenesi u rad"));
    click(button(el, "Primijeni"));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(side(el, "before")).toBeNull();
    expect(document.activeElement).toBe(button(el, "Prenesi u rad"));
  });

  it("disabled, busy and transferred keep the button focusable but inert, and say why", () => {
    for (const [props, text] of [[{ disabled: true }, labels.disabled], [{ busy: true }, labels.busy], [{ transferred: true }, labels.transferred]] as const) {
      const onApply = vi.fn();
      const el = mount(<AssistantTransfer labels={labels} paragraph={PARAGRAPH} answer={ANSWER} onApply={onApply} {...props} />);
      const transfer = button(el, "Prenesi u rad");
      expect(transfer.getAttribute("aria-disabled")).toBe("true");
      expect(transfer.hasAttribute("disabled")).toBe(false);
      click(transfer);
      expect(side(el, "before")).toBeNull();
      const meta = el.querySelector('[role="status"]');
      expect(meta?.textContent).toBe(text);
      expect(transfer.getAttribute("aria-describedby")).toBe(meta?.id);
      act(() => root?.unmount());
      host?.remove();
      root = undefined;
    }
  });

  it("apply does nothing once the parent turns the transfer unavailable, cancel still closes", () => {
    for (const props of [{ disabled: true }, { busy: true }, { transferred: true }]) {
      const onApply = vi.fn();
      const onCancel = vi.fn();
      const el = mount(<AssistantTransfer labels={labels} paragraph={PARAGRAPH} answer={ANSWER} onApply={onApply} onCancel={onCancel} />);
      click(button(el, "Prenesi u rad"));
      act(() => root!.render(<AssistantTransfer labels={labels} paragraph={PARAGRAPH} answer={ANSWER} onApply={onApply} onCancel={onCancel} {...props} />));
      const apply = button(el, "Primijeni");
      expect(apply.getAttribute("aria-disabled")).toBe("true");
      click(apply);
      expect(onApply).not.toHaveBeenCalled();
      expect(side(el, "before")).not.toBeNull();
      click(button(el, "Odustani"));
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(side(el, "before")).toBeNull();
      act(() => root?.unmount());
      host?.remove();
      root = undefined;
    }
  });

  it("an error from the parent is an alert", () => {
    const html = renderToStaticMarkup(<AssistantTransfer labels={labels} paragraph={PARAGRAPH} answer={ANSWER} onApply={vi.fn()} error="Prijenos nije uspio." />);
    expect(html).toMatch(/role="alert"[^>]*>Prijenos nije uspio\./u);
  });
});
