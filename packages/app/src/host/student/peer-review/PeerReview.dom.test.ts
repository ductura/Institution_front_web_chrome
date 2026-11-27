// @vitest-environment jsdom
// WEB-V19-RECENZIJA-STUDENT: the three screens mounted in jsdom with a test double for the client. Invented text only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { peerReviewText as t } from "./messages.hr";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("../../context", () => ({ useHost: () => ({ base: "/aplikacija" }) }));
vi.mock("@/client/api", () => ({ createApi: vi.fn(), goToSignIn: signIn }));
const { default: TasksPage } = await import("./TasksPage");
const { default: ReviewPage } = await import("./ReviewPage");
const { default: ReceivedPage } = await import("./ReceivedPage");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.open = true; };
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.open = false; };

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const A = "11111111-1111-4111-8111-111111111111";
const T1 = "22222222-2222-4222-8222-222222222222";
const T2 = "33333333-3333-4333-8333-333333333333";
const ok = (body: unknown, status = 200): Answer => ({ ok: true, status, body });
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const DUE = "2026-12-20T10:00:00.000Z";
const WORK = {
  rubrics: [{ key: "argument", label: "Argument" }, { key: "structure", label: "Struktura" }],
  // A server that leaked a name would have to put it in a field the contract does not have; the page must not print it.
  document: { authorName: "Ana Neanonimna", blocks: [{ kind: "heading", text: "Naslov rada" }, { kind: "paragraph", text: "Prvi odlomak." }, { kind: "list_item", text: "stavka" }] },
};

function apiOf(routes: Record<string, (body?: unknown) => Answer>) {
  const calls: { id: string; input: { body?: unknown; params?: unknown } }[] = [];
  const fn = vi.fn(async (id: string, input: { body?: unknown; params?: unknown }) => { calls.push({ id, input }); return routes[id]!(input.body); });
  return { calls, call: () => fn as never };
}

describe("peer review in the browser", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); signIn.mockClear(); });
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  // A fresh mount per call: a second render on the same root would keep the first one's state.
  const render = async (el: ReturnType<typeof h>) => { act(() => root?.unmount()); root = createRoot(host); await act(async () => { root?.render(el); }); };
  const text = () => host.textContent ?? "";
  const click = async (el: Element | null | undefined) => { await act(async () => { (el as HTMLElement).click(); }); };
  const type = async (el: HTMLTextAreaElement, value: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const area = (label: string) => [...host.querySelectorAll("label")].find((l) => l.textContent === label)!.control as HTMLTextAreaElement;
  const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label);

  describe("the list of works", () => {
    const tasks = (state: string, list: unknown[]) => apiOf({ "student.peer-review-tasks.get": () => ok({ state, tasks: list }) });
    it("lists the works by position with the deadline, a link to write only for a waiting work in an open round, and the marks", async () => {
      const { call } = tasks("open", [{ taskId: T1, state: "pending", dueAt: DUE }, { taskId: T2, state: "submitted", dueAt: DUE }]);
      await render(h(TasksPage, { assignmentId: A, call }));
      const rows = [...host.querySelectorAll("[data-testid=peer-review-task]")];
      expect(rows.map((r) => r.getAttribute("data-state"))).toEqual(["pending", "submitted"]);
      expect(rows[0]!.textContent).toContain("Rad 1");
      expect(rows[0]!.querySelector("a")!.getAttribute("href")).toContain(`/zadatak/${A}/recenzija/rad/${T1}`);
      expect(rows[1]!.querySelector("a")).toBeNull();
      expect(host.querySelector("[data-testid=peer-review-marks]")!.textContent).toContain(t.anonymousWork);
      expect(host.querySelector("[data-testid=peer-review-marks]")!.textContent).toContain(t.notGraded);
      expect(host.querySelector<HTMLAnchorElement>("[data-testid=received-link]")!.getAttribute("href")).toContain(`/zadatak/${A}/recenzija/primljene`);
    });
    it("a closed round offers no link to write", async () => {
      await render(h(TasksPage, { assignmentId: A, call: tasks("closed", [{ taskId: T1, state: "pending", dueAt: DUE }]).call }));
      expect(host.querySelector("[data-testid=peer-review-closed]")).not.toBeNull();
      expect(host.querySelector("[data-testid=peer-review-task] a")).toBeNull();
    });
    it("tells disabled, none, unavailable and gone apart; an error is never 'no works'", async () => {
      await render(h(TasksPage, { assignmentId: A, call: tasks("disabled", []).call }));
      expect(host.querySelector("[data-testid=peer-review-disabled]")).not.toBeNull();
      expect(host.querySelector("[data-testid=received-link]")).toBeNull();
      await render(h(TasksPage, { assignmentId: A, call: tasks("none", []).call }));
      expect(host.querySelector("[data-testid=peer-review-none]")).not.toBeNull();
      await render(h(TasksPage, { assignmentId: A, call: apiOf({ "student.peer-review-tasks.get": () => fail(503, "unavailable") }).call }));
      expect(text()).toContain(t.unavailable);
      expect(host.querySelector("[data-testid=peer-review-none]")).toBeNull();
      await render(h(TasksPage, { assignmentId: A, call: apiOf({ "student.peer-review-tasks.get": () => fail(404, "not_found") }).call }));
      expect(text()).toContain(t.gone);
    });
    it("V19: a waiting work of a closed round says the round is closed, never 'waits for your review'; 403 is the denied state, no page", async () => {
      await render(h(TasksPage, { assignmentId: A, call: tasks("closed", [{ taskId: T1, state: "pending", dueAt: DUE }]).call }));
      const row = host.querySelector("[data-testid=peer-review-task]")!.textContent!;
      expect(row).toContain(t.list.roundClosed);
      expect(row).not.toContain(t.list.pending);
      expect(row).not.toContain("·");
      expect(row).toContain("20. prosinca 2026. u 11:00");
      await render(h(TasksPage, { assignmentId: A, call: apiOf({ "student.peer-review-tasks.get": () => fail(403, "forbidden") }).call }));
      expect(host.querySelector("h1")!.textContent).toBe("Nemate pristup ovom prikazu");
      expect(host.querySelectorAll("h1")).toHaveLength(1);
      expect(text()).toContain("Natrag na moj prostor");
    });
    it("V19: an unavailable read is a role=alert frame with a retry link, not a button", async () => {
      await render(h(TasksPage, { assignmentId: A, call: apiOf({ "student.peer-review-tasks.get": () => fail(503, "unavailable") }).call }));
      expect(host.querySelector("[role=alert]")!.textContent).toContain(t.unavailable);
      expect(text()).toContain(t.retry);
    });
    it("a lost session goes to the sign-in", async () => {
      await render(h(TasksPage, { assignmentId: A, call: apiOf({ "student.peer-review-tasks.get": () => fail(401, "unauthorized") }).call }));
      expect(signIn).toHaveBeenCalled();
    });
  });

  describe("the review of a work", () => {
    const routes = (post: (body?: unknown) => Answer) => apiOf({ "student.peer-review-work.get": () => ok(WORK), "student.peer-review.post": post });
    it("shows the text of the work and nothing that leads to the author, with the marks", async () => {
      await render(h(ReviewPage, { assignmentId: A, taskId: T1, call: routes(() => ok({ reviewId: T1 }, 201)).call }));
      expect(text()).toContain("Prvi odlomak.");
      expect(host.querySelector("h3")!.textContent).toBe("Naslov rada");
      expect(host.querySelectorAll("li")).toHaveLength(1);
      expect(text()).not.toContain("Ana Neanonimna");
      expect(host.innerHTML).not.toContain(T1);
      expect(host.querySelector("[data-testid=peer-review-marks]")!.textContent).toContain(t.anonymousWork);
    });
    it("sends only after the confirmation, in the rubrics' order, and only the filled ones; success follows the answer", async () => {
      const { call, calls } = routes(() => ok({ reviewId: T1 }, 201));
      await render(h(ReviewPage, { assignmentId: A, taskId: T1, call }));
      await type(area("Struktura"), "Jasna struktura.");
      await click(host.querySelector("button[type=submit]"));
      expect(calls.filter((c) => c.id === "student.peer-review.post")).toHaveLength(0);
      expect(document.body.textContent).toContain(t.work.confirmTitle);
      expect(text()).not.toContain(t.work.sent);
      await click(button(t.work.confirmYes));
      const post = calls.find((c) => c.id === "student.peer-review.post")!;
      expect(post.input).toEqual({ params: { taskId: T1 }, query: undefined, body: { byRubric: [{ key: "structure", text: "Jasna struktura." }] } });
      expect(text()).toContain(t.work.sent);
      expect(host.querySelector("form")).toBeNull();
      expect(host.querySelector("[data-testid=back-to-list]")).not.toBeNull();
    });
    it("an empty review and a refused text are stopped before the request", async () => {
      const { call, calls } = routes(() => ok({ reviewId: T1 }, 201));
      await render(h(ReviewPage, { assignmentId: A, taskId: T1, call }));
      await click(host.querySelector("button[type=submit]"));
      expect(text()).toContain(t.errors.empty);
      await type(area("Argument"), "lose‮znakovi");
      await click(host.querySelector("button[type=submit]"));
      expect(text()).toContain(t.errors.badChars);
      expect(calls.filter((c) => c.id === "student.peer-review.post")).toHaveLength(0);
    });
    it.each([
      [fail(409, "closed"), t.errors.closed],
      [fail(409, "already_reviewed"), t.errors.alreadyReviewed],
      [fail(404, "not_found"), t.errors.notFound],
      [fail(503, "unavailable"), t.errors.unknown],
    ])("%j keeps the draft and says so, never 'sent'", async (answer, message) => {
      await render(h(ReviewPage, { assignmentId: A, taskId: T1, call: routes(() => answer).call }));
      await type(area("Argument"), "Moj tekst.");
      await click(host.querySelector("button[type=submit]"));
      await click(button(t.work.confirmYes));
      expect(host.querySelector("[role=alert]")!.textContent).toBe(message);
      expect(text()).not.toContain(t.work.sent);
      expect(area("Argument").value).toBe("Moj tekst.");
    });
    it("another student's or unknown work reads as gone, with no form", async () => {
      await render(h(ReviewPage, { assignmentId: A, taskId: T1, call: apiOf({ "student.peer-review-work.get": () => fail(404, "not_found") }).call }));
      expect(text()).toContain(t.gone);
      expect(host.querySelector("form")).toBeNull();
    });
  });

  describe("the reviews received", () => {
    const review = (id: string, at: string, text: string) => ({ reviewId: id, submittedAt: at, general: null, reviewerName: "Tajni Recenzent", byRubric: [{ key: "argument", label: "Argument", text }] });
    it("lists them in the order sent, with no reviewer, no number and no mark", async () => {
      const call = apiOf({ "student.peer-reviews-received.get": () => ok({ reviews: [review(T2, "2026-12-02T10:00:00.000Z", "Druga."), { ...review(T1, "2026-12-01T10:00:00.000Z", "Prva."), general: "Opći." }] }) }).call;
      await render(h(ReceivedPage, { assignmentId: A, call }));
      expect([...host.querySelectorAll("[data-testid=received-review]")].map((e) => e.textContent)).toEqual(["ArgumentPrva.Opći komentarOpći.", "ArgumentDruga."]);
      expect(text()).not.toContain("Tajni Recenzent");
      expect(host.querySelector("[data-testid=peer-review-marks]")!.textContent).toContain(t.notGraded);
      expect(host.querySelector("[data-testid=peer-review-marks]")!.textContent).not.toContain(t.anonymousWork);
    });
    it("none, unavailable and gone are different", async () => {
      await render(h(ReceivedPage, { assignmentId: A, call: apiOf({ "student.peer-reviews-received.get": () => ok({ reviews: [] }) }).call }));
      expect(host.querySelector("[data-testid=received-none]")).not.toBeNull();
      await render(h(ReceivedPage, { assignmentId: A, call: apiOf({ "student.peer-reviews-received.get": () => fail(503, "unavailable") }).call }));
      expect(host.querySelector("[data-testid=received-none]")).toBeNull();
      expect(text()).toContain(t.unavailable);
    });
  });
});
