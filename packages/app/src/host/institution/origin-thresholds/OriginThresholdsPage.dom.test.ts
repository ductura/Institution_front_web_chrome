// @vitest-environment jsdom
// PIL-P1-PRAGOVI-ADMIN: the page as it runs in the browser (react-dom/client, effects and clicks), over an
// in-memory server whose answers a test can replace. Invented data only.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { PAGES, type Page } from "../../../routes";
import { HostContext } from "../../context";
import type { OriginKind, ThresholdCall } from "./contract";
import { DEMO_THRESHOLDS, fakeThresholdServer } from "./fake-port";
import { thresholdMessages as t } from "./messages.hr";
import OriginThresholdsPage from "./OriginThresholdsPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Answer = Awaited<ReturnType<ThresholdCall>> | "throw" | undefined;
const page = PAGES.find((p) => p.path === "/ustanova/pragovi") as Page;
let root: Root | null = null;
let host: HTMLElement | null = null;

/** The fake server, with an answer a test may force for the next calls of one operation. */
function server() {
  const fake = fakeThresholdServer({ thresholds: DEMO_THRESHOLDS });
  const ids: string[] = [];
  let force: (id: string) => Answer = () => undefined;
  const call: ThresholdCall = async (id, input) => {
    ids.push(id);
    const answer = force(id);
    if (answer === "throw") throw new Error("offline");
    // Every answer is new objects, as one read off the wire (the fake keeps its rows).
    return answer ?? structuredClone(await fake.call(id, input));
  };
  return { call, ids, force: (next: (id: string) => Answer) => { force = next; } };
}

const settle = () => act(async () => { await new Promise((done) => setTimeout(done, 0)); });

async function show(role: "admin" | "teacher" | "student" | null, srv = server()) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(HostContext.Provider, { value: { base: "/app/web", page, role } },
      createElement(OriginThresholdsPage, { call: () => srv.call })));
  });
  await settle();
  return srv;
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null; host = null;
});

const text = () => host!.textContent ?? "";
const cards = () => [...host!.querySelectorAll<HTMLElement>("section[aria-labelledby]")]
  .filter((card) => Object.values(t.kinds).includes(card.querySelector("h3")?.textContent as never));
const card = (origin: OriginKind) => cards().find((c) => c.querySelector("h3")?.textContent === t.kinds[origin])!;
const button = (scope: HTMLElement, name: string) =>
  [...scope.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === name || (!b.hasAttribute("aria-label") && b.textContent === name));

async function click(target: HTMLButtonElement | undefined) {
  expect(target).toBeDefined();
  await act(async () => { target!.click(); });
  await settle();
}

async function fill(origin: OriginKind, percent: string, strictness: string) {
  const input = card(origin).querySelector("input")!;
  const select = card(origin).querySelector("select")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, percent);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, strictness);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
const save = (origin: OriginKind) => click(button(card(origin), t.saveFor(t.kinds[origin])));

describe("PIL-P1-PRAGOVI-ADMIN page in the browser", () => {
  it("shows anyone but the administrator a calm refusal and reads nothing", async () => {
    for (const role of ["teacher", "student", null] as const) {
      const srv = await show(role);
      expect(text()).toContain(t.denied);
      expect(host!.querySelectorAll("button, input, select")).toHaveLength(0);
      expect(srv.ids).toEqual([]);
      act(() => root?.unmount());
      host?.remove();
    }
  });

  it("reads once for the administrator and shows a card for each of the six kinds, without defaults", async () => {
    const srv = await show("admin");
    expect(srv.ids).toEqual(["institution.origin-thresholds.get"]);
    expect(cards().map((c) => c.querySelector("h3")!.textContent)).toEqual(Object.values(t.kinds));
    expect(card("pasted_unknown").textContent).toContain(t.shown(15, "soft"));
    expect(card("assistant_inserted").textContent).toContain(t.shown(10, "hard"));
    expect(card("typed").textContent).toContain(t.none);
    expect(card("typed").querySelector("input")!.value).toBe("");
    // Each button names its kind, so the six "Spremi prag" differ for a screen reader.
    const names = [...host!.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));
    expect(new Set(names).size).toBe(names.length);
  });

  it("an invalid percent shows the field error and sends nothing", async () => {
    const srv = await show("admin");
    for (const typed of ["101", "", "1,5"]) {
      await fill("typed", typed, "hard");
      await save("typed");
      expect(card("typed").textContent).toContain(t.percentInvalid);
      expect(card("typed").querySelector("input")!.getAttribute("aria-invalid")).toBe("true");
    }
    expect(srv.ids).toEqual(["institution.origin-thresholds.get"]);
    expect(text()).not.toContain(t.saved);
  });

  it("a threshold the server saved (200) is said saved and shown after a new read", async () => {
    const srv = await show("admin");
    await fill("typed", "20", "soft");
    await save("typed");
    expect(srv.ids).toEqual(["institution.origin-thresholds.get", "institution.origin-threshold.put", "institution.origin-thresholds.get"]);
    expect(card("typed").textContent).toContain(t.saved);
    expect(card("typed").textContent).toContain(t.shown(20, "soft"));
  });

  it("removing a threshold leaves the kind without one", async () => {
    const srv = await show("admin");
    await click(button(card("pasted_unknown"), t.removeFor(t.kinds.pasted_unknown)));
    expect(srv.ids).toContain("institution.origin-threshold.delete");
    expect(card("pasted_unknown").textContent).toContain(t.removed);
    expect(card("pasted_unknown").textContent).toContain(t.none);
    expect(button(card("pasted_unknown"), t.removeFor(t.kinds.pasted_unknown))).toBeUndefined();
  });

  it("403, 422, 503 and a dropped connection are never said saved; only an unknown outcome offers a new read", async () => {
    const cases = [
      [{ ok: false, status: 403, code: "forbidden" }, t.writeErrors.denied, false],
      [{ ok: false, status: 422, code: "invalid" }, t.writeErrors.invalid, false],
      [{ ok: false, status: 503, code: "unavailable" }, t.writeErrors.unconfirmed, true],
      ["throw", t.writeErrors.unconfirmed, true],
    ] as const;
    for (const [answer, message, reread] of cases) {
      const srv = server();
      srv.force((id) => id === "institution.origin-threshold.put" ? answer : undefined);
      await show("admin", srv);
      await fill("typed", "20", "soft");
      await save("typed");
      expect(card("typed").querySelector("[role=alert]")?.textContent).toBe(message);
      expect(text()).not.toContain(t.saved);
      expect(card("typed").textContent).toContain(t.none);
      expect(button(card("typed"), t.reloadFor(t.kinds.typed)) !== undefined).toBe(reread);
      act(() => root?.unmount());
      host?.remove();
    }
  });

  it("a read that fails offers a retry beside the error, and the retry reads again", async () => {
    const srv = server();
    srv.force((id) => id === "institution.origin-thresholds.get" ? { ok: false, status: 503, code: "unavailable" } : undefined);
    await show("admin", srv);
    expect(host!.querySelector("[role=alert]")?.textContent).toBe(t.readErrors.unavailable);
    expect(cards()).toHaveLength(0);
    srv.force(() => undefined);
    await click(button(host!, t.retry));
    expect(cards()).toHaveLength(6);
    expect(srv.ids).toEqual(["institution.origin-thresholds.get", "institution.origin-thresholds.get"]);
  });

  it("a saved threshold whose new read fails is still said saved, and the page says its view may be old", async () => {
    const srv = await show("admin");
    srv.force((id) => id === "institution.origin-thresholds.get" ? "throw" : undefined);
    await fill("typed", "20", "soft");
    await save("typed");
    expect(card("typed").textContent).toContain(t.saved);
    expect(text()).toContain(t.stale);
    expect(text()).not.toContain(t.readErrors.unavailable);
    expect(cards()).toHaveLength(6);
    srv.force(() => undefined);
    await click(button(host!, t.reload));
    expect(text()).not.toContain(t.stale);
    expect(card("typed").textContent).toContain(t.shown(20, "soft"));
  });

  it("saving one kind keeps what is typed, unsaved, in the other kinds", async () => {
    await show("admin");
    await fill("pasted_unknown", "33", "hard");
    await fill("typed", "20", "soft");
    await save("typed");
    expect(card("typed").textContent).toContain(t.saved);
    expect(card("pasted_unknown").querySelector("input")!.value).toBe("33");
    expect(card("pasted_unknown").querySelector("select")!.value).toBe("hard");
  });
});
