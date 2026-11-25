// @vitest-environment jsdom
// WEB-V19-RECENZIJA-NASTAVNIK: the page mounted in jsdom with a test double for the client. Invented text only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { teacherPeerReviewText as t } from "./messages.hr";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("../../context", () => ({ useHost: () => ({ base: "/app/web" }) }));
vi.mock("@/client/api", () => ({ createApi: vi.fn(), goToSignIn: signIn }));
const { default: OverviewPage } = await import("./OverviewPage");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.open = true; };
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.open = false; };

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const A = "11111111-1111-4111-8111-111111111111";
const ok = (body: unknown, status = 200): Answer => ({ ok: true, status, body });
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const ROUND = { roundId: "r1", opensAt: "2026-12-01T08:00:00.000Z", dueAt: "2026-12-10T17:30:00.000Z", reviewsPerStudent: 2, rubrics: [{ key: "argument", label: "Argument" }], allocatedAt: null };
const roundView = (state: string, round: unknown = ROUND, submittedWorks = 4) => ok({ round, state, submittedWorks, minSubmissions: 3 });
const p = (givenName: string, familyName: string) => ({ id: `${givenName}${familyName}`, givenName, familyName });
const R1 = "22222222-2222-4222-8222-222222222222";

function apiOf(routes: Record<string, (body?: unknown) => Answer>) {
  const calls: { id: string; input: { body?: unknown; params?: unknown } }[] = [];
  const fn = vi.fn(async (id: string, input: { body?: unknown; params?: unknown }) => { calls.push({ id, input }); return routes[id]!(input.body); });
  return { calls, call: () => fn as never };
}
const idle = { "peer-review.teacher-overview.get": () => ok({ allocations: [] }) };

describe("the teacher's peer-review page in the browser", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); signIn.mockClear(); });
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const render = async (el: ReturnType<typeof h>) => { act(() => root?.unmount()); root = createRoot(host); await act(async () => { root?.render(el); }); };
  const text = () => host.textContent ?? "";
  const click = async (el: Element | null | undefined) => { await act(async () => { (el as HTMLElement).click(); }); };
  const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label || b.getAttribute("aria-label") === label);
  const field = (label: string) => [...document.querySelectorAll("label")].find((l) => l.textContent === label)!.control as HTMLInputElement | HTMLTextAreaElement;
  const type = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => { Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  const submit = async () => { await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); };

  describe("the round", () => {
    it("shows what the server has and no total, rank or mark", async () => {
      await render(h(OverviewPage, { assignmentId: A, call: apiOf({ "peer-review.round.get": () => roundView("open"), ...idle }).call }));
      expect(host.querySelector("[data-testid=round-state]")!.textContent).toBe(t.round.state.open);
      expect(field(t.round.opensAt).value).toBe("2026-12-01T09:00");
      expect(field(t.round.dueAt).value).toBe("2026-12-10T18:30");
      expect(field(t.round.rubricLabel.replace("{n}", "1")).value).toBe("Argument");
      expect(text()).not.toMatch(/%|rang|najbolj/i);
    });
    it("sends nothing for a bad input and names the field", async () => {
      const { call, calls } = apiOf({ "peer-review.round.get": () => roundView("none", null, 0), "peer-review.round.put": () => ok({ round: ROUND }), ...idle });
      await render(h(OverviewPage, { assignmentId: A, call }));
      await type(field(t.round.rubricLabel.replace("{n}", "1")), "Argument");
      await submit();
      expect(text()).toContain(t.round.errors.date);
      expect(calls.filter((c) => c.id === "peer-review.round.put")).toHaveLength(0);
    });
    it("saves the round in the contract's shape, in Zagreb time, and says so only after the server did", async () => {
      let saved = false;
      const { call, calls } = apiOf({
        "peer-review.round.get": () => (saved ? roundView("not_allocated") : roundView("none", null, 0)),
        "peer-review.round.put": () => { saved = true; return ok({ round: ROUND }); },
        ...idle,
      });
      await render(h(OverviewPage, { assignmentId: A, call }));
      await type(field(t.round.opensAt), "2026-12-01T09:00");
      await type(field(t.round.dueAt), "2026-12-10T18:30");
      await type(field(t.round.rubricLabel.replace("{n}", "1")), "Argument");
      await click(button(t.round.addRubric));
      await type(field(t.round.rubricLabel.replace("{n}", "2")), "Struktura");
      await submit();
      expect(calls.find((c) => c.id === "peer-review.round.put")!.input.body).toEqual({
        opensAt: "2026-12-01T08:00:00.000Z", dueAt: "2026-12-10T17:30:00.000Z", reviewsPerStudent: 1,
        rubrics: [{ key: "kriterij-1", label: "Argument" }, { key: "kriterij-2", label: "Struktura" }],
      });
      expect(text()).toContain(t.round.saved);
    });
    it("a refused save says what happened, never 'saved'; a lost answer is 'unknown'", async () => {
      for (const [answer, message] of [[fail(409, "already_allocated"), t.round.already], [fail(503, "unavailable"), t.round.unknown]] as const) {
        await render(h(OverviewPage, { assignmentId: A, call: apiOf({ "peer-review.round.get": () => roundView("not_allocated"), "peer-review.round.put": () => answer, ...idle }).call }));
        await submit();
        expect(text()).toContain(message);
        expect(text()).not.toContain(t.round.saved);
      }
    });
    it("is read-only once the reviews are allocated", async () => {
      await render(h(OverviewPage, { assignmentId: A, call: apiOf({ "peer-review.round.get": () => roundView("allocated", { ...ROUND, allocatedAt: "2026-12-02T10:00:00.000Z" }), ...idle }).call }));
      expect(host.querySelector("[data-testid=round-locked]")).not.toBeNull();
      expect(field(t.round.opensAt).disabled).toBe(true);
      expect(button(t.round.save)).toBeUndefined();
      expect(button(t.allocate.button)).toBeUndefined();
    });
    it("a failed read is an error with a retry, not an empty form; 404 reads as gone; 401 goes to sign-in", async () => {
      await render(h(OverviewPage, { assignmentId: A, call: apiOf({ "peer-review.round.get": () => fail(503, "unavailable"), ...idle }).call }));
      expect(text()).toContain(t.round.unavailable);
      expect(host.querySelector("form")).toBeNull();
      await render(h(OverviewPage, { assignmentId: A, call: apiOf({ "peer-review.round.get": () => fail(404, "not_found"), "peer-review.teacher-overview.get": () => fail(404, "not_found") }).call }));
      expect(text()).toContain(t.gone);
      await render(h(OverviewPage, { assignmentId: A, call: apiOf({ "peer-review.round.get": () => fail(401, "unauthorized"), "peer-review.teacher-overview.get": () => fail(401, "unauthorized") }).call }));
      expect(signIn).toHaveBeenCalled();
    });
  });

  describe("allocation", () => {
    const base = (put: () => Answer, overview: () => Answer = () => ok({ allocations: [] })) =>
      apiOf({ "peer-review.round.get": () => roundView("not_allocated"), "peer-review.allocate.post": put, "peer-review.teacher-overview.get": overview });
    it("asks first, then allocates once and reads the round and the overview again", async () => {
      let done = false;
      const { call, calls } = apiOf({
        "peer-review.round.get": () => (done ? roundView("allocated", { ...ROUND, allocatedAt: "2026-12-02T10:00:00.000Z" }) : roundView("not_allocated")),
        "peer-review.allocate.post": () => { done = true; return ok({ allocated: 8 }, 201); },
        "peer-review.teacher-overview.get": () => ok({ allocations: done ? [{ reviewId: null, reviewer: p("Ana", "Babić"), author: p("Marko", "Čović"), state: "pending" }] : [] }),
      });
      await render(h(OverviewPage, { assignmentId: A, call }));
      await click(button(t.allocate.button));
      expect(calls.filter((c) => c.id === "peer-review.allocate.post")).toHaveLength(0);
      await click(button(t.allocate.confirmYes));
      expect(calls.filter((c) => c.id === "peer-review.allocate.post")).toHaveLength(1);
      expect(text()).toContain(t.allocate.done.replace("{n}", "8"));
      expect(host.querySelectorAll("[data-testid=allocation]")).toHaveLength(1);
      expect(button(t.allocate.button)).toBeUndefined();
    });
    it("declining the question sends nothing", async () => {
      const { call, calls } = base(() => ok({ allocated: 1 }, 201));
      await render(h(OverviewPage, { assignmentId: A, call }));
      await click(button(t.allocate.button));
      await click(button(t.allocate.confirmNo));
      expect(calls.filter((c) => c.id === "peer-review.allocate.post")).toHaveLength(0);
    });
    it("too few works and the button is disabled before the server is even asked", async () => {
      await render(h(OverviewPage, { assignmentId: A, call: apiOf({ "peer-review.round.get": () => roundView("not_allocated", ROUND, 2), ...idle }).call }));
      expect(button(t.allocate.button)!.hasAttribute("disabled")).toBe(true);
    });
    it.each([[fail(409, "too_few_submissions"), t.allocate.tooFew], [fail(409, "already_allocated"), t.allocate.already], [fail(503, "unavailable"), t.allocate.unknown]] as const)("%j says %s", async (answer, message) => {
      await render(h(OverviewPage, { assignmentId: A, call: base(() => answer).call }));
      await click(button(t.allocate.button));
      await click(button(t.allocate.confirmYes));
      expect(text()).toContain(message);
      expect(text()).not.toContain(t.allocate.done.replace("{n}", "1"));
    });
  });

  describe("the overview", () => {
    const rows = [
      { reviewId: R1, reviewer: p("Petra", "Zorić"), author: p("Ana", "Babić"), state: "submitted" },
      { reviewId: null, reviewer: p("Ana", "Babić"), author: p("Iva", "Čović"), state: "pending" },
      { reviewId: "33333333-3333-4333-8333-333333333333", reviewer: p("Iva", "Čović"), author: p("Petra", "Zorić"), state: "withdrawn" },
    ];
    const routes = (withdraw: (body?: unknown) => Answer = () => ok({ reviewId: R1 }, 201)) => apiOf({
      "peer-review.round.get": () => roundView("open", { ...ROUND, allocatedAt: "2026-12-02T10:00:00.000Z" }),
      "peer-review.teacher-overview.get": () => ok({ allocations: rows }),
      "peer-review.review-withdrawal.post": withdraw,
    });
    it("shows both ends of each allocation by the reviewer's name, with the state as a fact, and says it has no review text", async () => {
      await render(h(OverviewPage, { assignmentId: A, call: routes().call }));
      const items = [...host.querySelectorAll("[data-testid=allocation]")];
      expect(items.map((i) => i.querySelector("[data-testid=allocation-state]")!.textContent)).toEqual([t.overview.state.pending, t.overview.state.withdrawn, t.overview.state.submitted]);
      expect(items[0]!.textContent).toContain("Ana Babić");
      expect(items[0]!.textContent).toContain("Iva Čović");
      expect(text()).toContain(t.overview.unreadable);
    });
    it("offers the withdrawal only for the sent review", async () => {
      await render(h(OverviewPage, { assignmentId: A, call: routes().call }));
      expect(document.querySelectorAll(`button[aria-label^="Povuci recenziju"]`)).toHaveLength(1);
    });
    it("needs a reason, then withdraws that review once and reads the list again", async () => {
      const { call, calls } = routes();
      await render(h(OverviewPage, { assignmentId: A, call }));
      await click(document.querySelector(`button[aria-label^="Povuci recenziju"]`));
      await click(button(t.withdraw.yes));
      expect(text()).toContain(t.withdraw.errors.empty);
      expect(calls.filter((c) => c.id === "peer-review.review-withdrawal.post")).toHaveLength(0);
      await type(field(t.withdraw.reason), "Uvredljiv sadržaj.");
      await click(button(t.withdraw.yes));
      const sent = calls.filter((c) => c.id === "peer-review.review-withdrawal.post");
      expect(sent).toHaveLength(1);
      expect(sent[0]!.input).toMatchObject({ params: { assignmentId: A, reviewId: R1 }, body: { reason: "Uvredljiv sadržaj." } });
      expect(text()).toContain(t.withdraw.done);
      expect(calls.filter((c) => c.id === "peer-review.teacher-overview.get").length).toBeGreaterThanOrEqual(2);
    });
    it.each([[fail(409, "conflict"), t.withdraw.conflict], [fail(404, "not_found"), t.withdraw.notFound], [fail(503, "unavailable"), t.withdraw.unknown]] as const)("%j says %s, never done", async (answer, message) => {
      await render(h(OverviewPage, { assignmentId: A, call: routes(() => answer).call }));
      await click(document.querySelector(`button[aria-label^="Povuci recenziju"]`));
      await type(field(t.withdraw.reason), "Razlog.");
      await click(button(t.withdraw.yes));
      expect(text()).toContain(message);
      expect(text()).not.toContain(t.withdraw.done);
    });
    it("an empty list is its own state, and a failed read is not 'none'", async () => {
      await render(h(OverviewPage, { assignmentId: A, call: apiOf({ "peer-review.round.get": () => roundView("not_allocated"), ...idle }).call }));
      expect(host.querySelector("[data-testid=overview-none]")).not.toBeNull();
      await render(h(OverviewPage, { assignmentId: A, call: apiOf({ "peer-review.round.get": () => roundView("not_allocated"), "peer-review.teacher-overview.get": () => fail(503, "unavailable") }).call }));
      expect(host.querySelector("[data-testid=overview-none]")).toBeNull();
      expect(text()).toContain(t.unavailable);
    });
    it("another course's assignment is the same 'gone' as an unknown one", async () => {
      await render(h(OverviewPage, { assignmentId: A, call: apiOf({ "peer-review.round.get": () => roundView("open"), "peer-review.teacher-overview.get": () => fail(404, "not_found") }).call }));
      expect(host.querySelector("[data-testid=allocation]")).toBeNull();
      expect(text()).toContain(t.gone);
    });
  });
});
