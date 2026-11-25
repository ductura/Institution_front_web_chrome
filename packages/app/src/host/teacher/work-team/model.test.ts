import { describe, expect, it } from "vitest";

import { checkSetting, draftOf, hasRoom, membersByName, sameSetting, DEFAULT_SETTING } from "./model";

describe("checkSetting", () => {
  const draft = draftOf({ enabled: true, minSize: 2, maxSize: 4, formation: "teacher_assigned" });
  it("accepts a setting the contract allows and turns the sizes into numbers", () => {
    expect(checkSetting(draft)).toEqual({ ok: true, value: { enabled: true, minSize: 2, maxSize: 4, formation: "teacher_assigned" } });
  });
  it("refuses a minimum above the maximum (the server refuses it too)", () => {
    expect(checkSetting({ ...draft, minSize: "5", maxSize: "3" })).toEqual({ ok: false, field: "minSize", error: "minAboveMax" });
  });
  it.each(["1", "7", "2.5", "", "abc", "-3"])("refuses the size %j", (bad) => {
    expect(checkSetting({ ...draft, minSize: bad })).toEqual({ ok: false, field: "minSize", error: "sizeInvalid" });
    expect(checkSetting({ ...draft, maxSize: bad })).toEqual({ ok: false, field: "maxSize", error: "sizeInvalid" });
  });
  it("reads an absent setting as the contract does: off, 2 to 6, students choose", () => {
    expect(DEFAULT_SETTING).toEqual({ enabled: false, minSize: 2, maxSize: 6, formation: "student_choice" });
    expect(sameSetting(DEFAULT_SETTING, { ...DEFAULT_SETTING })).toBe(true);
    expect(sameSetting(DEFAULT_SETTING, { ...DEFAULT_SETTING, maxSize: 5 })).toBe(false);
  });
});

describe("lists", () => {
  it("members are by name whatever their state", () => {
    const members = [
      { studentId: "2", givenName: "Ana", familyName: "Žagar", workState: "submitted" as const },
      { studentId: "1", givenName: "Ivo", familyName: "Babić", workState: "not_started" as const },
    ];
    expect(membersByName(members).map((m) => m.studentId)).toEqual(["1", "2"]);
  });
  it("a team has room while it is below the maximum", () => {
    const setting = { ...DEFAULT_SETTING, maxSize: 2 };
    expect(hasRoom({ members: [1] }, setting)).toBe(true);
    expect(hasRoom({ members: [1, 2] }, setting)).toBe(false);
  });
});
