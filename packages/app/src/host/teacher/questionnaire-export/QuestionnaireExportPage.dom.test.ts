// @vitest-environment jsdom
// WEB-V18-UPITNIK-IZVOZ: the page mounted in jsdom with a test double for the client. Invented texts only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { questionnaireExportText as t } from "./messages.hr";

const signIn = vi.hoisted(() => vi.fn());
const download = vi.hoisted(() => vi.fn());
vi.mock("../../context", () => ({ useHost: () => ({ base: "/app/web" }) }));
vi.mock("@/client/api", () => ({ createApi: vi.fn(), goToSignIn: signIn }));
vi.mock("../../../../../../src/components/editor/EarlierDraft", () => ({ downloadBlob: download }));
const { default: QuestionnaireExportPage } = await import("./QuestionnaireExportPage");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const ID = "11111111-1111-4111-8111-111111111111";
const Q1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const Q2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EXPORT = {
  schema: "questionnaire-export-v1", questionnaireId: ID,
  variables: [
    { questionId: Q1, order: 1, kind: "single", label: "Kompostirate li?", options: [{ code: "da", label: "Da" }, { code: "ne", label: "Ne" }] },
    { questionId: Q2, order: 2, kind: "text", label: "Komentar", options: [] },
  ],
  rows: [{ n: 1, values: { [Q1]: "da" } }, { n: 2, values: { [Q1]: "ne" } }],
  responseCount: 7, includesText: false,
};
const WITH_TEXT = { ...EXPORT, includesText: true, rows: [{ n: 1, values: { [Q1]: "da", [Q2]: "Izmišljeno" } }, { n: 2, values: { [Q1]: "ne" } }] };
const ok = (body: unknown): Answer => ({ ok: true, status: 200, body });
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const TITLE = ok({ id: ID, title: "Izmišljeno istraživanje: navike kompostiranja" });

function apiOf(routes: Record<string, (query: unknown) => Answer>) {
  const calls: { id: string; query: unknown }[] = [];
  const fn = vi.fn(async (id: string, input: { query?: unknown }) => { calls.push({ id, query: input.query }); return routes[id]!(input.query); });
  return { calls, call: () => fn as never };
}
const exportOf = (q: unknown) => ((q as { includeText?: string } | undefined)?.includeText === "true" ? ok(WITH_TEXT) : ok(EXPORT));

describe("QuestionnaireExportPage in the browser", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); signIn.mockClear(); download.mockClear(); });
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const render = async (call: () => never) => {
    act(() => root?.unmount());
    root = createRoot(host);
    await act(async () => { root?.render(h(QuestionnaireExportPage, { questionnaireId: ID, call })); });
  };
  const text = () => host.textContent ?? "";
  const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label)!;
  const click = async (el: Element) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); };

  it("shows the title, the number of responses and the rule of the least number", async () => {
    const { call, calls } = apiOf({ "teacher.questionnaire-export.get": exportOf, "teacher.questionnaire.get": () => TITLE });
    await render(call);
    expect(text()).toContain("Izmišljeno istraživanje: navike kompostiranja");
    expect(text()).toContain("Broj odgovora: 7.");
    expect(text()).toContain("najmanje 5 odgovora");
    expect(text()).toContain(t.noName);
    // First read never asks for free text, and free text is not in the table of the export.
    expect(calls.find((c) => c.id === "teacher.questionnaire-export.get")!.query).toEqual({});
    expect([...host.querySelectorAll("tbody th")].map((x) => x.textContent)).toEqual(["Kompostirate li?"]);
  });

  it("asks for free text only after the confirmation, and can drop it again", async () => {
    const { call, calls } = apiOf({ "teacher.questionnaire-export.get": exportOf, "teacher.questionnaire.get": () => TITLE });
    await render(call);
    expect(button(t.textLoad).disabled).toBe(true);
    await click(button(t.textLoad));
    expect(calls.filter((c) => c.id === "teacher.questionnaire-export.get")).toHaveLength(1);
    await act(async () => { host.querySelector<HTMLInputElement>("input[type=checkbox]")!.click(); });
    expect(button(t.textLoad).disabled).toBe(false);
    await click(button(t.textLoad));
    expect(calls.at(-1)!.query).toEqual({ includeText: "true" });
    expect(text()).toContain(t.textOn);
    expect([...host.querySelectorAll("tbody th")].map((x) => x.textContent)).toEqual(["Kompostirate li?", "Komentar"]);
    await click(button(t.textDrop));
    expect(text()).toContain(t.textOff);
  });

  it("keeps the export and says so when free text cannot be loaded", async () => {
    const { call } = apiOf({
      "teacher.questionnaire-export.get": (q) => ((q as { includeText?: string }).includeText === "true" ? fail(503, "unavailable") : ok(EXPORT)),
      "teacher.questionnaire.get": () => TITLE,
    });
    await render(call);
    await act(async () => { host.querySelector<HTMLInputElement>("input[type=checkbox]")!.click(); });
    await click(button(t.textLoad));
    expect(host.querySelector("[role=alert]")?.textContent).toBe(t.textLoadFailed);
    expect(text()).toContain(t.textOff);
    expect(text()).toContain("Broj odgovora: 7.");
  });

  it("offers JSON and CSV and notes success only after the file is prepared", async () => {
    const { call } = apiOf({ "teacher.questionnaire-export.get": exportOf, "teacher.questionnaire.get": () => TITLE });
    await render(call);
    expect(text()).not.toContain(t.downloaded);
    await click(button(t.downloadJson));
    await click(button(t.downloadCsv));
    expect(download.mock.calls.map((c) => c[1])).toEqual(["upitnik-izvoz.json", "upitnik-izvoz.csv"]);
    expect(text()).toContain(t.downloaded);
  });

  it("says so when the file cannot be prepared", async () => {
    download.mockImplementationOnce(() => { throw new Error("no"); });
    const { call } = apiOf({ "teacher.questionnaire-export.get": exportOf, "teacher.questionnaire.get": () => TITLE });
    await render(call);
    await click(button(t.downloadJson));
    expect(host.querySelector("[role=alert]")?.textContent).toBe(t.downloadFailed);
    expect(text()).not.toContain(t.downloaded);
  });

  it("too few responses explains the rule and offers no file", async () => {
    const { call } = apiOf({ "teacher.questionnaire-export.get": () => fail(409, "conflict"), "teacher.questionnaire.get": () => TITLE });
    await render(call);
    expect(text()).toContain(t.tooFew.title);
    expect(text()).toContain("najmanje 5 odgovora");
    expect(text()).not.toContain(t.downloadJson);
    expect(host.querySelector("[role=alert]")).toBeNull();
  });

  it("not found (another teacher's or unknown), error and loading are different states", async () => {
    const gone = apiOf({ "teacher.questionnaire-export.get": () => fail(404, "not_found"), "teacher.questionnaire.get": () => fail(404, "not_found") });
    await render(gone.call);
    expect(host.querySelector("[role=alert]")?.textContent).toBe(t.notFound.body);
    expect(text()).not.toContain(t.downloadJson);
    const broken = apiOf({ "teacher.questionnaire-export.get": () => fail(503, "unavailable"), "teacher.questionnaire.get": () => TITLE });
    await render(broken.call);
    expect(host.querySelector("[role=alert]")?.textContent).toBe(t.unavailable);
    expect(text()).not.toContain(t.notFound.title);
    expect(button(t.retry)).toBeDefined();
  });

  it("a questionnaire without free text says so and offers no confirmation", async () => {
    const plain = { ...EXPORT, variables: [EXPORT.variables[0]] };
    const { call } = apiOf({ "teacher.questionnaire-export.get": () => ok(plain), "teacher.questionnaire.get": () => TITLE });
    await render(call);
    expect(text()).toContain(t.textNone);
    expect(host.querySelector("input[type=checkbox]")).toBeNull();
  });

  it("sends a signed-out teacher to sign in", async () => {
    const { call } = apiOf({ "teacher.questionnaire-export.get": () => fail(401, "unauthorized"), "teacher.questionnaire.get": () => fail(401, "unauthorized") });
    await render(call);
    expect(signIn).toHaveBeenCalled();
  });
});
