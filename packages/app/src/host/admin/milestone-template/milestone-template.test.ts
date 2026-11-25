import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PAGES, resolve } from "../../../routes";
import { MAX_MILESTONES, changed, checkDraft, draftOf, emptyMilestone, isValid, milestonesOf, move, parseDue, type Draft, type TemplateVersion } from "./model";

const version: TemplateVersion = {
  version: 2, effectiveFrom: "2026-10-01T10:00:00.000Z", requireFinalStageApproval: true,
  milestones: [{ title: "Prijedlog teme", relativeDue: 14, submits: "topic_text" }, { title: "Nacrt rada", submits: "current_version" }],
};
const rows = (n: number): Draft => ({ requireFinalStageApproval: false, milestones: Array.from({ length: n }, (_, i) => ({ ...emptyMilestone(), title: `Etapa ${i + 1}` })) });

describe("model predloška etapa", () => {
  it("odbija više od 20 etapa prije slanja", () => {
    expect(isValid(checkDraft(rows(MAX_MILESTONES)))).toBe(true);
    expect(checkDraft(rows(MAX_MILESTONES + 1)).form).toBe("tooMany");
  });
  it("odbija rok izvan raspona 1 do 1095 i nečitljiv rok; prazan rok je dopušten", () => {
    for (const bad of ["0", "1096", "-3", "1.5", "abc", "1e3"]) expect(Number.isNaN(parseDue(bad)), bad).toBe(true);
    expect([parseDue("1"), parseDue("1095"), parseDue(" 30 "), parseDue("")]).toEqual([1, 1095, 30, null]);
    const d = rows(1);
    expect(isValid(checkDraft({ ...d, milestones: [{ ...d.milestones[0]!, due: "1096" }] }))).toBe(false);
  });
  it("odbija prazan i predug naziv", () => {
    const m = emptyMilestone();
    expect(Object.values(checkDraft({ requireFinalStageApproval: false, milestones: [{ ...m, title: "  " }] }).rows)[0]?.title).toBe("titleRequired");
    expect(Object.values(checkDraft({ requireFinalStageApproval: false, milestones: [{ ...m, title: "x".repeat(201) }] }).rows)[0]?.title).toBe("titleTooLong");
    expect(isValid(checkDraft({ requireFinalStageApproval: false, milestones: [{ ...m, title: "x".repeat(200) }] }))).toBe(true);
  });
  it("tijelo zahtjeva izostavlja prazan rok i skraćuje razmake", () => {
    const d = draftOf(version);
    expect(milestonesOf({ ...d, milestones: d.milestones.map((m) => ({ ...m, title: ` ${m.title} ` })) })).toEqual(version.milestones);
  });
  it("prepoznaje promjenu, uključujući redoslijed i prekidač", () => {
    const d = draftOf(version);
    expect(changed(version, d)).toBe(false);
    expect(changed(version, { ...d, requireFinalStageApproval: false })).toBe(true);
    expect(changed(version, { ...d, milestones: move(d.milestones, 0, 1) })).toBe(true);
    expect(changed(null, draftOf(null))).toBe(false);
  });
  it("pomak izvan granica ne mijenja popis", () => {
    expect(move([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(move([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
    expect(move([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
  });
});

describe("ruta /ustanova/etape", () => {
  it("vidi je samo administrator; ostali odlaze na svoj početak", () => {
    expect(PAGES.some((p) => p.path === "/ustanova/etape")).toBe(true);
    expect(resolve("/ustanova/etape", "admin").kind).toBe("page");
    expect(resolve("/ustanova/etape", "teacher")).toEqual({ kind: "redirect", to: "/nastavnik" });
    expect(resolve("/ustanova/etape", "student")).toEqual({ kind: "redirect", to: "/zadaci" });
    expect(resolve("/ustanova/etape", null)).toEqual({ kind: "redirect", to: "/" });
  });
  it("stranica je montirana u app/[base]", () => {
    const page = readFileSync(join(import.meta.dirname, "../../../../app/[base]/ustanova/etape/page.tsx"), "utf8");
    expect(page).toContain("admin/milestone-template/routes");
  });
});

it("nema mrežnih poziva izvan zajedničkog klijenta", () => {
  const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f));
  expect(files).toContain("MilestoneTemplatePage.tsx");
  for (const file of files) {
    expect(readFileSync(join(import.meta.dirname, file), "utf8"), file).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|\/api\/v\d|<form\b/);
  }
});
