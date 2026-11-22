import { describe, expect, it } from "vitest";

import { compareOptions, roundNotice, roundOf } from "./review-model";

const request = (number: number, state: string) => ({ number, state }) as never;

describe("roundOf", () => {
  it("has no round without requests or when all are withdrawn", () => {
    expect(roundOf([])).toEqual({ kind: "none" });
    expect(roundOf([request(1, "withdrawn")])).toEqual({ kind: "none" });
  });
  it("is the teacher's turn when a version was sent", () => {
    expect(roundOf([request(1, "accepted"), request(2, "responded")])).toEqual({ kind: "teacher-turn", round: 2, waiting: 1 });
  });
  it("is the student's turn while a request is open or reopened", () => {
    expect(roundOf([request(1, "open"), request(2, "reopened")])).toEqual({ kind: "student-turn", round: 2, open: 2 });
  });
});

describe("roundNotice", () => {
  const view = { kind: "teacher-turn", round: 3, waiting: 1 } as const;
  it("shows the line to the teacher only", () => {
    expect(roundNotice(view, "teacher", "Runda {n} čeka Vaš pregled.")).toBe("Runda 3 čeka Vaš pregled.");
    expect(roundNotice(view, "student", "Runda {n} čeka Vaš pregled.")).toBeNull();
    expect(roundNotice({ kind: "none" }, "teacher", "x")).toBeNull();
  });
});

describe("compareOptions", () => {
  it("offers sent versions only, newest first", () => {
    expect(compareOptions([{ kind: "checkpoint", revision: 9 }, { kind: "submission", revision: 2 }, { kind: "submission", revision: 5 }])).toEqual([5, 2]);
  });
});
