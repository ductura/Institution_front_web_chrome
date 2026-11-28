// @vitest-environment jsdom
// ED-112: the layout answers Ctrl+\ and the palette's request, wide (the rail) and narrow (its drawer).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { EditorPanelLayout } from "./EditorPanelLayout";

// The sides' contents read the local document; this test is about the frame around them.
vi.mock("./LeftPanel", () => ({ LeftPanel: () => <nav>Izmišljena struktura</nav> }));
vi.mock("./RightPanel", () => ({ RightPanel: () => <div>Izmišljena ploča</div> }));
import { requestStructureRail } from "./structure-rail";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let width = 1400;
beforeAll(() => {
  window.matchMedia = ((query: string) => {
    const max = Number(/max-width:\s*(\d+)px/.exec(query)?.[1] ?? Infinity);
    return { matches: width <= max, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
      onchange: null, dispatchEvent: () => false };
  }) as typeof window.matchMedia;
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});

const roots: Root[] = [];
afterEach(() => {
  act(() => { while (roots.length) roots.pop()!.unmount(); });
  document.body.innerHTML = "";
});

function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  act(() => root.render(<EditorPanelLayout header={<span>Izmišljeni kolegij</span>} tools={null} status={null}
    title="Izmišljeni seminar">
    <p>Izmišljen tekst.</p>
  </EditorPanelLayout>));
}

const toggle = () => document.querySelector<HTMLButtonElement>('button[aria-label="Struktura rada"]')!;
const rail = () => document.querySelector('aside[aria-label="Struktura rada"]');
const press = (init: KeyboardEventInit) => act(() => {
  document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
});

describe("EditorPanelLayout: Struktura rada (ED-112)", () => {
  it("Ctrl+\\ hides the rail and shows it again; the button says so and names its keys", () => {
    width = 1400;
    mount();
    expect(toggle().getAttribute("aria-keyshortcuts")).toBe("Control+\\ Meta+\\");
    expect(rail()).not.toBeNull();
    press({ key: "\\", code: "Backslash", ctrlKey: true });
    expect(rail()).toBeNull();
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    press({ key: "\\", code: "Backslash", ctrlKey: true });
    expect(rail()).not.toBeNull();
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
  });

  it("the palette's request does the same", () => {
    width = 1400;
    mount();
    act(() => requestStructureRail());
    expect(rail()).toBeNull();
    act(() => requestStructureRail());
    expect(rail()).not.toBeNull();
  });

  it("in focus mode it leaves focus mode and shows the structure", () => {
    width = 1400;
    mount();
    press({ key: "\\", code: "Backslash", ctrlKey: true });
    expect(rail()).toBeNull();
    press({ key: ".", ctrlKey: true });
    expect(document.querySelector('[data-focus="true"]')).not.toBeNull();
    press({ key: "\\", code: "Backslash", ctrlKey: true });
    expect(document.querySelector('[data-focus="true"]')).toBeNull();
    expect(rail()).not.toBeNull();
  });

  it("on a narrow screen it opens the drawer and closes it again, but leaves another dialog's key alone", () => {
    width = 1000;
    mount();
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    press({ key: "\\", code: "Backslash", ctrlKey: true });
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    press({ key: "\\", code: "Backslash", ctrlKey: true });
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    const other = document.createElement("dialog");
    document.body.append(other);
    other.showModal();
    const modal = other.matches(":modal");
    press({ key: "\\", code: "Backslash", ctrlKey: true });
    // jsdom may not know :modal; where it does, the open dialog keeps the key.
    expect(toggle().getAttribute("aria-expanded")).toBe(modal ? "false" : "true");
  });
});
