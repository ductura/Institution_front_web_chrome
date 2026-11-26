// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { PanelTabs } from "@ductura/ui";

import { OPEN_PANEL_EVENT, requestedPanel, requestPanel } from "./open-panel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement | null = null;
afterEach(() => { host?.remove(); host = null; });

describe("ED-45 (P2-17): a part of the editor opens a group of the right panel", () => {
  it("asks for a known group only", () => {
    const seen: (string | null)[] = [];
    const target = new EventTarget();
    target.addEventListener(OPEN_PANEL_EVENT, (event) => seen.push(requestedPanel(event)));
    requestPanel("sources", target);
    requestPanel("comments", target);
    target.dispatchEvent(new CustomEvent(OPEN_PANEL_EVENT, { detail: "nepoznato" }));
    expect(seen).toEqual(["sources", "comments", null]);
  });

  it("the tabs open the asked tab, keep the person's clicks and keep every panel mounted", async () => {
    let ask: (id: string) => void = () => {};
    function Page() {
      const [selected, setSelected] = useState("sources");
      ask = setSelected;
      return createElement(PanelTabs, { label: "Kartice", selected, onChange: setSelected, tabs: [
        { id: "sources", label: "Literatura", content: "izvori" },
        { id: "comments", label: "Komentari", content: "komentari" },
      ] });
    }
    host = document.createElement("div");
    document.body.append(host);
    await act(async () => { createRoot(host!).render(createElement(Page)); });
    const open = () => host!.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
    expect(open()).toBe("Literatura");
    await act(async () => { (host!.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement).click(); });
    expect(open()).toBe("Komentari");
    await act(async () => { ask("sources"); });
    expect(open()).toBe("Literatura");
    expect(host.querySelectorAll('[role="tabpanel"]')).toHaveLength(2);
  });
});
