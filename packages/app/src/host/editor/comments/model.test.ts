import { describe, expect, it } from "vitest";

import { FAKE_COMMENTS, fakeCommentsPort } from "./fake-port";
import {
  abilities, applyFilters, byRound, countsFor, isNew, openForPrint, printText, repeated, safely, showFilters, statusOf, turnOf,
  usableSelection, withComment, type Comment,
} from "./model";

const [must, question, praise] = FAKE_COMMENTS as [Comment, Comment, Comment];
const W = "w1";

describe("whose move it is", () => {
  it("is the student's after a mentor comment, the mentor's after a student reply, nobody's for praise", () => {
    expect(turnOf(must)).toBe("student");
    expect(turnOf(question)).toBe("mentor");
    expect(turnOf(praise)).toBeNull();
  });
  it("a resolved must comment waits for the mentor until confirmed; other kinds close", () => {
    expect(turnOf({ ...must, resolved: true })).toBe("mentor");
    expect(turnOf({ ...must, resolved: true, confirmed: true })).toBeNull();
    expect(turnOf({ ...question, resolved: true })).toBeNull();
    expect(statusOf({ ...must, resolved: true })).toBe("riješeno, čeka potvrdu mentora");
    expect(statusOf({ ...must, resolved: true, confirmed: true })).toBe("riješeno, potvrdio mentor");
  });
  it("counts and filters per viewer", () => {
    const all = [must, question, praise];
    expect(countsFor(all, "student", 0)).toEqual({ mine: 1, other: 1, fresh: 3 });
    expect(applyFilters(all, "student", 0, "mine", null, null).map((c) => c.id)).toEqual(["c1"]);
    expect(applyFilters(all, "teacher", 0, "mine", null, null).map((c) => c.id)).toEqual(["c2"]);
    expect(applyFilters(all, "student", 0, null, "q", null).map((c) => c.id)).toEqual(["c2"]);
    expect(applyFilters(all, "student", 0, "mine", "q", "c2").map((c) => c.id)).toEqual(["c2"]);
    expect(isNew(question, "student", 5000)).toBe(false);
  });
  it("shows the filter row only with four comments, a filter on, or something new", () => {
    expect(showFilters(3, null, null, 0)).toBe(false);
    expect(showFilters(4, null, null, 0)).toBe(true);
    expect(showFilters(1, "mine", null, 0)).toBe(true);
    expect(showFilters(1, null, null, 2)).toBe(true);
  });
});

describe("abilities", () => {
  it("the collaborator only reads and comments", () => {
    const a = abilities(must, "collaborator", false);
    expect(a).toMatchObject({ reply: true, resolve: false, reopen: false, confirm: false, quick: false, addPlace: false, templates: false });
  });
  it("only the student gets quick replies, only the mentor confirms or adds places", () => {
    expect(abilities(must, "student", false).quick).toBe(true);
    expect(abilities(must, "teacher", false)).toMatchObject({ quick: false, addPlace: true });
    expect(abilities({ ...must, resolved: true }, "teacher", false).confirm).toBe(true);
    expect(abilities({ ...must, resolved: true }, "student", false).confirm).toBe(false);
  });
  it("nothing can be written once the work is submitted", () => {
    expect(Object.values(abilities(must, "teacher", true)).some(Boolean)).toBe(false);
  });
});

describe("selection, repeats, rounds and print", () => {
  it("a selection is good for two minutes inside one paragraph", () => {
    const s = { from: 1, to: 5, quote: "tekst", at: 1000, sameParagraph: true };
    expect(usableSelection(s, 2000, 50)).toMatchObject({ from: 1, to: 5 });
    expect(usableSelection(s, 200000, 50)).toBeNull();
    expect(usableSelection({ ...s, sameParagraph: false }, 2000, 50)).toBeNull();
    expect(usableSelection({ ...s, to: 99 }, 2000, 50)).toBeNull();
    expect(usableSelection(null, 2000, 50)).toBeNull();
  });
  it("groups a remark given three times", () => {
    const three = [1, 2, 3].map((i) => ({ ...must, id: `x${i}`, resolved: i === 1 }));
    expect(repeated(three)).toEqual([{ key: "t1", text: must.text, open: 2, total: 3 }]);
    expect(repeated([must, must])).toEqual([]);
  });
  it("lists rounds newest first and prints only open comments in text order", () => {
    expect(byRound([must, { ...question, round: 2 }], 2).map((r) => r.round)).toEqual([2, 1]);
    expect(openForPrint([question, must, praise]).map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(printText([must])).toContain("Većina studenata radi noću.");
  });
});

describe("server answers (B-6)", () => {
  it("only an ok answer changes the list", () => {
    expect(withComment([must], { kind: "rejected" })).toEqual([must]);
    expect(withComment([must], { kind: "ok", comment: { ...must, resolved: true } })[0]!.resolved).toBe(true);
  });
  it("an answer that does not repeat the write is unknown", async () => {
    const port = fakeCommentsPort();
    const ok = await safely(() => port.setResolved(W, "c1", true), (c) => c.resolved);
    expect(ok.kind).toBe("ok");
    expect((await safely(() => port.setResolved(W, "c1", false), (c) => c.resolved)).kind).toBe("unknown");
    expect((await safely(() => Promise.reject(new Error("x")), () => true)).kind).toBe("unknown");
  });
  it("closing a must comment as a student waits for the mentor, who confirms or sends back", async () => {
    const port = fakeCommentsPort(FAKE_COMMENTS, "student");
    await port.setResolved(W, "c1", true);
    expect(turnOf(port.all().find((c) => c.id === "c1")!)).toBe("mentor");
    await port.confirm(W, "c1");
    expect(turnOf(port.all().find((c) => c.id === "c1")!)).toBeNull();
    await port.sendBack(W, "c1", "Još stranica.");
    expect(port.all().find((c) => c.id === "c1")).toMatchObject({ resolved: false, confirmed: null });
  });
});
