// @vitest-environment jsdom
// WEB-V16-TEMA-STUDENT: the student's topic as the student meets it. Invented data only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { registeredSections } from "../sections";
import { canPropose, draftProblem, proposeTopic } from "./actions";
import { topicStudentHr } from "./messages.hr";
import { parseTopic, readTopic, type Call, type Topic } from "./read";
import { section, TopicStudentView } from "./section";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const v = (version = 1, title = "Izmišljena tema", summary = "Izmišljeni opis") => ({ version, title, summary, proposedAt: "2026-11-01T10:00:00.000Z" });
const topic = (state: Topic["state"] = "none", extra: Partial<Topic> = {}): Topic =>
  state === "none" ? { state, current: null, decision: null, history: [], ...extra }
    : { state, current: v(), decision: null, history: [v()], ...extra };
const returned = (): Topic => topic("returned", { decision: { version: 1, decision: "returned", comment: "Suzite temu.", decidedAt: "2026-11-02T10:00:00.000Z" } });
const ok = (body: unknown) => ({ ok: true, status: 200, body, headers: {} });
const fail = (status: number) => ({ ok: false, status, code: "x" });
const fake = (fn: (id: string, input: { body?: unknown }) => unknown) => vi.fn(async (id: string, input: { body?: unknown }) => fn(id, input)) as unknown as Call & ReturnType<typeof vi.fn>;
const puts = (c: ReturnType<typeof vi.fn>) => c.mock.calls.filter((x) => x[0] === "work.thesis-topic.put");

describe("read", () => {
  it("404 is notFound, other failures and a wrong shape are unavailable, never 'no topic'", async () => {
    expect(await readTopic(fake(() => fail(404)), "d1")).toEqual({ kind: "notFound" });
    expect(await readTopic(fake(() => fail(503)), "d1")).toEqual({ kind: "unavailable" });
    expect(await readTopic(fake(() => ok({ state: "x", current: null, decision: null, history: [] })), "d1")).toEqual({ kind: "unavailable" });
    expect(await readTopic(fake(() => ok({ state: "proposed", current: null, decision: null, history: [] })), "d1")).toEqual({ kind: "unavailable" });
    expect((await readTopic(fake(() => ok(topic())), "d1")).kind).toBe("ready");
  });
  it("parser keeps the history and the decision", () => {
    expect(parseTopic(returned())?.decision?.comment).toBe("Suzite temu.");
    expect(parseTopic({ ...topic("proposed"), history: [{ version: "1" }] })).toBeNull();
  });
  it("the section is hidden from the mentor and sends no request", async () => {
    expect(await section.read("d1", "mentor")).toEqual({ kind: "notFound" });
  });
  it("is registered in the panel", () => {
    expect(registeredSections.map((s) => s.id)).toContain("topic-student");
  });
});

describe("rules", () => {
  it("empty, blank and too long titles and a too long summary are refused; code points are counted", () => {
    expect(draftProblem("", "")).toBe("titleEmpty");
    expect(draftProblem("   ", "")).toBe("titleEmpty");
    expect(draftProblem("a".repeat(201), "")).toBe("titleTooLong");
    expect(draftProblem("a".repeat(200), "")).toBeNull();
    expect(draftProblem("x", "b".repeat(1001))).toBe("summaryTooLong");
    expect(draftProblem("x", "b".repeat(1000))).toBeNull();
    expect(draftProblem("😀".repeat(200), "")).toBeNull();
  });
  it("a bad draft sends nothing; an approved topic sends nothing; a mentor sends nothing", async () => {
    const call = fake(() => ok(topic("proposed")));
    expect(await proposeTopic(call, "d1", "student", topic(), "", "")).toEqual({ outcome: "invalid" });
    expect(await proposeTopic(call, "d1", "student", topic(), "a".repeat(201), "")).toEqual({ outcome: "invalid" });
    expect(await proposeTopic(call, "d1", "student", topic("approved"), "Nova", "")).toEqual({ outcome: "locked" });
    expect(await proposeTopic(call, "d1", "mentor", topic(), "Nova", "")).toEqual({ outcome: "forbidden" });
    expect(call).not.toHaveBeenCalled();
    expect(canPropose("approved")).toBe(false);
    for (const s of ["none", "proposed", "returned"] as const) expect(canPropose(s)).toBe(true);
  });
  it("sends trimmed text; the same text as the last proposal sends nothing; the result is the server's answer", async () => {
    const call = fake(() => ok(topic("proposed")));
    const r = await proposeTopic(call, "d1", "student", topic(), "  Nova tema ", " opis ");
    expect(r.outcome).toBe("saved");
    expect(call).toHaveBeenCalledWith("work.thesis-topic.put", { params: { documentId: "d1" }, query: undefined, body: { title: "Nova tema", summary: "opis" } });
    expect((await proposeTopic(call, "d1", "student", topic("proposed"), "Izmišljena tema", "Izmišljeni opis")).outcome).toBe("unchanged");
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("an unusable answer is not 'saved'; server codes map to messages", async () => {
    expect((await proposeTopic(fake(() => ok({ x: 1 })), "d1", "student", topic(), "A", "")).outcome).toBe("unknown");
    for (const [status, out] of [[401, "signedOut"], [403, "forbidden"], [404, "notFound"], [409, "conflict"], [422, "invalid"], [500, "unknown"]] as const) {
      expect((await proposeTopic(fake(() => fail(status)), "d1", "student", topic(), "A", "")).outcome).toBe(out);
    }
    expect((await proposeTopic(fake(() => { throw new Error("izmišljena"); }), "d1", "student", topic(), "A", "")).outcome).toBe("unknown");
  });
});

let root: Root | null = null;
async function mount(value: Topic, call: Call, reload = vi.fn()) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(h(TopicStudentView, { documentId: "d1", role: "student", value, reload, call })); });
  return host;
}
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });
const button = (host: HTMLElement, text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === text);
async function type(el: Element, text: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("TopicStudentView", () => {
  it("shows the counters, refuses an empty title with no request, then sends once on a double click", async () => {
    const call = fake(() => ok(topic("proposed")));
    const host = await mount(topic(), call);
    expect(host.textContent).toContain("0/200");
    await act(async () => { button(host, topicStudentHr.submitFirst)!.click(); });
    expect(host.textContent).toContain(topicStudentHr.titleEmpty);
    expect(call).not.toHaveBeenCalled();
    await type(host.querySelector("input")!, "Izmišljena tema");
    expect(host.textContent).toContain("15/200");
    await act(async () => { const b = button(host, topicStudentHr.submitFirst)!; b.click(); b.click(); });
    expect(puts(call)).toHaveLength(1);
    expect(host.querySelector("[data-testid=topic-state]")!.textContent).toContain(topicStudentHr.states.proposed);
    expect(host.textContent).toContain(topicStudentHr.saved);
  });
  it("a too long title shows its message and sends nothing", async () => {
    const call = fake(() => ok(topic("proposed")));
    const host = await mount(topic(), call);
    await type(host.querySelector("input")!, "a".repeat(201));
    expect(host.textContent).toContain(topicStudentHr.titleTooLong);
    await act(async () => { button(host, topicStudentHr.submitFirst)!.click(); });
    expect(call).not.toHaveBeenCalled();
  });
  it("a returned topic shows the mentor's comment and allows a new proposal", async () => {
    const call = fake(() => ok(topic("proposed")));
    const host = await mount(returned(), call);
    expect(host.querySelector("[data-testid=topic-comment]")!.textContent).toContain("Suzite temu.");
    await type(host.querySelector("input")!, "Uža tema");
    await act(async () => { button(host, topicStudentHr.submitAgain)!.click(); });
    expect(puts(call)).toHaveLength(1);
  });
  it("after approval the form is locked and says so; there is no way to send", async () => {
    const call = fake(() => ok(topic()));
    const host = await mount(topic("approved"), call);
    expect(host.textContent).toContain(topicStudentHr.approvedLocked);
    expect(host.querySelector("input")).toBeNull();
    expect(host.querySelector("textarea")).toBeNull();
    expect(button(host, topicStudentHr.submitNew)).toBeUndefined();
    expect(call).not.toHaveBeenCalled();
  });
  it("a 409 shows 'mentor decided meanwhile' and reads again, so the locked state appears", async () => {
    const call = fake((id) => (id === "work.thesis-topic.get" ? ok(topic("approved")) : fail(409)));
    const host = await mount(topic("proposed"), call);
    await type(host.querySelector("input")!, "Druga tema");
    await act(async () => { button(host, topicStudentHr.submitNew)!.click(); });
    expect(host.textContent).toContain(topicStudentHr.conflict);
    expect(call).toHaveBeenCalledWith("work.thesis-topic.get", expect.anything());
    expect(host.querySelector("[data-testid=topic-approved]")).not.toBeNull();
    expect(host.querySelector("input")).toBeNull();
  });
  it("lists the history of versions", async () => {
    const t2: Topic = { ...topic("proposed"), current: v(2, "Druga"), history: [v(1, "Prva"), v(2, "Druga")] };
    const host = await mount(t2, fake(() => ok({})));
    expect(host.querySelector("[data-testid=topic-v1]")!.textContent).toContain("Prva");
    expect(host.querySelector("[data-testid=topic-v2]")!.textContent).toContain("Druga");
  });
});

describe("texts", () => {
  it("hold no forbidden term (PRODUCT §5)", () => {
    const all: string[] = [];
    const walk = (x: unknown) => (typeof x === "string" ? all.push(x) : Object.values(x as object).forEach(walk));
    walk(topicStudentHr);
    for (const text of all) expect(findForbiddenTerms(text, "hr")).toEqual([]);
  });
});
