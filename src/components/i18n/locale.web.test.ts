import { describe, expect, it } from "vitest";

import { DEFAULT_INTERFACE_LOCALE, languageOfTag, parseInterfaceLocale } from "./locale";

// Web-only cases (DAN-872-1), kept apart so locale.test.ts stays the verbatim
// Ductus port: line endings, other whitespace and control characters,
// inherited keys and path separators next to a tag are not one tag.
describe("languageOfTag, classes of input added in the web", () => {
  const inheritsHr = Object.create({ toString: () => "hr", valueOf: () => "hr" }) as object;

  it.each([
    ["hr\r\n"],
    ["hr\r"],
    ["\r\nhr"],
    ["hr\t"],
    ["\thr"],
    ["hr\tHR"],
    ["\u00A0hr"],
    ["hr\u00A0"],
    ["hr\u00A0HR"],
    ["hr\u007F"],
    ["\u007Fhr"],
    ["isPrototypeOf"],
    ["__defineGetter__"],
    ["propertyIsEnumerable"],
    ["C:\\hr"],
    ["hr\\HR"],
    ["hr/HR"],
    [inheritsHr],
    [{ valueOf: () => "hr" }],
  ])("reads %j as no tag and gives the default", (value) => {
    expect(languageOfTag(value)).toBeUndefined();
    expect(parseInterfaceLocale(value)).toBe(DEFAULT_INTERFACE_LOCALE);
  });

  // Well-formed tags that are also keys of Object.prototype have no catalogue.
  it.each([
    ["valueOf", "valueof"],
    ["VALUEOF", "valueof"],
  ])("reads %j as %s and gives the default", (value, language) => {
    expect(languageOfTag(value)).toBe(language);
    expect(parseInterfaceLocale(value)).toBe(DEFAULT_INTERFACE_LOCALE);
  });
});
