// @vitest-environment jsdom
// PIL-P1-PRAGOVI-ADMIN: the page as the administrator uses it, rendered with effects (react-dom/client + act).
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { PAGES, type Page } from "../../../routes";
import type { ShellRole } from "../../../../../../src/components/index.ts";
import { HostContext } from "../../context";
import type { ThresholdCall, ThresholdOperation } from "./contract";
import { DEMO_THRESHOLDS, fakeThresholdServer } from "./fake-port";
import { thresholdMessages as t } from "./messages.hr";
import OriginThresholdsPage from "./OriginThresholdsPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PAGE = PAGES.find((p) => p.path === "/ustanova/pragovi") as Page;
type Fail = number | "throw";

let root: Root | null = null;
let host: HTMLElement | null = null;

/** The in-memory server, with a failure that can be set per operation between clicks. */
function server() {
  const fake = fakeThresholdServer({ thresholds: DEMO_THRESHOLDS });
  const fail: Partial<Record<ThresholdOperation, Fail>> = {};
  const call: ThresholdCall = async (id, input) => {
    const planned = fail[id];
    if (planned === undefined) return fake.call(id, input);
    fake.calls.push({ id, params: input.params, body: input.body });
    if (planned === "throw") throw new Error("offline");
    return { ok: false, status: planned, code: "error" };
  };
  return { call, calls: fake.calls, fail };
}

async function show(role: ShellRole | null, call: ThresholdCall) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(HostContext.Provider, { value: { base: "/app/web", page: PAGE, role } }, createElement(OriginThresholdsPage, { call: () => call })));
  });
}

const cards = () => [...host!.querySelectorAll("section[aria-labelledby]")].filter((s) => s.querySelector("h3") !== null && s.querySelector("input") !== null);
const card = (title: string) => cards().find((s) => s.querySelector("h3")?.textContent === title)!;
const text = (el: Element = host!) => el.textContent ?? "";
const buttonIn = (el: Element, label: string) => [...el.querySelectorAll("button")].find((b) => b.textContent === label);

async function click(button: HTMLButtonElement | undefined) {
  if (button === undefined) throw new Error("no button");
  await act(async () => { button.click(); });
}
async function fill(el: Element, percent: string, strictness: string) {
  const input = el.querySelector("input")!;
  const select = el.querySelector("select")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, percent);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, strictness);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("PIL-P1-PRAGOVI-ADMIN page", () => {
  it("shows the administrator six kinds, each with its threshold or none", async () => {
    const s = server();
    await show("admin", s.call);
    expect(s.calls.map((c) => c.id)).toEqual(["institution.origin-thresholds.get"]);
    expect(cards().map((c) => c.querySelector("h3")?.textContent)).toEqual(Object.values(t.kinds));
    expect(text(card(t.kinds.pasted_unknown))).toContain(t.shown(15, "soft"));
    expect(text(card(t.kinds.assistant_inserted))).toContain(t.shown(10, "hard"));
    expect(text(card(t.kinds.typed))).toContain(t.none);
    expect(buttonIn(card(t.kinds.typed), t.remove)).toBeUndefined();
    expect(buttonIn(card(t.kinds.typed), t.save)?.getAttribute("aria-label")).toBe(`${t.save}: ${t.kinds.typed}`);
  });

  it("gives anyone else a calm refusal and reads nothing", async () => {
    for (const role of ["teacher", "student", null] as const) {
      const s = server();
      await show(role, s.call);
      expect(text()).toContain(t.errors.denied);
      expect(cards()).toEqual([]);
      expect(s.calls).toEqual([]);
      act(() => root?.unmount());
      host?.remove();
    }
  });

  it("an invalid percent shows a field error and sends nothing", async () => {
    const s = server();
    await show("admin", s.call);
    await fill(card(t.kinds.typed), "abc", "hard");
    await click(buttonIn(card(t.kinds.typed), t.save));
    expect(text(card(t.kinds.typed))).toContain(t.percentInvalid);
    expect(text()).not.toContain(t.saved);
    expect(s.calls.map((c) => c.id)).toEqual(["institution.origin-thresholds.get"]);
  });

  it("saves a threshold, says so only after 200, and keeps what is typed in the other cards", async () => {
    const s = server();
    await show("admin", s.call);
    await fill(card(t.kinds.pasted_unknown), "40", "hard");
    await fill(card(t.kinds.typed), "20", "hard");
    await click(buttonIn(card(t.kinds.typed), t.save));
    expect(s.calls.at(-2)).toEqual({ id: "institution.origin-threshold.put", params: { origin: "typed" }, body: { thresholdPercent: 20, strictness: "hard" } });
    expect(s.calls.at(-1)?.id).toBe("institution.origin-thresholds.get");
    expect(text(card(t.kinds.typed))).toContain(t.saved);
    expect(text(card(t.kinds.typed))).toContain(t.shown(20, "hard"));
    expect(card(t.kinds.pasted_unknown).querySelector("input")!.value).toBe("40");
  });

  it("removing a threshold shows the kind without one", async () => {
    const s = server();
    await show("admin", s.call);
    await click(buttonIn(card(t.kinds.pasted_unknown), t.remove));
    expect(s.calls.at(-2)).toEqual({ id: "institution.origin-threshold.delete", params: { origin: "pasted_unknown" }, body: undefined });
    expect(text(card(t.kinds.pasted_unknown))).toContain(t.none);
    expect(text(card(t.kinds.pasted_unknown))).toContain(t.removed);
  });

  it("403, 422, 503 and a dropped connection never say saved; an unconfirmed change offers a reload", async () => {
    const cases: [Fail, string, boolean][] = [
      [403, t.errors.denied, false], [422, t.errors.invalid, false], [503, t.errors.unconfirmed, true], ["throw", t.errors.unconfirmed, true],
    ];
    for (const [fail, message, reload] of cases) {
      const s = server();
      s.fail["institution.origin-threshold.put"] = fail;
      await show("admin", s.call);
      await fill(card(t.kinds.typed), "20", "soft");
      await click(buttonIn(card(t.kinds.typed), t.save));
      expect(text(card(t.kinds.typed))).toContain(message);
      expect(text()).not.toContain(t.saved);
      expect(buttonIn(card(t.kinds.typed), t.reload) !== undefined).toBe(reload);
      if (reload) {
        await click(buttonIn(card(t.kinds.typed), t.reload));
        expect(s.calls.at(-1)?.id).toBe("institution.origin-thresholds.get");
      }
      act(() => root?.unmount());
      host?.remove();
    }
  });

  it("a failed read offers to try again, and the retry reads the list", async () => {
    const s = server();
    s.fail["institution.origin-thresholds.get"] = 503;
    await show("admin", s.call);
    expect(text()).toContain(t.errors.unavailable);
    expect(cards()).toEqual([]);
    delete s.fail["institution.origin-thresholds.get"];
    await click(buttonIn(host!, t.retry));
    expect(cards()).toHaveLength(6);
  });

  it("a confirmed change whose re-read fails keeps the cards and asks for a reload, never claiming nothing changed", async () => {
    const s = server();
    await show("admin", s.call);
    s.fail["institution.origin-thresholds.get"] = 503;
    await fill(card(t.kinds.typed), "20", "soft");
    await click(buttonIn(card(t.kinds.typed), t.save));
    expect(text(card(t.kinds.typed))).toContain(t.saved);
    expect(text()).toContain(t.errors.staleAfterSave);
    expect(text()).not.toContain(t.errors.unavailable);
    expect(cards()).toHaveLength(6);
    delete s.fail["institution.origin-thresholds.get"];
    await click(buttonIn(host!, t.reload));
    expect(text(card(t.kinds.typed))).toContain(t.shown(20, "soft"));
    expect(text()).not.toContain(t.errors.staleAfterSave);
  });
});
