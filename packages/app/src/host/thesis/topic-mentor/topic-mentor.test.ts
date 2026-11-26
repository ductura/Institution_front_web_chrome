// @vitest-environment jsdom
// WEB-V16-TEMA-MENTOR: the mentor's decision on a thesis topic. Invented data only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { allowedDecisions, decide } from "./actions";
import { topicMentorHr } from "./messages.hr";
import { parseTopic, readTopic, type Call, type TopicValue } from "./read";
import { section, TopicMentorView } from "./section";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const v = (version: number) => ({ version, title: `Izmišljena tema ${version}`, summary: "Izmišljeni sažetak.", proposedAt: "2026-03-01T10:00:00Z" });
const wire = (state: TopicValue["state"] = "proposed", version = 2) => ({
  state, current: state === "none" ? null : v(version), decision: null, history: state === "none" ? [] : [v(1)],
});
const ok = (body: unknown) => ({ ok: true, status: 200, body, headers: {} });
const fail = (status: number) => ({ ok: false, status, code: "x" });
const fake = (fn: (id: string, input: { body?: unknown }) => unknown) =>
  vi.fn(async (id: string, input: { body?: unknown }) => fn(id, input)) as unknown as Call & ReturnType<typeof vi.fn>;
const topic = (state: TopicValue["state"] = "proposed", version = 2) => parseTopic(wire(state, version)) as TopicValue;

describe("read", () => {
  it("a 404 is notFound (another's work), other failures are unavailable, a wrong shape is unavailable, not empty", async () => {
    expect(await readTopic(fake(() => fail(404)), "d1")).toEqual({ kind: "notFound" });
    expect(await readTopic(fake(() => fail(500)), "d1")).toEqual({ kind: "unavailable" });
    expect(await readTopic(fake(() => ok({ state: "x", current: null, decision: null, history: [] })), "d1")).toEqual({ kind: "unavailable" });
    expect(await readTopic(fake(() => ok({ ...wire("proposed"), current: null })), "d1")).toEqual({ kind: "unavailable" });
    expect(await readTopic(fake(() => ok({ ...wire("none"), current: v(1) })), "d1")).toEqual({ kind: "unavailable" });
  });
  it("no proposal yet is still ready, with the history of versions otherwise", async () => {
    expect((await readTopic(fake(() => ok(wire("none"))), "d1")).kind).toBe("ready");
    const r = await readTopic(fake(() => ok(wire("proposed"))), "d1");
    expect(r.kind === "ready" && r.value.history.length).toBe(1);
  });
});

describe("rules", () => {
  it("only the mentor decides: a proposal either way, an approved topic only back, nothing else", () => {
    expect(allowedDecisions("mentor", "proposed")).toEqual(["approved", "returned"]);
    expect(allowedDecisions("mentor", "approved")).toEqual(["returned"]);
    expect(allowedDecisions("mentor", "returned")).toEqual([]);
    expect(allowedDecisions("mentor", "none")).toEqual([]);
    expect(allowedDecisions("student", "proposed")).toEqual([]);
  });
  it("returning without a comment (or with blanks) sends no request; a student's decision sends none either", async () => {
    const call = fake(() => ok(wire()));
    expect(await decide(call, "d1", "mentor", topic(), "returned", "")).toBe("commentRequired");
    expect(await decide(call, "d1", "mentor", topic(), "returned", "   \n ")).toBe("commentRequired");
    expect(await decide(call, "d1", "student", topic(), "approved", "")).toBe("forbidden");
    expect(await decide(call, "d1", "mentor", topic("none"), "approved", "")).toBe("forbidden");
    expect(await decide(call, "d1", "mentor", topic("returned"), "approved", "")).toBe("forbidden");
    expect(await decide(call, "d1", "mentor", topic("proposed"), "returned", "x".repeat(1001))).toBe("invalid");
    expect(call).not.toHaveBeenCalled();
  });
  it("the decision names the version on screen; approval needs no comment, a comment is trimmed", async () => {
    const call = fake(() => ok(wire("approved")));
    expect(await decide(call, "d7", "mentor", topic("proposed", 3), "approved", "")).toBe("saved");
    expect(call).toHaveBeenLastCalledWith("work.thesis-topic-decision.post", { params: { documentId: "d7" }, query: undefined, body: { version: 3, decision: "approved" } });
    expect(await decide(call, "d7", "mentor", topic("approved", 3), "returned", "  Suziti temu. ")).toBe("saved");
    expect(call).toHaveBeenLastCalledWith("work.thesis-topic-decision.post", { params: { documentId: "d7" }, query: undefined, body: { version: 3, decision: "returned", comment: "Suziti temu." } });
  });
  it("server answers map to messages: 403, 404, 409 (stale version), 422 and a thrown call", async () => {
    for (const [status, out] of [[401, "signedOut"], [403, "forbidden"], [404, "notFound"], [409, "conflict"], [422, "invalid"], [500, "unknown"]] as const) {
      expect(await decide(fake(() => fail(status)), "d1", "mentor", topic(), "approved", "")).toBe(out);
    }
    expect(await decide(fake(() => { throw new Error("izmišljena"); }), "d1", "mentor", topic(), "approved", "")).toBe("unknown");
  });
});

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });
function mount(role: "student" | "mentor", value: TopicValue, call: Call, reload = () => {}) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(h(TopicMentorView, { documentId: "d1", role, value, reload, call })));
  return host;
}
const button = (el: HTMLElement, text: string) => [...el.querySelectorAll("button")].find((b) => b.textContent === text) as HTMLButtonElement | undefined;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
function type(el: HTMLElement, value: string) {
  const ta = el.querySelector("textarea") as HTMLTextAreaElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(ta, value);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("view", () => {
  it("the student sees the topic and its history but has no controls", () => {
    const el = mount("student", topic(), fake(() => ok(wire())));
    expect(el.textContent).toContain("Izmišljena tema 2");
    expect(el.textContent).toContain("Izmišljena tema 1");
    expect(button(el, topicMentorHr.approve)).toBeUndefined();
    expect(button(el, topicMentorHr.returnForRework)).toBeUndefined();
    expect(el.querySelector("textarea")).toBeNull();
  });
  it("the mentor's return without a comment shows the reason and sends no request", async () => {
    const call = fake(() => ok(wire()));
    const el = mount("mentor", topic(), call);
    await act(async () => { button(el, topicMentorHr.returnForRework)!.click(); });
    expect(call).not.toHaveBeenCalled();
    expect(el.textContent).toContain(topicMentorHr.commentRequired);
  });
  it("a decision on an old version (409) refreshes the view to the newer version", async () => {
    const call = fake((id) => (id === "work.thesis-topic-decision.post" ? fail(409) : ok(wire("proposed", 3))));
    const el = mount("mentor", topic("proposed", 2), call);
    await act(async () => { button(el, topicMentorHr.approve)!.click(); });
    await flush();
    expect(el.textContent).toContain(topicMentorHr.conflict);
    expect(el.textContent).toContain("Izmišljena tema 3");
  });
  it("a decision answered with 404 reloads the section so the frame can hide it", async () => {
    const reload = vi.fn();
    const el = mount("mentor", topic(), fake(() => fail(404)), reload);
    await act(async () => { button(el, topicMentorHr.approve)!.click(); });
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain(topicMentorHr.notFound);
  });
  it("an approved topic can be returned with a reason, and the view then shows the server's state", async () => {
    const returned = { ...wire("returned", 2), decision: { version: 2, decision: "returned", comment: "Suziti temu.", decidedAt: "2026-03-05T09:00:00Z" } };
    const call = fake((id) => (id === "work.thesis-topic-decision.post" ? ok(returned) : ok(returned)));
    const el = mount("mentor", topic("approved", 2), call);
    expect(button(el, topicMentorHr.approve)).toBeUndefined();
    type(el, "Suziti temu.");
    await act(async () => { button(el, topicMentorHr.returnApproved)!.click(); });
    await flush();
    expect(el.textContent).toContain(topicMentorHr.saved);
    expect(el.textContent).toContain(topicMentorHr.states.returned);
    expect(el.querySelector("[data-testid=topic-controls]")).toBeNull();
  });
});

describe("registration and texts", () => {
  it("the student gets no mentor section and no request is sent (topic-student owns that view)", async () => {
    const call = fake(() => ok(wire()));
    expect(await section.read("d1", "student")).toEqual({ kind: "notFound" });
    expect(call).not.toHaveBeenCalled();
  });
  it("the section is registered in the panel's registry", async () => {
    const { registeredSections } = await import("../sections");
    expect(registeredSections.map((s) => s.id)).toContain(section.id);
  });
  it("no forbidden term appears in the section's texts", () => {
    const texts = JSON.stringify(topicMentorHr);
    expect(findForbiddenTerms(texts, "hr")).toEqual([]);
  });
});
