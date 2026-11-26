// @vitest-environment jsdom
// WEB-V18-UPITNIK-ISPUNJAVANJE: the page mounted in jsdom with a test double for the client. Invented texts only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { questionnaireText as t } from "./messages.hr";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("../../context", () => ({ useHost: () => ({ base: "/app/web" }) }));
vi.mock("@/client/api", () => ({ createApi: vi.fn(), goToSignIn: signIn }));
const { default: QuestionnairePage } = await import("./QuestionnairePage");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const COURSE = "33333333-3333-4333-8333-333333333333";
const ROW_A = { id: A, courseId: COURSE, title: "Navike kompostiranja", participated: false };
const ROW_B = { id: B, courseId: COURSE, title: "Navike recikliranja", participated: true };
const FORM = {
  ...ROW_A,
  questions: [
    { id: "q1", order: 1, kind: "single", text: "Kompostirate li?", options: [{ code: "da", label: "Da" }, { code: "ne", label: "Ne" }], scale: null },
    { id: "q2", order: 2, kind: "text", text: "Komentar", options: null, scale: null },
  ],
};
const ok = (body: unknown, status = 200): Answer => ({ ok: true, status, body });
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });

function apiOf(routes: Record<string, (n: number) => Answer>) {
  const calls: { id: string; input: { body?: unknown; params?: unknown } }[] = [];
  const counts: Record<string, number> = {};
  const fn = vi.fn(async (id: string, input: { body?: unknown }) => {
    calls.push({ id, input });
    counts[id] = (counts[id] ?? 0) + 1;
    return routes[id]!(counts[id]!);
  });
  return { calls, call: () => fn as never };
}

describe("QuestionnairePage in the browser", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); signIn.mockClear(); });
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const render = async (call: () => never) => {
    act(() => root?.unmount());
    root = createRoot(host);
    await act(async () => { root?.render(h(QuestionnairePage, { call })); });
  };
  const text = () => host.textContent ?? "";
  const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label || b.getAttribute("aria-label") === label)!;
  const click = async (el: Element) => { await act(async () => { (el as HTMLElement).click(); }); };
  const pick = async (value: string) => { await click(host.querySelector(`input[type=radio][value="${value}"]`)!); };
  const submit = async () => { await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); };

  it("keeps the anonymity notice on the page in every state", async () => {
    await render(apiOf({ "student.questionnaires.get": () => fail(503, "unavailable") }).call);
    expect(text()).toContain(t.anonymityNotice);
    await render(apiOf({ "student.questionnaires.get": () => ok({ questionnaires: [] }) }).call);
    expect(text()).toContain(t.anonymityNotice);
  });

  it("an error is not an empty list, and an empty list says so", async () => {
    await render(apiOf({ "student.questionnaires.get": () => fail(503, "unavailable") }).call);
    expect(text()).toContain(t.unavailable);
    expect(text()).not.toContain(t.noQuestionnaires.title);
    await render(apiOf({ "student.questionnaires.get": () => ok({ questionnaires: [] }) }).call);
    expect(text()).toContain(t.noQuestionnaires.title);
  });

  it("sends the user to sign-in on 401", async () => {
    await render(apiOf({ "student.questionnaires.get": () => fail(401, "unauthorized") }).call);
    expect(signIn).toHaveBeenCalled();
  });

  it("marks a filled questionnaire and offers no form for it", async () => {
    await render(apiOf({ "student.questionnaires.get": () => ok({ questionnaires: [ROW_B] }) }).call);
    expect(text()).toContain(t.filled);
    expect(button(t.fillAria.replace("{title}", ROW_B.title))).toBeUndefined();
  });

  it("shows success only after the server's answer, and posts the typed sheet", async () => {
    let filled = false;
    const { call, calls } = apiOf({
      "student.questionnaires.get": () => ok({ questionnaires: [{ ...ROW_A, participated: filled }] }),
      "student.questionnaire.get": () => ok(FORM),
      "student.questionnaire-responses.post": () => { filled = true; return ok(undefined, 204); },
    });
    await render(call);
    await click(button(t.fillAria.replace("{title}", ROW_A.title)));
    await pick("da");
    expect(text()).not.toContain(t.saved);
    await submit();
    expect(calls.find((c) => c.id === "student.questionnaire-responses.post")!.input).toMatchObject({ params: { id: A }, body: { answers: [{ questionId: "q1", value: "da" }] } });
    expect(text()).toContain(t.saved);
    expect(text()).toContain(t.filled);
    expect(host.querySelector("form")).toBeNull();
  });

  it("an empty sheet is refused on the page and never sent", async () => {
    const { call, calls } = apiOf({
      "student.questionnaires.get": () => ok({ questionnaires: [ROW_A] }), "student.questionnaire.get": () => ok(FORM),
      "student.questionnaire-responses.post": () => ok(undefined, 204),
    });
    await render(call);
    await click(button(t.fillAria.replace("{title}", ROW_A.title)));
    await submit();
    expect(text()).toContain(t.errors.none);
    expect(calls.some((c) => c.id === "student.questionnaire-responses.post")).toBe(false);
    expect(text()).not.toContain(t.saved);
  });

  it("a second sheet (409) is not a success: it says already filled and reloads the list", async () => {
    const { call } = apiOf({
      "student.questionnaires.get": (n) => ok({ questionnaires: [{ ...ROW_A, participated: n > 1 }] }), "student.questionnaire.get": () => ok(FORM),
      "student.questionnaire-responses.post": () => fail(409, "conflict"),
    });
    await render(call);
    await click(button(t.fillAria.replace("{title}", ROW_A.title)));
    await pick("ne");
    await submit();
    expect(text()).toContain(t.conflict);
    expect(text()).not.toContain(t.saved);
    expect(text()).toContain(t.filled);
  });

  it("a closed questionnaire (404 on the form) is gone, not an empty form", async () => {
    const { call } = apiOf({ "student.questionnaires.get": () => ok({ questionnaires: [ROW_A] }), "student.questionnaire.get": () => fail(404, "not_found") });
    await render(call);
    await click(button(t.fillAria.replace("{title}", ROW_A.title)));
    expect(text()).toContain(t.gone);
    expect(host.querySelector("form")).toBeNull();
  });

  it("a lost answer is unknown: no success, the form stays and can send again", async () => {
    const { call } = apiOf({
      "student.questionnaires.get": () => ok({ questionnaires: [ROW_A] }), "student.questionnaire.get": () => ok(FORM),
      "student.questionnaire-responses.post": () => fail(503, "unavailable"),
    });
    await render(call);
    await click(button(t.fillAria.replace("{title}", ROW_A.title)));
    await pick("da");
    await submit();
    expect(text()).toContain(t.unknown);
    expect(text()).not.toContain(t.saved);
    expect(host.querySelector("form")).not.toBeNull();
  });

  it("a lost answer that the server did keep is shown as saved after the re-read", async () => {
    const { call } = apiOf({
      "student.questionnaires.get": (n) => ok({ questionnaires: [{ ...ROW_A, participated: n > 1 }] }), "student.questionnaire.get": () => ok(FORM),
      "student.questionnaire-responses.post": () => fail(503, "unavailable"),
    });
    await render(call);
    await click(button(t.fillAria.replace("{title}", ROW_A.title)));
    await pick("da");
    await submit();
    expect(text()).toContain(t.saved);
    expect(host.querySelector("form")).toBeNull();
  });
});
