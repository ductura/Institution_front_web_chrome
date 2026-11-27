// ED-100: the toolbar's Navod and Novi izvor reach the sources line under the sheet.
import { describe, expect, it, vi } from "vitest";

import { onSourceRequest, requestSourceAction } from "./source-requests";

describe("source requests (ED-100)", () => {
  it("says no one answered while nothing listens", () => {
    expect(requestSourceAction("cite")).toBe(false);
  });

  it("passes Navod and Novi izvor to the listener until it stops listening", () => {
    const heard = vi.fn();
    const stop = onSourceRequest(heard);
    expect(requestSourceAction("cite")).toBe(true);
    expect(requestSourceAction("newSource")).toBe(true);
    expect(heard.mock.calls).toEqual([["cite"], ["newSource"]]);
    stop();
    expect(requestSourceAction("cite")).toBe(false);
    expect(heard).toHaveBeenCalledTimes(2);
  });
});
