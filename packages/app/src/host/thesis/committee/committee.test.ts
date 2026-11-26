// @vitest-environment jsdom
// WEB-V16-POVJERENSTVO: the rules of the list, the read/write over the contract, and the section and the editor as a
// person meets them. Invented data only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkCommittee, writeCommittee } from "./actions";
import { CommitteeEditor } from "./CommitteeEditor";
import { readCandidates, readCommittee } from "./read";
import { CommitteeSection, readSection } from "./section";
import { registeredSections } from "../sections";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const ok = (body: unknown): Answer => ({ ok: true, status: 200, body });
const DOC = "izmisljeni-dokument-1";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const member = (n: number, role: "chair" | "member", name: [string, string] | null = ["Ime" + n, "Prezime" + n]) =>
  ({ userId: id(n), name: name === null ? null : { givenName: name[0], familyName: name[1] }, role });
const committee = (members: unknown[]) => ({ members, changedAt: "2026-12-01T09:00:00.000Z", changedByPart: "faculty" });
const teachers = (n: number) => ({ pending: [], confirmed: Array.from({ length: n }, (_, i) => ({ personId: id(i + 1), name: { givenName: "Ime" + (i + 1), familyName: "Prezime" + (i + 1) }, confirmedAt: "2026-11-01T09:00:00Z", forReview: false })) });
const draft = (...roles: Array<"chair" | "member">) => roles.map((role, i) => ({ userId: id(i + 1), role }));

describe("checkCommittee", () => {
  it("accepts an empty list, one chair, and exactly five members", () => {
    expect(checkCommittee([])).toBeNull();
    expect(checkCommittee(draft("chair", "member", "member", "member", "member"))).toBeNull();
  });
  it("refuses more than one chair and more than five members", () => {
    expect(checkCommittee(draft("chair", "chair"))).toBe("manyChairs");
    expect(checkCommittee(draft("member", "member", "member", "member", "member", "member"))).toBe("tooMany");
  });
  it("refuses the same person twice", () => {
    expect(checkCommittee([{ userId: id(1), role: "chair" }, { userId: id(1), role: "member" }])).toBe("duplicate");
  });
});

describe("readCommittee / readCandidates", () => {
  it("reads by the work id", async () => {
    const call = vi.fn(async () => ok(committee([member(1, "chair")])));
    expect(await readCommittee(call as never, DOC)).toMatchObject({ kind: "ready", value: { members: [{ role: "chair" }] } });
    expect(call).toHaveBeenCalledWith("work.thesis-committee.get", { params: { documentId: DOC }, query: undefined, body: undefined });
  });
  it("404 is its own state; 503, a throw and a wrong shape are unavailable, never an empty committee", async () => {
    const api = (a: Answer) => vi.fn(async () => a) as never;
    expect(await readCommittee(api(fail(404, "not_found")), DOC)).toEqual({ kind: "notFound" });
    expect(await readCommittee(api(fail(503, "unavailable")), DOC)).toEqual({ kind: "unavailable" });
    expect(await readCommittee(vi.fn(async () => { throw new TypeError("network"); }) as never, DOC)).toEqual({ kind: "unavailable" });
    expect(await readCommittee(api(ok({ members: "nema" })), DOC)).toEqual({ kind: "unavailable" });
    expect(await readCommittee(api(ok(committee([member(1, "chair"), member(2, "member"), member(3, "member"), member(4, "member"), member(5, "member"), member(6, "member")]))), DOC)).toEqual({ kind: "unavailable" });
  });
  it("the candidates are the confirmed teachers; a failure is null, not an empty list", async () => {
    expect(await readCandidates(vi.fn(async () => ok(teachers(2))) as never)).toHaveLength(2);
    expect(await readCandidates(vi.fn(async () => fail(403, "forbidden")) as never)).toBeNull();
  });
});

describe("writeCommittee", () => {
  const api = (a: Answer) => vi.fn(async () => a);
  it("sends nothing for a list that breaks a rule, or equals the one in force", async () => {
    const call = api(ok(committee([])));
    expect(await writeCommittee(call as never, DOC, [], draft("chair", "chair"))).toEqual({ kind: "problem", problem: "manyChairs" });
    expect(await writeCommittee(call as never, DOC, draft("chair", "member"), draft("chair", "member"))).toEqual({ kind: "unchanged" });
    expect(call).not.toHaveBeenCalled();
  });
  it("replaces the whole list and takes the result from the answer", async () => {
    const call = api(ok(committee([member(1, "chair"), member(2, "member")])));
    const r = await writeCommittee(call as never, DOC, [], draft("chair", "member"));
    expect(r).toMatchObject({ kind: "saved", members: [{ userId: id(1) }, { userId: id(2) }] });
    expect(call).toHaveBeenCalledWith("work.thesis-committee.put", { params: { documentId: DOC }, query: undefined, body: { members: draft("chair", "member") } });
  });
  it("tells the refusals apart; 503 is an unknown outcome", async () => {
    const run = (a: Answer) => writeCommittee(api(a) as never, DOC, [], draft("member"));
    expect(await run(fail(403, "forbidden"))).toEqual({ kind: "forbidden" });
    expect(await run(fail(404, "not_found"))).toEqual({ kind: "notFound" });
    expect(await run(fail(422, "invalid_input"))).toEqual({ kind: "invalid" });
    expect(await run(fail(401, "unauthorized"))).toEqual({ kind: "signedOut" });
    expect(await run(fail(503, "unavailable"))).toEqual({ kind: "unknown" });
    expect(await run(ok({ members: 3 }))).toEqual({ kind: "unknown" });
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
const change = (el: Element, value: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("change", { bubbles: true }));
});
const submit = (host: HTMLElement) => act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });

describe("the section (student and mentor)", () => {
  it("is registered in the panel", () => {
    expect(registeredSections.map((s) => s.id)).toContain("committee");
  });
  it("shows the chair first with names and roles, a note that the text is not shared, and no control", async () => {
    const value = { members: [member(2, "member"), member(1, "chair"), member(3, "member", null)], changedAt: null, changedByPart: null };
    for (const role of ["student", "mentor"] as const) {
      const host = await mount(h(CommitteeSection, { documentId: DOC, role, value: value as never, reload: () => {} }));
      const items = [...host.querySelectorAll("li")].map((li) => li.textContent);
      expect(items[0]).toBe("Ime1 Prezime1 (Predsjednik)");
      expect(items).toHaveLength(3);
      expect(host.textContent).toContain("ne dobiva pristup tekstu rada");
      expect(host.querySelector("form, select, input, button")).toBeNull();
      act(() => root?.unmount()); root = null; document.body.innerHTML = "";
    }
  });
  it("an empty committee says so", async () => {
    const host = await mount(h(CommitteeSection, { documentId: DOC, role: "student", value: { members: [], changedAt: null, changedByPart: null } as never, reload: () => {} }));
    expect(host.textContent).toContain("Povjerenstvo još nije imenovano.");
  });
  it("readSection: another's work (404) hides it, 503 is unavailable", async () => {
    expect(await readSection(DOC, vi.fn(async () => fail(404, "not_found")) as never)).toEqual({ kind: "notFound" });
    expect(await readSection(DOC, vi.fn(async () => fail(503, "unavailable")) as never)).toEqual({ kind: "unavailable" });
  });
});

describe("CommitteeEditor (administrator)", () => {
  const editor = (value: unknown[], call: unknown, extra: Record<string, unknown> = {}) =>
    mount(h(CommitteeEditor, { documentId: DOC, value: value as never, call: (() => call) as never, ...extra }));
  const base = (put: unknown) => vi.fn(async (op: string) => (op === "institution.teacher-roles.get" ? ok(teachers(7)) : (put as Answer)));

  it("adds a member from the confirmed teachers and saves the whole list; success only after the answer", async () => {
    const call = base(ok(committee([member(1, "member")])));
    const host = await editor([], call);
    await change(host.querySelector('select[name="add"]')!, id(1));
    await submit(host);
    expect(call).toHaveBeenCalledWith("work.thesis-committee.put", { params: { documentId: DOC }, query: undefined, body: { members: [{ userId: id(1), role: "member" }] } });
    expect(host.querySelector('[data-testid="note"]')?.textContent).toBe("Povjerenstvo je spremljeno.");
  });
  it("two chairs are refused before any request", async () => {
    const call = base(ok(committee([])));
    const host = await editor([member(1, "chair"), member(2, "member")], call);
    await change(host.querySelector('select[name="role-' + id(2) + '"]')!, "chair");
    await submit(host);
    expect(call).not.toHaveBeenCalledWith("work.thesis-committee.put", expect.anything());
    expect(host.textContent).toContain("najviše jednog predsjednika");
  });
  it("a sixth member cannot be added and a list of six is never sent", async () => {
    const five = [1, 2, 3, 4, 5].map((n) => member(n, n === 1 ? "chair" : "member"));
    const call = base(ok(committee([])));
    const host = await editor(five, call);
    expect(host.querySelector('select[name="add"]')).toBeNull();
    const six = [...five, member(6, "member")];
    const host2 = await editor(six, call);
    await submit(host2.parentElement!.lastElementChild as HTMLElement);
    expect(call).not.toHaveBeenCalledWith("work.thesis-committee.put", expect.anything());
  });
  it("the same list again sends nothing and says so", async () => {
    const call = base(ok(committee([])));
    const host = await editor([member(1, "chair")], call);
    await submit(host);
    expect(call).not.toHaveBeenCalledWith("work.thesis-committee.put", expect.anything());
    expect(host.querySelector('[data-testid="note"]')?.textContent).toContain("ništa nije spremljeno");
  });
  it("403, 422 and an unknown outcome show their own messages, never 'spremljeno'", async () => {
    for (const [a, text] of [[fail(403, "forbidden"), "samo administrator"], [fail(422, "invalid_input"), "potvrđeni nastavnici"], [fail(503, "unavailable"), "Nije poznato"]] as const) {
      const host = await editor([], base(a));
      await change(host.querySelector('select[name="add"]')!, id(2));
      await submit(host);
      expect(host.querySelector('[role="alert"]')?.textContent).toContain(text);
      expect(host.querySelector('[data-testid="note"]')?.getAttribute("role")).toBe("alert");
      act(() => root?.unmount()); root = null; document.body.innerHTML = "";
    }
  });
  it("the fields are locked while the request runs, so a later edit cannot be overwritten by the answer", async () => {
    let release: (a: Answer) => void = () => {};
    const call = vi.fn((op: string) => (op === "institution.teacher-roles.get" ? Promise.resolve(ok(teachers(7))) : new Promise<Answer>((r) => { release = r; })));
    const host = await editor([], call);
    await change(host.querySelector('select[name="add"]')!, id(1));
    await submit(host);
    expect((host.querySelector('[data-testid="editor-fields"]') as HTMLFieldSetElement).disabled).toBe(true);
    await act(async () => { release(ok(committee([member(1, "member")]))); });
    expect((host.querySelector('[data-testid="editor-fields"]') as HTMLFieldSetElement).disabled).toBe(false);
  });
  it("404 on save tells the caller the work is gone", async () => {
    const onNotFound = vi.fn();
    const host = await editor([], base(fail(404, "not_found")), { onNotFound });
    await change(host.querySelector('select[name="add"]')!, id(2));
    await submit(host);
    expect(onNotFound).toHaveBeenCalledOnce();
  });
  it("an unavailable teacher list is an error, not 'no teachers'", async () => {
    const host = await editor([], vi.fn(async () => fail(503, "unavailable")));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Popis nastavnika trenutačno nije dostupan");
    expect(host.textContent).not.toContain("Nema potvrđenih nastavnika");
  });
});
