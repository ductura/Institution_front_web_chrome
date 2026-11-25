import { describe, expect, it } from "vitest";

import { checkReason, checkRound, draftOf, EMPTY_DRAFT, fromLocalInput, inNameOrder, mayAllocate, mayEdit, mayWithdraw, nextKey, toLocalInput, type RoundDraft } from "./model";
import type { Allocation, Round } from "./read";

const good: RoundDraft = { opensAt: "2026-12-01T09:00", dueAt: "2026-12-10T18:30", reviewsPerStudent: "2", rubrics: [{ key: "kriterij-1", label: "Argument" }, { key: "kriterij-2", label: "Struktura" }] };
const ROUND: Round = { roundId: "r", opensAt: "2026-12-01T08:00:00.000Z", dueAt: "2026-12-10T17:30:00.000Z", reviewsPerStudent: 2, rubrics: [{ key: "argument", label: "Argument" }], allocatedAt: null };

describe("Zagreb wall time", () => {
  it("winter is one hour ahead of UTC, summer two", () => {
    expect(fromLocalInput("2026-12-01T09:00")).toBe("2026-12-01T08:00:00.000Z");
    expect(fromLocalInput("2026-07-01T09:00")).toBe("2026-07-01T07:00:00.000Z");
  });
  it("is the inverse of toLocalInput", () => {
    expect(toLocalInput("2026-12-10T17:30:00.000Z")).toBe("2026-12-10T18:30");
    expect(fromLocalInput(toLocalInput("2026-07-01T07:00:00.000Z"))).toBe("2026-07-01T07:00:00.000Z");
  });
  it("refuses what is no time: garbage, an impossible day and the hour that does not exist", () => {
    expect(fromLocalInput("")).toBeNull();
    expect(fromLocalInput("2026-02-30T10:00")).toBeNull();
    expect(fromLocalInput("2026-03-29T02:30")).toBeNull();
    expect(toLocalInput("nonsense")).toBe("");
  });
});

describe("checkRound", () => {
  it("builds the body of the contract: instants, a number of reviews and the rubrics with their keys", () => {
    expect(checkRound(good)).toEqual({ ok: true, value: {
      opensAt: "2026-12-01T08:00:00.000Z", dueAt: "2026-12-10T17:30:00.000Z", reviewsPerStudent: 2,
      rubrics: [{ key: "kriterij-1", label: "Argument" }, { key: "kriterij-2", label: "Struktura" }],
    } });
  });
  it("trims a label once", () => {
    expect(checkRound({ ...good, rubrics: [{ key: "kriterij-1", label: "  Argument " }] })).toMatchObject({ ok: true, value: { rubrics: [{ label: "Argument" }] } });
  });
  it.each<[string, Partial<RoundDraft>, string]>([
    ["no opening", { opensAt: "" }, "opensAt"],
    ["no deadline", { dueAt: "" }, "dueAt"],
    ["a deadline equal to the opening", { dueAt: "2026-12-01T09:00" }, "dueAt"],
    ["a deadline before the opening", { dueAt: "2026-11-30T09:00" }, "dueAt"],
    ["0 reviews", { reviewsPerStudent: "0" }, "reviewsPerStudent"],
    ["4 reviews", { reviewsPerStudent: "4" }, "reviewsPerStudent"],
    ["1.5 reviews", { reviewsPerStudent: "1.5" }, "reviewsPerStudent"],
    ["no rubric", { rubrics: [] }, "rubrics"],
    ["seven rubrics", { rubrics: Array.from({ length: 7 }, (_, i) => ({ key: `k-${i}`, label: `K${i}` })) }, "rubrics"],
    ["an empty label", { rubrics: [{ key: "k-1", label: "   " }] }, "rubrics"],
    ["a label of 121 points", { rubrics: [{ key: "k-1", label: "a".repeat(121) }] }, "rubrics"],
    ["a label with a new line", { rubrics: [{ key: "k-1", label: "a\nb" }] }, "rubrics"],
    ["a label with a bidi control", { rubrics: [{ key: "k-1", label: "a‮b" }] }, "rubrics"],
    ["two equal labels", { rubrics: [{ key: "k-1", label: "Argument" }, { key: "k-2", label: "argument" }] }, "rubrics"],
  ])("refuses %s on the field %s", (_name, change, field) => {
    expect(checkRound({ ...good, ...change })).toMatchObject({ ok: false, field });
  });
  it("accepts a label of exactly 120 points, counted in code points", () => {
    expect(checkRound({ ...good, rubrics: [{ key: "k-1", label: "😀".repeat(120) }] })).toMatchObject({ ok: true });
  });
});

describe("the draft", () => {
  it("is empty without a round and mirrors the round when there is one", () => {
    expect(draftOf(null)).toEqual(EMPTY_DRAFT);
    expect(draftOf(ROUND)).toEqual({ opensAt: "2026-12-01T09:00", dueAt: "2026-12-10T18:30", reviewsPerStudent: "2", rubrics: [{ key: "argument", label: "Argument" }] });
  });
  it("gives a new rubric the first free key of the contract's shape", () => {
    expect(nextKey([{ key: "kriterij-1", label: "a" }, { key: "kriterij-3", label: "b" }])).toBe("kriterij-2");
    expect(nextKey([])).toBe("kriterij-1");
  });
});

describe("what the round allows", () => {
  it("may be changed until it is allocated", () => {
    expect(mayEdit(null)).toBe(true);
    expect(mayEdit(ROUND)).toBe(true);
    expect(mayEdit({ ...ROUND, allocatedAt: "2026-12-02T10:00:00.000Z" })).toBe(false);
  });
  it("allocates only a set, not allocated round with enough submitted works", () => {
    const view = { round: ROUND, state: "not_allocated", submittedWorks: 4, minSubmissions: 3 };
    expect(mayAllocate(view)).toBe(true);
    expect(mayAllocate({ ...view, submittedWorks: 2 })).toBe(false);
    expect(mayAllocate({ ...view, state: "allocated" })).toBe(false);
    expect(mayAllocate({ ...view, round: null, state: "none" })).toBe(false);
  });
});

const person = (givenName: string, familyName: string) => ({ id: `${givenName}-${familyName}`, givenName, familyName });
const alloc = (reviewer: ReturnType<typeof person>, author: ReturnType<typeof person>, state: Allocation["state"] = "pending", reviewId: string | null = null): Allocation => ({ reviewId, reviewer, author, state });

describe("the overview order", () => {
  it("is by the reviewer's family and given name, then the author's, whatever the state", () => {
    const a = person("Ana", "Čović"), b = person("Marko", "Babić"), c = person("Iva", "Babić"), d = person("Petra", "Zorić");
    const rows = [alloc(d, a, "submitted", "r1"), alloc(a, b), alloc(b, d, "withdrawn", "r2"), alloc(c, a, "submitted", "r3"), alloc(c, d)];
    expect(inNameOrder(rows).map((r) => `${r.reviewer.givenName} ${r.reviewer.familyName}>${r.author.givenName}`)).toEqual([
      "Iva Babić>Ana", "Iva Babić>Petra", "Marko Babić>Petra", "Ana Čović>Marko", "Petra Zorić>Ana",
    ]);
  });
  it("does not mutate its input", () => {
    const rows = [alloc(person("B", "B"), person("A", "A")), alloc(person("A", "A"), person("B", "B"))];
    const copy = [...rows];
    inNameOrder(rows);
    expect(rows).toEqual(copy);
  });
});

describe("withdrawing", () => {
  const a = person("A", "A"), b = person("B", "B");
  it("is offered only for a sent review that has an id", () => {
    expect(mayWithdraw(alloc(a, b, "submitted", "r1"))).toBe(true);
    expect(mayWithdraw(alloc(a, b, "pending"))).toBe(false);
    expect(mayWithdraw(alloc(a, b, "withdrawn", "r1"))).toBe(false);
    expect(mayWithdraw(alloc(a, b, "submitted", null))).toBe(false);
  });
  it("needs a reason of 1 to 600 points without refused characters", () => {
    expect(checkReason("  Uvredljiv sadržaj.  ")).toEqual({ reason: "Uvredljiv sadržaj.", error: null });
    expect(checkReason(" \n ")).toEqual({ reason: null, error: "empty" });
    expect(checkReason("a".repeat(601))).toEqual({ reason: null, error: "tooLong" });
    expect(checkReason("a".repeat(600)).error).toBeNull();
    expect(checkReason("a\u0000b")).toEqual({ reason: null, error: "badChars" });
    expect(checkReason("a‮b")).toEqual({ reason: null, error: "badChars" });
    expect(checkReason("a\r\nb")).toEqual({ reason: "a\nb", error: null });
  });
});
