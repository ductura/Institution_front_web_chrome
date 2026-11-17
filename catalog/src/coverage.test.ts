import { readdirSync } from "node:fs";
import { basename } from "node:path";

import * as ui from "@ductura/ui";
import { describe, expect, it } from "vitest";

import { CATALOG_STATES, catalogGaps, componentNames } from "./coverage";
import * as screens from "../../src/components/index.ts";
import { ENTRIES, SCREEN_ENTRIES } from "./entries";

describe("every component has a catalogue entry with all five states (web.md §6 B5)", () => {
  it("the catalogue covers every component @ductura/ui exports", () => {
    expect(componentNames(ui)).toEqual(["Button", "Card", "SaveState", "TextField"]);
    expect(catalogGaps(ui, ENTRIES)).toEqual([]);
  });

  it("the catalogue covers every component src/components exports (DAN-753)", () => {
    expect(componentNames(screens)).toEqual(["AccessLogView", "AppShell", "EmptyHome", "ErrorScreen", "MyAssignments", "OutlinePanel", "RouteLoading", "StudentHome", "TeacherCourses"]);
    expect(catalogGaps(screens, SCREEN_ENTRIES)).toEqual([]);
  });

  it("src/components exports every component file, so none skips the catalogue (DAN-753)", () => {
    const root = new URL("../../src/components/", import.meta.url);
    const files = readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".tsx") && !/\.(?:test|spec)\.tsx$/.test(file) && !file.startsWith("node_modules"))
      .map((file) => basename(file, ".tsx"))
      .sort();
    expect(files).toEqual(componentNames(screens));
  });

  it("the five states are the plan's, in its order", () => {
    expect(CATALOG_STATES).toEqual(["prazno", "učitavanje", "greška", "puno", "onemogućeno"]);
  });

  const all = Object.fromEntries(CATALOG_STATES.map((s) => [s, () => null]));

  it("fails for a new component without an entry", () => {
    const exports = { ...ui, Dialog: () => null };
    expect(catalogGaps(exports, ENTRIES)).toEqual(["Dialog: nema unosa u katalogu"]);
  });

  it("fails for an entry missing a state, and for an extra state", () => {
    const { greška: _drop, ...four } = all;
    expect(catalogGaps({ Button: ui.Button }, { Button: four })).toEqual(["Button: nedostaje stanje greška"]);
    expect(catalogGaps({ Button: ui.Button }, { Button: { ...all, hover: () => null } }))
      .toEqual(["Button: nepoznato stanje hover"]);
  });

  it("fails for an entry of a component that does not exist", () => {
    expect(catalogGaps({}, { Ghost: all })).toEqual(["Ghost: unos bez komponente"]);
  });

  it("counts only capitalised functions as components", () => {
    expect(componentNames({ Button: () => null, saveStateContent: () => null, SAVE_STATES: {}, THEME_KEY: "x" }))
      .toEqual(["Button"]);
  });
});
