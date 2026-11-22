// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { fakeTimeMachinePort } from "./fake-port";
import { timeMachineMessages as text } from "./messages.hr";
import VersionHistory from "./VersionHistory";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement | null = null;
afterEach(() => { host?.remove(); host = null; });

async function mount(port = fakeTimeMachinePort()) {
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(VersionHistory, { documentId: "rad-1", port })); });
  return host;
}

describe("Povijest dokumenta (PIL-D7-POVIJEST)", () => {
  it("lists the versions newest first and shows the chosen one's text, read only", async () => {
    const el = await mount();
    const buttons = [...el.querySelectorAll("li button")];
    expect(buttons.map((b) => b.textContent)).toEqual([
      expect.stringContaining("Verzija 3"), expect.stringContaining("Predaja 2"), expect.stringContaining("Verzija 1"),
    ]);
    await act(async () => { (buttons[1] as HTMLButtonElement).click(); });
    const article = el.querySelector("[data-version-text='2']")!;
    expect(article.textContent).toContain("Izmišljeni odlomak verzije 2.");
    expect(article.textContent).toContain(text.historyReadOnly);
    expect(buttons[1]!.getAttribute("aria-pressed")).toBe("true");
    expect(el.querySelectorAll("input, textarea, select, [contenteditable]")).toHaveLength(0);
  });

  it("says so when the work has no saved version", async () => {
    const el = await mount(fakeTimeMachinePort([]));
    expect(el.textContent).toContain(text.historyEmpty);
    expect(el.querySelectorAll("li")).toHaveLength(0);
  });

  it("offers a retry when the versions cannot be read", async () => {
    const port = { ...fakeTimeMachinePort(), versions: async () => ({ kind: "unavailable" as const }) };
    const el = await mount(port);
    expect(el.querySelector("[role=alert]")?.textContent).toBe(text.unavailable);
    expect(el.textContent).toContain(text.retry);
  });
});
