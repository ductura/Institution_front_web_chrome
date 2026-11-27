// @vitest-environment jsdom
// INT-31: "Započni rad" on the work page itself reads the work again there; on
// the card it goes to the editor. The router and the host are stubbed; the
// start route is a test double. Invented ids only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../../context", () => ({ useHost: () => ({ base: "/aplikacija" }) }));
const { StartWork } = await import("./StartWork");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ASSIGNMENT = "20000000-0000-4000-8000-0000000000a1";
const none = async () => ({ kind: "none" as const });
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
    await act(async () => { root?.render(h(StartWork, { assignmentId: ASSIGNMENT, title: "Izmišljeni rad", call: started as never, template: none })); });
    await click();
    expect(push).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`/rad/${ASSIGNMENT}$`)));
  });

  it("on the work page reads the work again in place of going to the address already open", async () => {
    const onOpened = vi.fn();
    await act(async () => { root?.render(h(StartWork, { assignmentId: ASSIGNMENT, title: "Izmišljeni rad", call: started as never, onOpened, template: none })); });
    await click();
    expect(onOpened).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Jezik rada: hrvatski");
  });

  const mount = async (template: never) => {
    await act(async () => { root?.render(h(StartWork, { assignmentId: ASSIGNMENT, title: "Izmišljeni rad", call: started as never, template })); });
  };

  it("shows the skeleton before the student starts, and the start does not wait for it", async () => {
    const ready = async () => ({ kind: "ready" as const, template: { version: 2, titlePage: ["author"] as const, sections: [{ title: "Uvod", hint: "" }], citationStyle: "fpzg" as const } });
    await mount(ready as never);
    expect(host.textContent).toContain("Predložak fakulteta (verzija 2). Odjeljaka: 1.");
    expect(host.textContent).toContain("Autor:");
    expect(host.textContent).toContain("Uvod");
    // The empty hint of "Uvod" draws no line: the title-page label and the heading only.
    expect([...host.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Autor: ", "Uvod"]);
    expect(host.querySelector("button")!.hasAttribute("disabled")).toBe(false);
  });

  it("opens the editor even while the template read never answers", async () => {
    await mount((() => new Promise(() => {})) as never);
    await click();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["throws", async () => { throw new Error("x"); }, "nije dostupan"],
    ["unavailable", async () => ({ kind: "unavailable" as const }), "nije dostupan"],
    ["signedOut", async () => ({ kind: "signedOut" as const }), "Sesija je istekla"],
  ])("says so, not nothing, when the template read %s", async (_n, template, said) => {
    await mount(template as never);
    expect(host.textContent).toContain(said);
  });

  it("says nothing about a template when there is none", async () => {
    await mount(none as never);
    expect(host.textContent).not.toContain("Predložak");
  });
});
