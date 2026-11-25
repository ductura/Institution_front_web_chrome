import { describe, expect, it } from "vitest";

import { byName, categoriesInOrder, CATEGORY_ORDER, countOf, mayFormTeam, plural } from "./model";

describe("byName", () => {
  it("orders by family name, then given name, in the Croatian alphabet, and never by anything else", () => {
    const people = [
      { givenName: "Ana", familyName: "Šarić", codePoints: 1 }, { givenName: "Zoran", familyName: "Babić", codePoints: 9_999 },
      { givenName: "Ivo", familyName: "Babić", codePoints: 50 }, { givenName: "Ema", familyName: "Čorić", codePoints: 5 },
    ];
    expect(byName(people).map((p) => `${p.familyName} ${p.givenName}`)).toEqual(["Babić Ivo", "Babić Zoran", "Čorić Ema", "Šarić Ana"]);
  });
  it("does not change its input", () => {
    const people = [{ givenName: "B", familyName: "B" }, { givenName: "A", familyName: "A" }];
    byName(people);
    expect(people[0]!.givenName).toBe("B");
  });
});

describe("categoriesInOrder", () => {
  it("is the contract's order whatever the answer's order, and a missing category is 0", () => {
    const got = categoriesInOrder([{ category: "pasted", codePoints: 7 }, { category: "written", codePoints: 3 }]);
    expect(got.map((c) => c.category)).toEqual([...CATEGORY_ORDER]);
    expect(got.map((c) => c.codePoints)).toEqual([3, 0, 7, 0, 0]);
  });
});

describe("mayFormTeam", () => {
  it("is true only for a student without a team when the students form the teams", () => {
    expect(mayFormTeam({ state: "none", formation: "student_choice", openTeams: [] })).toBe(true);
    expect(mayFormTeam({ state: "none", formation: "teacher_assigned", openTeams: [] })).toBe(false);
    expect(mayFormTeam({ state: "disabled" })).toBe(false);
    expect(mayFormTeam({ state: "member", team: { teamId: "t", members: [{ givenName: "A", familyName: "B" }] } })).toBe(false);
  });
});

describe("text helpers", () => {
  it("groups thousands the Croatian way and picks the plural form", () => {
    expect(countOf(1234)).toMatch(/^1.234$/);
    const forms = { one: "{n} član", few: "{n} člana", many: "{n} članova" };
    expect([1, 2, 5, 11, 12, 21].map((n) => plural(n, forms))).toEqual(["1 član", "2 člana", "5 članova", "11 članova", "12 članova", "21 član"]);
  });
});
