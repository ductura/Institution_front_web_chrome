// @vitest-environment jsdom
// WEB-V14-SHEET-SUBMIT: the sheet block in jsdom with a recorded read. Invented counts only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SheetWorkRead } from "./read.ts";
import SheetSummary from "./SheetSummary.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SheetSummary", () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ""; });
  const mount = async (read: () => Promise<SheetWorkRead>, onSignIn = vi.fn()) => {
    await act(async () => { root.render(h(SheetSummary, { assignmentId: "a-1", read, onSignIn })); });
    return onSignIn;
  };

  it("shows the kind and counts of a spreadsheet work, without a mark", async () => {
    await mount(async () => ({ kind: "sheet", revision: 2, summary: { sheets: 2, filledCells: 5, formulas: 1 } }));
    expect(host.textContent).toContain("Vrsta rada: tablica");
    expect(host.textContent).toContain("2 lista, 5 ispunjenih ćelija, 1 formula");
  });
  it("shows nothing for a text or slides work", async () => {
    await mount(async () => ({ kind: "other" }));
    expect(host.textContent).toBe("");
  });
  it("a failed read says so and can be repeated; it is never shown as an empty sheet", async () => {
    const read = vi.fn<() => Promise<SheetWorkRead>>().mockResolvedValueOnce({ kind: "unavailable" }).mockResolvedValue({ kind: "empty" });
    await mount(read);
    expect(host.querySelector("[role=alert]")?.textContent).toContain("nije dostupan");
    expect(host.textContent).not.toContain("prazna");
    await act(async () => { host.querySelector("button")!.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(read).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("prazna");
  });
  it("asks for sign-in on 401", async () => {
    const onSignIn = await mount(async () => ({ kind: "signIn" }));
    expect(onSignIn).toHaveBeenCalled();
    expect(host.textContent).toBe("");
  });
});
