// @vitest-environment jsdom
import axe from "axe-core";
import { act, createRef, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ObjectToolbar, type ObjectToolbarAction } from "./ObjectToolbar";
import { toolbarIndex } from "./toolbar-logic";
import { PreviewDialog } from "../preview-dialog/PreviewDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no modal <dialog>: a minimal stand-in so the shared Dialog runs as in a browser.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

let root: Root | null = null;
let host: HTMLElement | null = null;
const mount = (node: React.ReactNode) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
};
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const key = (target: Element, k: string) => act(() => { target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); });
const violations = async (el: Element) => (await axe.run(el, { rules: { region: { enabled: false }, "color-contrast": { enabled: false } } })).violations.map((v) => v.id);

const actions = (spy = vi.fn()): ObjectToolbarAction[] => [
  { id: "preview", label: "Pregled", onSelect: spy },
  { id: "remove", label: "Ukloni", onSelect: () => undefined },
  { id: "edit", label: "Uredi", onSelect: () => undefined, pressed: false },
];

describe("toolbarIndex (UI-10A)", () => {
  it("wraps with the arrows and jumps with Home and End", () => {
    expect(toolbarIndex(2, 3, "ArrowRight")).toBe(0);
    expect(toolbarIndex(0, 3, "ArrowLeft")).toBe(2);
    expect(toolbarIndex(1, 3, "Home")).toBe(0);
    expect(toolbarIndex(1, 3, "End")).toBe(2);
    expect(toolbarIndex(1, 3, "a")).toBeNull();
    expect(toolbarIndex(0, 0, "Home")).toBeNull();
  });
});

describe("ObjectToolbar", () => {
  it("is a named toolbar with a single tab stop and no axe violations", async () => {
    const anchor = createRef<HTMLElement>();
    const el = mount(<ObjectToolbar open floating={false} anchor={anchor} actions={actions()} onClose={() => undefined} />);
    const bar = el.querySelector('[role="toolbar"]')!;
    expect(bar.getAttribute("aria-label")).toBe("Radnje nad objektom");
    expect([...bar.querySelectorAll("button")].map((b) => b.tabIndex)).toEqual([0, -1, -1]);
    expect(await violations(el)).toEqual([]);
  });

  it("moves between buttons with the arrows and calls onSelect", () => {
    const spy = vi.fn();
    const el = mount(<ObjectToolbar open floating={false} anchor={createRef()} actions={actions(spy)} onClose={() => undefined} />);
    const buttons = el.querySelectorAll("button");
    buttons[0]!.focus();
    key(el.querySelector('[role="toolbar"]')!, "ArrowRight");
    expect(document.activeElement).toBe(buttons[1]);
    key(el.querySelector('[role="toolbar"]')!, "End");
    expect(document.activeElement).toBe(buttons[2]);
    act(() => buttons[0]!.click());
    expect(spy).toHaveBeenCalledOnce();
  });

  it("Escape closes it and gives the focus back to the object", () => {
    const object = document.createElement("table");
    object.tabIndex = 0;
    document.body.append(object);
    const anchor = { current: object } as RefObject<HTMLElement>;
    const onClose = vi.fn();
    mount(<ObjectToolbar open floating={false} anchor={anchor} actions={actions()} onClose={onClose} />);
    key(document.body, "Escape");
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(object);
    object.remove();
  });

  it("keeps one tab stop when the actions shrink", () => {
    const anchor = createRef<HTMLElement>();
    const el = mount(<ObjectToolbar open floating={false} anchor={anchor} actions={actions()} onClose={() => undefined} />);
    act(() => el.querySelectorAll("button")[2]!.focus());
    act(() => root!.render(<ObjectToolbar open floating={false} anchor={anchor} actions={actions().slice(0, 2)} onClose={() => undefined} />));
    expect([...el.querySelectorAll("button")].map((b) => b.tabIndex)).toEqual([-1, 0]);
  });

  it("leaves Escape inside an open modal to that modal", () => {
    const onClose = vi.fn();
    mount(<ObjectToolbar open floating={false} anchor={createRef()} actions={actions()} onClose={onClose} />);
    const modal = document.createElement("dialog");
    modal.setAttribute("open", "");
    document.body.append(modal);
    key(modal, "Escape");
    modal.remove();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders nothing while closed", () => {
    const el = mount(<ObjectToolbar open={false} anchor={createRef()} actions={actions()} onClose={() => undefined} />);
    expect(el.innerHTML).toBe("");
  });
});

describe("PreviewDialog", () => {
  it("focuses Zatvori, is labelled by its title, has no axe violations and closes", async () => {
    const onClose = vi.fn();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    mount(<PreviewDialog open kind="image" caption="Izmišljeni primjer" onClose={onClose}><img src="data:," alt="Dijagram kompostiranja" /></PreviewDialog>);
    const dialog = document.querySelector("dialog")!;
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)!.textContent).toBe("Pregled slike");
    expect(document.activeElement?.textContent).toBe("Zatvori");
    expect(await violations(dialog)).toEqual([]);
    act(() => { dialog.dispatchEvent(new Event("cancel", { bubbles: false, cancelable: true })); });
    expect(onClose).toHaveBeenCalledOnce();
    act(() => root!.render(<PreviewDialog open={false} kind="image" onClose={onClose}>x</PreviewDialog>));
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("names a table preview", () => {
    mount(<PreviewDialog open kind="table" onClose={() => undefined}><table><caption>Tablica</caption><tbody><tr><td>1</td></tr></tbody></table></PreviewDialog>);
    expect(document.querySelector("h2")!.textContent).toBe("Pregled tablice");
  });
});
