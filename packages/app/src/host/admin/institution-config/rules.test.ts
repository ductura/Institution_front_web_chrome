import { expect, it } from "vitest";

import { changedFields, validateRules, type Rules } from "./rules";

const current: Rules = { citationStyle: "fpzg", workLanguages: ["hr", "en"], defaultWorkLanguage: "hr" };

it("points to the invalid field before publish", () => {
  expect(validateRules(current)).toBeNull();
  expect(validateRules({ ...current, workLanguages: [] })).toBe("workLanguages");
  expect(validateRules({ ...current, workLanguages: ["en"] })).toBe("defaultWorkLanguage");
});

it("compares language sets and includes every field for the first version", () => {
  expect(changedFields(undefined, current)).toEqual(["citationStyle", "workLanguages", "defaultWorkLanguage"]);
  expect(changedFields(current, { ...current, workLanguages: ["en", "hr"] })).toEqual([]);
  expect(changedFields(current, { ...current, workLanguages: ["en"], defaultWorkLanguage: "en" }))
    .toEqual(["workLanguages", "defaultWorkLanguage"]);
});
