// @vitest-environment jsdom
// INT-31: "Započni rad" on the work page itself reads the work again there; on
// the card it goes to the editor. The router and the host are stubbed; the
// start route is a test double. Invented ids only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../../context", () => ({ useHost: () => ({ base: "/app/web" }) }));
const { StartWork } = await import("./StartWork");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ASSIGNMENT = "20000000-0000-4000-8000-0000000000a1";
const started = () => async () => ({ ok: true, status: 200, body: { workId: "w-1", rulesVersion: null, language: "hr" } });

describe("StartWork after the server opened the work", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; push.mockClear(); });

  const click = async () => {
    await act(async () => { host.querySelector("button")!.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  };

  it("goes to the editor from the card", async () => {
    await act(async () => { root?.render(h(StartWork, { assignmentId: ASSIGNMENT, title: "Izmišljeni rad", call: started as never })); });
    await click();
    expect(push).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`/rad/${ASSIGNMENT}$`)));
  });

  it("on the work page reads the work again in place of going to the address already open", async () => {
    const onOpened = vi.fn();
    await act(async () => { root?.render(h(StartWork, { assignmentId: ASSIGNMENT, title: "Izmišljeni rad", call: started as never, onOpened })); });
    await click();
    expect(onOpened).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Jezik rada: hrvatski");
  });
});
