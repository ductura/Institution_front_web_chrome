import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PAGES, resolve } from "../../../routes";
import {
  MAX_HINT, MAX_SECTIONS, changed, checkDraft, draftOf, emptySection, isValid, isWorkType, move, sectionsOf, withField, type Draft, type TemplateVersion,
} from "./model";

const version: TemplateVersion = {
  version: 2, effectiveFrom: "2026-10-01T10:00:00.000Z", titlePage: ["title", "author"], citationStyle: "fpzg",
  sections: [{ title: "Uvod", hint: "Cilj i pitanje rada" }, { title: "Zaključak", hint: "" }],
};
const rows = (n: number): Draft => ({ titlePage: [], sections: Array.from({ length: n }, (_, i) => ({ ...emptySection(), title: `Odjeljak ${i + 1}` })) });

describe("model predloška rada", () => {
  it("odbija više od 30 odjeljaka prije slanja", () => {
    expect(isValid(checkDraft(rows(MAX_SECTIONS)))).toBe(true);
    expect(checkDraft(rows(MAX_SECTIONS + 1)).form).toBe("tooMany");
  });
  it("odbija prazan i predug naziv i predugu napomenu; prazna napomena je dopuštena", () => {
    const s = emptySection();
    const one = (part: object) => Object.values(checkDraft({ titlePage: [], sections: [{ ...s, title: "x", ...part }] }).rows)[0];
    expect(one({ title: "  " })?.title).toBe("titleRequired");
    expect(one({ title: "x".repeat(121) })?.title).toBe("titleTooLong");
    expect(one({ hint: "x".repeat(MAX_HINT + 1) })?.hint).toBe("hintTooLong");
    expect(one({ title: "x".repeat(120), hint: "x".repeat(MAX_HINT) })).toBeUndefined();
  });
  it("tijelo zahtjeva skraćuje razmake i čuva redoslijed", () => {
    const d = draftOf(version);
    expect(sectionsOf({ ...d, sections: d.sections.map((x) => ({ ...x, title: ` ${x.title} `, hint: ` ${x.hint} `.trimEnd() })) })).toEqual(version.sections);
  });
  it("polja naslovne uvijek idu redom popisa", () => {
    expect(withField(["author", "title"], "course", true)).toEqual(["title", "author", "course"]);
    expect(withField(["title", "author"], "title", false)).toEqual(["author"]);
  });
  it("prepoznaje promjenu, uključujući redoslijed i naslovnu", () => {
    const d = draftOf(version);
    expect(changed(version, d)).toBe(false);
    expect(changed(version, { ...d, titlePage: ["title"] })).toBe(true);
    expect(changed(version, { ...d, sections: move(d.sections, 0, 1) })).toBe(true);
    expect(changed(null, draftOf(null))).toBe(false);
  });
  it("pomak izvan granica ne mijenja popis", () => {
    expect(move([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(move([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
    expect(move([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
  });
  it("vrsta rada je samo iz zatvorenog popisa", () => {
    expect(isWorkType("essay")).toBe(true);
    for (const bad of ["", "thesis", "ESSAY", undefined]) expect(isWorkType(bad)).toBe(false);
  });
});

describe("ruta /ustanova/predlozak-rada", () => {
  it("vidi je samo administrator; ostali odlaze na svoj početak", () => {
    expect(PAGES.some((p) => p.path === "/ustanova/predlozak-rada")).toBe(true);
    expect(resolve("/ustanova/predlozak-rada", "admin").kind).toBe("page");
    expect(resolve("/ustanova/predlozak-rada", "teacher")).toEqual({ kind: "redirect", to: "/nastavnik" });
    expect(resolve("/ustanova/predlozak-rada", "student")).toEqual({ kind: "redirect", to: "/zadaci" });
    expect(resolve("/ustanova/predlozak-rada", null)).toEqual({ kind: "redirect", to: "/" });
  });
  it("stranica je montirana u app/[base] kroz rute postavki fakulteta", () => {
    const page = readFileSync(join(import.meta.dirname, "../../../../app/[base]/ustanova/predlozak-rada/page.tsx"), "utf8");
    expect(page).toContain("faculty-settings/routes");
    expect(page).toContain('view="work-template"');
    expect(readFileSync(join(import.meta.dirname, "../faculty-settings/routes.tsx"), "utf8")).toContain("WorkTemplatePage");
  });
});

it("nema mrežnih poziva izvan zajedničkog klijenta", () => {
  const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f));
  expect(files).toContain("WorkTemplatePage.tsx");
  for (const file of files) {
    expect(readFileSync(join(import.meta.dirname, file), "utf8"), file).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|\/api\/v\d|<form\b/);
  }
});
