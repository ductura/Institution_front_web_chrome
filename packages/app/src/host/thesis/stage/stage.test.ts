// @vitest-environment jsdom
// WEB-V16-OBRANA: the rules of the form, the read/write over the contract, and the section as a user meets it.
// Invented data only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkStage, formatDefense, stepsOf } from "./model";
import { readStage, writeStage } from "./read";
import { readSection, StageSection } from "./section";
import { registeredSections } from "../sections";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const stage = (s: string, defenseAt: string | null = null) =>
  ({ stage: s, defenseAt, changedBy: null, changedAt: "2026-12-01T09:00:00.000Z", changedByPart: "mentor" });
const ok = (body: unknown): Answer => ({ ok: true, status: 200, body });
const DOC = "izmisljeni-dokument-1";

describe("checkStage", () => {
  it("sends no defenseAt for any stage but defense_scheduled, even when the field holds a date", () => {
    for (const s of ["none", "submitted_to_office", "defended"] as const) {
      expect(checkStage(s, "2026-12-14T10:30")).toEqual({ ok: true, body: { stage: s } });
    }
  });
  it("requires the date for defense_scheduled and refuses a date that does not exist", () => {
    expect(checkStage("defense_scheduled", "")).toEqual({ ok: false, problem: "dateRequired" });
    expect(checkStage("defense_scheduled", "2026-02-30T10:30")).toEqual({ ok: false, problem: "dateInvalid" });
    expect(checkStage("defense_scheduled", "sutra")).toEqual({ ok: false, problem: "dateInvalid" });
  });
  it("turns a Zagreb minute into the instant the contract wants (winter +01:00)", () => {
    expect(checkStage("defense_scheduled", "2026-12-14T10:30")).toEqual({ ok: true, body: { stage: "defense_scheduled", defenseAt: "2026-12-14T09:30:00.000Z" } });
  });
});

describe("display", () => {
  it("shows the defense date in Zagreb time and nothing for none", () => {
    expect(formatDefense("2026-12-14T09:30:00.000Z")).toBe("14. prosinca 2026. u 10:30");
    expect(formatDefense(null)).toBeNull();
  });
  it("marks the steps by the stage", () => {
    expect(stepsOf("none").map((s) => s.state)).toEqual(["pending", "pending", "pending"]);
    expect(stepsOf("defense_scheduled").map((s) => s.state)).toEqual(["done", "current", "pending"]);
    expect(stepsOf("defended").map((s) => s.state)).toEqual(["done", "done", "done"]);
  });
});

describe("readStage / writeStage", () => {
  it("reads the work by its id", async () => {
    const call = vi.fn(async () => ok(stage("submitted_to_office")));
    expect(await readStage(call as never, DOC)).toMatchObject({ kind: "ok", view: { stage: "submitted_to_office" } });
    expect(call).toHaveBeenCalledWith("work.thesis-stage.get", { params: { documentId: DOC }, query: undefined, body: undefined });
  });
  it("keeps not found, signed out and unavailable apart; 503 is never 'nema podataka'", async () => {
    const api = (a: Answer) => vi.fn(async () => a) as never;
    expect(await readStage(api(fail(404, "not_found")), DOC)).toEqual({ kind: "notFound" });
    expect(await readStage(api(fail(401, "unauthorized")), DOC)).toEqual({ kind: "signedOut" });
    expect(await readStage(api(fail(503, "unavailable")), DOC)).toEqual({ kind: "unavailable" });
    expect(await readStage(vi.fn(async () => { throw new TypeError("network"); }) as never, DOC)).toEqual({ kind: "unavailable" });
  });
  it("write: done only on 200; the rest is told apart", async () => {
    const api = (a: Answer) => vi.fn(async () => a) as never;
    const body = { stage: "defended" as const };
    expect(await writeStage(api(ok(stage("defended"))), DOC, body)).toMatchObject({ kind: "done" });
    expect(await writeStage(api(fail(403, "forbidden")), DOC, body)).toEqual({ kind: "forbidden" });
    expect(await writeStage(api(fail(404, "not_found")), DOC, body)).toEqual({ kind: "notFound" });
    expect(await writeStage(api(fail(422, "invalid_input")), DOC, body)).toEqual({ kind: "invalid" });
    expect(await writeStage(api(fail(503, "unavailable")), DOC, body)).toEqual({ kind: "unknown" });
  });
  it("readSection: 404 hides the section, 503 is unavailable", async () => {
    expect(await readSection(DOC, vi.fn(async () => fail(404, "not_found")) as never)).toEqual({ kind: "notFound" });
    expect(await readSection(DOC, vi.fn(async () => fail(503, "unavailable")) as never)).toEqual({ kind: "unavailable" });
    expect(await readSection(DOC, vi.fn(async () => ok(stage("none"))) as never)).toMatchObject({ kind: "ready" });
  });
});

let root: Root | null = null;
async function mount(node: ReturnType<typeof h>): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(node); });
  return host;
}
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });

const view = (s: ReturnType<typeof stage>, role: "student" | "mentor", call: () => unknown, reload = () => {}) =>
  mount(h(StageSection, { documentId: DOC, role, value: s as never, reload, call: call as never }));
const change = (el: Element, value: string) => act(async () => {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
});

describe("the section", () => {
  it("is registered in the panel", () => {
    expect(registeredSections.map((s) => s.id)).toContain("stage");
  });
  it("student: sees the stage and the date, has no form and no control", async () => {
    const host = await view(stage("defense_scheduled", "2026-12-14T09:30:00.000Z"), "student", () => vi.fn());
    expect(host.textContent).toContain("14. prosinca 2026. u 10:30");
    expect(host.querySelector("form, select, input, button")).toBeNull();
  });
  it("mentor: the date field appears only for defense_scheduled and the write omits defenseAt for another stage", async () => {
    const call = vi.fn(async (_op: string, input: { body: unknown }) => ok(stage((input.body as { stage: string }).stage)));
    const host = await view(stage("none"), "mentor", () => call);
    expect(host.querySelector('input[name="defenseAt"]')).toBeNull();
    await change(host.querySelector("select")!, "defended");
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(call).toHaveBeenCalledWith("work.thesis-stage.put", { params: { documentId: DOC }, query: undefined, body: { stage: "defended" } });
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Spremljeno na poslužitelju.");
  });
  it("mentor: defense_scheduled without a date sends nothing and says why", async () => {
    const call = vi.fn();
    const host = await view(stage("submitted_to_office"), "mentor", () => call);
    await change(host.querySelector("select")!, "defense_scheduled");
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(call).not.toHaveBeenCalled();
    expect(host.textContent).toContain("unesite datum i vrijeme obrane");
  });
  it("mentor: a correction of the date is the same stage sent again; an unknown outcome keeps the notice and the edited date, reading in place", async () => {
    const call = vi.fn(async (op: string) => op === "work.thesis-stage.put" ? fail(503, "unavailable") : ok(stage("defense_scheduled", "2026-12-14T09:30:00.000Z")));
    const reload = vi.fn();
    const host = await view(stage("defense_scheduled", "2026-12-14T09:30:00.000Z"), "mentor", () => call, reload);
    await change(host.querySelector('input[name="defenseAt"]')!, "2026-12-15T11:00");
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(call).toHaveBeenCalledWith("work.thesis-stage.put", { params: { documentId: DOC }, query: undefined,
      body: { stage: "defense_scheduled", defenseAt: "2026-12-15T10:00:00.000Z" } });
    expect(call).toHaveBeenCalledWith("work.thesis-stage.get", { params: { documentId: DOC }, query: undefined, body: undefined });
    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Nije poznato");
    expect((host.querySelector('input[name="defenseAt"]') as HTMLInputElement).value).toBe("2026-12-15T11:00");
    expect(reload).not.toHaveBeenCalled();
  });
});
