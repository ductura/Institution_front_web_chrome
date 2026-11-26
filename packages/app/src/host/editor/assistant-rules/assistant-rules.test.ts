import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StudentNoticeRead } from "../../../../../../src/client/student-notice.ts";
import type { NoticeView } from "../../../../../../src/components/student/assignment-notice-read.ts";
import { AssistantRulesView } from "./AssistantRules";
import { declarationPath, forgetNotices, instructionsOf, noticeOnce, noticePath, rulesViewOf, workPath } from "./assistant-rules";

const ID = "0f0e0d0c-0b0a-4908-8706-050403020100";
const view = (over: Partial<NoticeView> = {}): NoticeView => ({
  assignmentId: ID, versionNo: 1, title: "Esej o izmišljenom gradu", instructions: "Napišite esej.\nNavedite izvore.",
  workType: "essay", evidenceProfile: "basic", opensAt: "2026-11-01T08:00:00.000Z", dueAt: "2026-12-01T22:00:00.000Z",
  aiPolicy: "partially_allowed", aiPurposes: ["formatting", "proofreading", "literature_search", "translation"],
  wordMin: 1500, wordMax: 2000, acknowledgedAt: null, ...over,
});
const available = (over: Partial<NoticeView> = {}): StudentNoticeRead => ({ kind: "available", view: view(over), readAt: null });
const html = (read: StudentNoticeRead | null) =>
  renderToStaticMarkup(createElement(AssistantRulesView, { view: rulesViewOf(read), noticeHref: "/zadatak/x", declarationHref: "/rad/x/predaja/izjava" }));

afterEach(() => forgetNotices());

describe("ED-09 Pravila za ovaj zadatak", () => {
  it("lists every purpose with ✓ or × and a spoken word for each", () => {
    const out = html(available());
    expect(out).toContain("Pravila za ovaj zadatak");
    expect(out).toContain("<b>Alati su djelomično dopušteni.</b>");
    expect(out.match(/aria-hidden="true">✓</g)).toHaveLength(4);
    expect(out.match(/aria-hidden="true">×</g)).toHaveLength(1);
    expect(out).toContain("transkripcija<span");
    expect(out).toContain(" · nije dopušteno");
    expect(out).toContain(" · dopušteno");
  });

  it("says that no purpose is allowed when tools are prohibited", () => {
    const out = html(available({ aiPolicy: "prohibited", aiPurposes: [] }));
    expect(out).toContain("Alati nisu dopušteni.");
    expect(out).toContain("Nijedna svrha nije dopuštena.");
    expect(out).not.toContain("✓");
  });

  it("encouraged reads its own line", () => {
    expect(html(available({ aiPolicy: "encouraged" }))).toContain("Alati su dopušteni.");
  });

  it("keeps the outside-tools line and both ways out in every state", () => {
    for (const read of [null, { kind: "unavailable" } as const, available()]) {
      const out = html(read);
      expect(out).toContain("Alate koje koristite izvan Ducture navedite u izjavi pri predaji.");
      expect(out).toContain('href="/zadatak/x">Pročitaj obavijest zadatka</a>');
      expect(out).toContain('href="/rad/x/predaja/izjava">Izjava o korištenju alata</a>');
    }
  });

  it("shows loading, then an honest line when the notice cannot be read or has an unknown policy", () => {
    expect(html(null)).toContain("Učitavam pravila zadatka…");
    expect(rulesViewOf({ kind: "signedOut" })).toEqual({ kind: "unavailable" });
    expect(rulesViewOf(available({ aiPolicy: "something_else" }))).toEqual({ kind: "unavailable" });
    expect(html({ kind: "notFound" })).toContain("Pravila zadatka trenutačno se ne mogu učitati.");
  });

  it("gives the instructions to Prvi redak only when the notice has them", () => {
    expect(instructionsOf(available())).toBe("Napišite esej.\nNavedite izvore.");
    expect(instructionsOf(available({ instructions: "   " }))).toBeNull();
    expect(instructionsOf(null)).toBeNull();
    expect(instructionsOf({ kind: "unavailable" })).toBeNull();
  });

  it("builds the routes of the notice and the declaration", () => {
    expect(noticePath(ID)).toBe(`/zadatak/${ID}`);
    expect(declarationPath(ID)).toBe(`/rad/${ID}/predaja/izjava`);
    expect(workPath(ID)).toBe(`/rad/${ID}`);
  });

  it("ED-12: in the editor the declaration opens its dialog and filling it in stays a link", () => {
    const out = renderToStaticMarkup(createElement(AssistantRulesView, {
      view: rulesViewOf(available()), noticeHref: "/zadatak/x", declarationHref: "/rad/x/predaja/izjava", onDeclaration: () => undefined,
    }));
    expect(out).toMatch(/<button type="button"[^>]*aria-haspopup="dialog"[^>]*>Izjava o korištenju alata<\/button>/);
    expect(out).not.toContain(">Izjava o korištenju alata</a>");
    expect(out).toContain('href="/rad/x/predaja/izjava">Uredi izjavu</a>');
    expect(out).toContain('href="/zadatak/x">Pročitaj obavijest zadatka</a>');
  });

  it("reads the notice once per assignment and asks again after a failure", async () => {
    const read = vi.fn<(id: string) => Promise<StudentNoticeRead>>()
      .mockResolvedValueOnce({ kind: "unavailable" })
      .mockResolvedValue(available());
    expect((await noticeOnce(ID, read)).kind).toBe("unavailable");
    expect((await noticeOnce(ID, read)).kind).toBe("available");
    expect((await noticeOnce(ID, read)).kind).toBe("available");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("names no provider and no model", () => {
    expect(html(available())).not.toMatch(/OpenAI|Anthropic|Claude|GPT|Gemini|Mistral/u);
  });
});
