// @vitest-environment jsdom
// ED-38: the alert row of "Uz tekst" (prototype prune.js `RP.ctxAlerts`).
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { reportAlert, useContextAlerts } from "./context-alerts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("context alerts", () => {
  it("keeps one alert per key in first-report order, replaces it and takes it back", () => {
    const renders: string[] = [];
    const Probe = () => { renders.push(useContextAlerts().map((a) => `${a.key}=${a.group}:${a.text}`).join("|")); return null; };
    const root = createRoot(document.createElement("div"));
    act(() => root.render(h(Probe)));
    act(() => { reportAlert("a", { group: "assistant", text: "1" }); reportAlert("b", { group: "comments", text: "2" }); });
    expect(renders.at(-1)).toBe("a=assistant:1|b=comments:2");
    act(() => reportAlert("a", { group: "assistant", text: "3" }));
    expect(renders.at(-1)).toBe("a=assistant:3|b=comments:2");
    const count = renders.length;
    act(() => reportAlert("a", { group: "assistant", text: "3" }));
    expect(renders.length).toBe(count);
    act(() => { reportAlert("a", null); reportAlert("b", null); reportAlert("missing", null); });
    expect(renders.at(-1)).toBe("");
    act(() => root.unmount());
  });
});
