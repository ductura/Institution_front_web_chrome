// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { uiMessagesEn, uiMessagesHr } from "../../i18n/catalogue";
import { SideShell, type SideShellProps } from "./SideShell";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Invented navigation only; the words are the prototype's (Ductura_student.html shell()).
const ITEMS = [
  { href: "/zadaci", label: "Moji zadaci" },
  { href: "/zadaci/kolegiji", label: "Moji kolegiji" },
  { href: "/upis", label: "Upis u kolegij" },
];

let root: Root | null = null;
let host: HTMLDivElement;
let wide = false;
const listeners = new Set<() => void>();

beforeEach(() => {
  wide = false;
  window.matchMedia = vi.fn(() => ({
    get matches() { return wide; },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  listeners.clear();
});

function mount(props: Partial<SideShellProps> = {}) {
  host = document.createElement("div");
  document.body.append(host);
  // jsdom does not navigate; the shell's own click handling still runs.
  host.addEventListener("click", (event) => event.preventDefault());
  root = createRoot(host);
  act(() => root!.render(
    <SideShell role="student" name="Ductura" homeHref="/zadaci" homeLabel={uiMessagesHr.sideShell.home.student}
      sideLabel="Bočna navigacija" navLabel="Radni prostor" items={ITEMS} current="/zadaci"
      menuLabel={uiMessagesHr.sideShell.menu} themeLabel="Promijeni svijetlu ili tamnu temu"
      links={[{ href: "/kako-radi", label: "Kako Ductura radi" }]}
      account={<button type="button">Odjava</button>} {...props}>
      <h1>Vaš studentski prostor</h1>
    </SideShell>,
  ));
  const side = host.querySelector("aside")!;
  const menu = [...host.querySelectorAll("button")].find((b) => b.textContent === "Izbornik")!;
  return { side, menu };
}

describe("SideShell (the prototypes' shell, VIZ-0)", () => {
  it("has the prototype's parts: the D mark home, the navigation with the current page, the foot and the main", () => {
    const { side } = mount();
    const brand = side.querySelector("a")!;
    expect(brand.getAttribute("aria-label")).toBe("Ductura, studentska početna");
    expect(brand.getAttribute("href")).toBe("/zadaci");
    expect(brand.textContent).toBe("DDuctura");
    const nav = side.querySelector("nav")!;
    expect(nav.getAttribute("aria-label")).toBe("Radni prostor");
    expect([...nav.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["Moji zadaci", "Moji kolegiji", "Upis u kolegij"]);
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe("Moji zadaci");
    expect(side.querySelector('button[aria-label="Promijeni svijetlu ili tamnu temu"]')?.textContent).toBe("◐");
    expect(host.querySelector("main#sadrzaj")?.getAttribute("tabindex")).toBe("-1");
    expect(host.querySelector("[data-shell-role]")?.getAttribute("data-shell-role")).toBe("student");
  });

  it("shows the institution's name in the foot when there is one", () => {
    mount({ context: "Izmišljeni fakultet" });
    expect(host.querySelector("aside p")?.textContent).toBe("Izmišljeni fakultet");
  });

  it("marks the teacher's frame, which the tokens widen (prototype.css)", () => {
    mount({ role: "teacher" });
    expect(host.querySelector("[data-shell-role]")?.getAttribute("data-shell-role")).toBe("teacher");
  });

  it("Izbornik opens the side bar in place; Esc closes it and gives focus back", () => {
    const { side, menu } = mount();
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(menu.getAttribute("aria-controls")).toBe(side.id);
    act(() => menu.click());
    expect(side.dataset.open).toBe("true");
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(side.dataset.open).toBe("false");
    expect(document.activeElement).toBe(menu);
  });

  it("following a link closes it, and so does a window that grows to 800 px", () => {
    const { side, menu } = mount();
    act(() => menu.click());
    act(() => side.querySelectorAll("nav a")[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
    expect(side.dataset.open).toBe("false");
    act(() => menu.click());
    wide = true;
    act(() => listeners.forEach((fn) => fn()));
    expect(side.dataset.open).toBe("false");
  });

  it("the theme button flips the theme on <html>", () => {
    const { side } = mount();
    document.documentElement.setAttribute("data-theme", "dark");
    act(() => side.querySelector<HTMLButtonElement>('button[aria-label^="Promijeni"]')!.click());
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("in the catalogue the frame is a div, so there is never a second main", () => {
    mount({ frame: "div" });
    expect(host.querySelector("main")).toBeNull();
  });

  it("has no axe findings", async () => {
    mount();
    const result = await axe.run(host, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });

  it("has its words in both catalogues", () => {
    expect(uiMessagesEn.sideShell.menu).toBe("Menu");
    expect(Object.keys(uiMessagesEn.sideShell.home)).toEqual(Object.keys(uiMessagesHr.sideShell.home));
  });
});
