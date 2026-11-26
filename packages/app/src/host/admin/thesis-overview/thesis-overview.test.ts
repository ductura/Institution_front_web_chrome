import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PAGES, resolve } from "../../../routes";
import { STAGES, appendPage, asStageFilter, parsePage, pluralMembers, queryOf, type ThesisRow } from "./model";
import { thesisOverviewMessages } from "./messages.hr";

const row = (over: Record<string, unknown> = {}) => ({
  documentId: "d1", workType: "bachelor_thesis", mentorName: { givenName: "Ana", familyName: "Primjer" }, studentName: { givenName: "Ivo", familyName: "Izmišljeni" },
  stage: "defense_scheduled", defenseAt: "2026-12-01T09:00:00.000Z", topicState: "approved", committeeSize: 3, ...over,
});

describe("model popisa radova", () => {
  it("filtar šalje samo dopuštene faze", () => {
    for (const s of STAGES) expect(queryOf(asStageFilter(s), null)).toEqual({ stage: s });
    for (const bad of ["", "grade", "DEFENDED", "defended;drop", "__proto__"]) expect(queryOf(asStageFilter(bad), null)).toEqual({});
  });
  it("sljedeća stranica šalje kursor poslužitelja i filtar", () => {
    expect(queryOf("defended", "k1")).toEqual({ stage: "defended", after: "k1" });
    expect(queryOf("", "k1")).toEqual({ after: "k1" });
  });
  it("drugi kursor vraća ostatak bez ponavljanja", () => {
    const first = parsePage({ works: [row({ documentId: "a" }), row({ documentId: "b" })], next: "k" })!;
    const second = parsePage({ works: [row({ documentId: "b" }), row({ documentId: "c" }), row({ documentId: null })], next: null })!;
    const shown: ThesisRow[] = appendPage(first.works, second);
    expect(shown.map((r) => r.documentId)).toEqual(["a", "b", "c", null]);
  });
  it("pogrešan oblik odgovora nije prazan popis nego null", () => {
    for (const bad of [null, [], {}, { works: "x", next: null }, { works: [], next: 5 }, { works: [row({ stage: "graded" })], next: null },
      { works: [row({ committeeSize: 6 })], next: null }, { works: [row({ workType: "seminar" })], next: null }, { works: [row({ studentName: "Ivo" })], next: null }]) {
      expect(parsePage(bad)).toBeNull();
    }
    expect(parsePage({ works: [], next: null })).toEqual({ works: [], next: null });
  });
  it("imena i datum obrane mogu biti null", () => {
    const page = parsePage({ works: [row({ documentId: null, mentorName: null, studentName: null, defenseAt: null })], next: null });
    expect(page?.works[0]).toMatchObject({ documentId: null, mentorName: null, studentName: null, defenseAt: null });
  });
  it("množina članova: 1 član, 2 člana, 5 članova", () => {
    const f = thesisOverviewMessages.committeeCount;
    expect([1, 2, 4, 5].map((n) => pluralMembers(n, f))).toEqual(["1 član", "2 člana", "4 člana", "5 članova"]);
  });
  it("nema stupca ocjene ni ranga u tekstu stranice", () => {
    const keys = Object.keys(thesisOverviewMessages).filter((k) => k.startsWith("col"));
    expect(keys.join(" ")).not.toMatch(/grade|ocjen|rank/i);
    expect(Object.values(thesisOverviewMessages.stages).join(" ")).not.toMatch(/ocjen/i);
  });
});

describe("ruta /ustanova/zavrsni-radovi", () => {
  it("vidi je samo administrator; ostali odlaze na svoj početak", () => {
    expect(PAGES.some((p) => p.path === "/ustanova/zavrsni-radovi")).toBe(true);
    expect(resolve("/ustanova/zavrsni-radovi", "admin").kind).toBe("page");
    expect(resolve("/ustanova/zavrsni-radovi", "teacher")).toEqual({ kind: "redirect", to: "/nastavnik" });
    expect(resolve("/ustanova/zavrsni-radovi", "student")).toEqual({ kind: "redirect", to: "/zadaci" });
    expect(resolve("/ustanova/zavrsni-radovi", null)).toEqual({ kind: "redirect", to: "/" });
  });
  it("stranica je montirana u app/[base]", () => {
    const page = readFileSync(join(import.meta.dirname, "../../../../app/[base]/ustanova/zavrsni-radovi/page.tsx"), "utf8");
    expect(page).toContain("admin/thesis-overview/routes");
  });
});

it("nema mrežnih poziva izvan zajedničkog klijenta", () => {
  const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f));
  expect(files).toContain("ThesisOverviewPage.tsx");
  for (const file of files) {
    expect(readFileSync(join(import.meta.dirname, file), "utf8"), file).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|\/api\/v\d|<form\b/);
  }
});
