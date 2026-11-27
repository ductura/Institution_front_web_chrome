import { afterEach, describe, expect, it } from "vitest";

import { fullNamesKey, listAbbreviations, readFullNames, resetFullNamesForTest, writeFullName } from "./abbreviations";

// ED-79: the prototype's list (more2.js `abbrs`). Every text and name is invented.
describe("ED-79 the list of abbreviations", () => {
  it("guesses the full name from the words whose initials spell it, skipping small words", () => {
    expect(listAbbreviations(["Izmišljena Europska unija (EU) i Ured za izmišljene poslove (UIP) rade zajedno."])).toEqual([
      { abbreviation: "EU", full: "Europska unija", guessed: true },
      { abbreviation: "UIP", full: "Ured za izmišljene poslove", guessed: true },
    ]);
  });

  it("orders the list alphabetically in Croatian and counts each abbreviation once", () => {
    const list = listAbbreviations(["Prvi (ŽB) i drugi (ČA).", "Opet (ČA)."]);
    expect(list.map((a) => a.abbreviation)).toEqual(["ČA", "ŽB"]);
  });

  it("keeps a name found later when the first use had none", () => {
    expect(listAbbreviations(["Samo (IZM) bez naziva.", "Izmišljeni Zavod Mjerenja (IZM) kasnije."])).toEqual([
      { abbreviation: "IZM", full: "Izmišljeni Zavod Mjerenja", guessed: true },
    ]);
  });

  it("leaves the name empty when nothing spells it, and ignores lower case and one letter", () => {
    expect(listAbbreviations(["Nešto posve drugo (NATO), (a) i (B)."])).toEqual([{ abbreviation: "NATO", full: "", guessed: true }]);
  });

  it("a name the student wrote wins over the guess", () => {
    expect(listAbbreviations(["Izmišljena Europska unija (EU)."], { EU: "Europska unija, izmišljena" })).toEqual([
      { abbreviation: "EU", full: "Europska unija, izmišljena", guessed: false },
    ]);
  });
});

describe("ED-79 the names the student writes", () => {
  afterEach(() => resetFullNamesForTest());
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };

  it("keeps a name per person and work, and an empty one forgets it", () => {
    const store = memory();
    const key = fullNamesKey("a".repeat(64), "doc-1");
    writeFullName(key, "EU", "  Europska unija ", () => store);
    expect(readFullNames(key, () => store)).toEqual({ EU: "Europska unija" });
    resetFullNamesForTest();
    expect(readFullNames(key, () => store)).toEqual({ EU: "Europska unija" });
    expect(readFullNames(fullNamesKey("b".repeat(64), "doc-1"), () => store)).toEqual({});
    writeFullName(key, "EU", "  ", () => store);
    resetFullNamesForTest();
    expect(readFullNames(key, () => store)).toEqual({});
  });

  it("gives the same object until it changes, and survives blocked or broken storage", () => {
    const store = memory();
    const key = fullNamesKey("c".repeat(64), "doc-2");
    expect(readFullNames(key, () => store)).toBe(readFullNames(key, () => store));
    store.setItem(fullNamesKey("d".repeat(64), "doc-3"), "[1,2]");
    expect(readFullNames(fullNamesKey("d".repeat(64), "doc-3"), () => store)).toEqual({});
    const blocked = () => { throw new Error("blokirano"); };
    expect(writeFullName(fullNamesKey("e".repeat(64), "doc-4"), "EU", "Europska unija", blocked)).toEqual({ EU: "Europska unija" });
  });
});
